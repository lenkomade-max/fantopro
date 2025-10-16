/**
 * Overlay Remotion Wrapper
 * 
 * Wraps Remotion API for overlays with enhanced configuration and timeout management.
 * Uses OverlayRemotionConfig for configuration and maintains API compatibility
 * with existing Remotion.ts.
 */

import z from "zod";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { ensureBrowser } from "@remotion/renderer";
import { Config } from "@remotion/cli/config";

import { Config as AppConfig } from "../../config";
import { shortVideoSchema } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum } from "../../types/shorts";
import { getOrientationConfig } from "../../components/utils";
import { overlayConfig, overlayTimeouts, overlayRenderSettings } from "../../remotion/config/OverlayRemotionConfig";

export interface OverlayRenderOptions {
  perOverlayTimeout?: number;
  totalTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
}

export interface OverlayRenderStatus {
  stage: "bundling" | "selecting" | "rendering" | "completed" | "failed";
  progress?: number;
  error?: string;
  startTime: number;
  elapsedMs: number;
}

/**
 * Enhanced Remotion wrapper for overlay rendering
 */
export class OverlayRemotion {
  constructor(
    private bundled: string,
    private config: AppConfig,
  ) {}

  /**
   * Initialize OverlayRemotion with overlay-specific configuration
   */
  static async init(config: AppConfig): Promise<OverlayRemotion> {
    await ensureBrowser();

    logger.info("Initializing OverlayRemotion with overlay configuration");

    // CRITICAL: Apply overlay configuration to Remotion BEFORE bundling
    // This ensures staticFile() resolves to /static/effects/ instead of /public/effects/
    logger.info("Applying overlay configuration BEFORE bundling");
    
    Config.setPublicDir(overlayConfig.publicDir);
    Config.setVideoImageFormat(overlayConfig.videoImageFormat);
    Config.setOverwriteOutput(overlayConfig.overwriteOutput);
    Config.setEntryPoint(overlayConfig.entryPoint);
    Config.setChromiumOpenGlRenderer(overlayConfig.chromiumOpenGlRenderer);
    Config.setChromiumDisableWebSecurity(overlayConfig.chromiumDisableWebSecurity);
    Config.setEnforceAudioTrack(overlayConfig.enforceAudioTrackPresence);

    // Log configuration application
    logger.info(
      {
        configuredPublicDir: overlayConfig.publicDir,
        entryPoint: overlayConfig.entryPoint,
        videoImageFormat: overlayConfig.videoImageFormat,
        chromiumOpenGlRenderer: overlayConfig.chromiumOpenGlRenderer,
        chromiumDisableWebSecurity: overlayConfig.chromiumDisableWebSecurity,
      },
      "Applied overlay configuration to Remotion - staticFile() will now use /static/effects/"
    );

    logger.info({ publicDir: overlayConfig.publicDir }, "Public directory configuration applied, starting bundling");

    const bundled = await bundle({
      entryPoint: path.join(
        config.packageDirPath,
        config.devMode ? "src" : "dist",
        "components",
        "root",
        `index.${config.devMode ? "ts" : "js"}`,
      ),
      webpackOverride: (config) => {
        // Ensure webpack respects our public directory configuration
        logger.debug({ webpackPublicDir: overlayConfig.publicDir }, "Configuring webpack for overlay rendering");
        
        // Add overlay-specific webpack configuration
        return {
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...config.resolve?.alias,
              "@static": path.resolve(process.cwd(), overlayConfig.publicDir),
            },
          },
        };
      },
    });

    logger.info(
      { bundledPath: bundled, publicDir: overlayConfig.publicDir },
      "OverlayRemotion bundling complete with correct public directory"
    );

    return new OverlayRemotion(bundled, config);
  }

  /**
   * Render media with overlay-aware timeout management
   */
  async render(
    data: z.infer<typeof shortVideoSchema>,
    id: string,
    orientation: OrientationEnum,
    options: OverlayRenderOptions = {},
  ): Promise<void> {
    const startTime = Date.now();
    const status: OverlayRenderStatus = {
      stage: "bundling",
      startTime,
      elapsedMs: 0,
    };

    try {
      const { component } = getOrientationConfig(orientation);
      
      // Calculate timeouts based on overlay count
      const overlayCount = this.countOverlays(data);
      const totalTimeout = this.calculateTotalTimeout(overlayCount, options);
      
      logger.debug(
        { 
          component, 
          videoID: id, 
          overlayCount,
          totalTimeout,
          perOverlayTimeout: options.perOverlayTimeout || overlayTimeouts.perOverlay,
        },
        "Rendering video with overlay-aware Remotion"
      );

      status.stage = "selecting";
      this.updateStatus(status);

      const composition = await selectComposition({
        serveUrl: this.bundled,
        id: component,
        inputProps: data,
        timeoutInMilliseconds: Math.min(30000, totalTimeout), // Composition selection timeout
      });

      status.stage = "rendering";
      this.updateStatus(status);

      const outputLocation = path.join(this.config.videosDirPath, `${id}.mp4`);

      await renderMedia({
        codec: "h264",
        composition,
        serveUrl: this.bundled,
        outputLocation,
        inputProps: data,
        onProgress: ({ progress }) => {
          status.progress = progress;
          this.updateStatus(status);
          logger.debug(`Overlay rendering ${id} ${Math.floor(progress * 100)}% complete`);
        },
        // Overlay-specific settings
        concurrency: overlayRenderSettings.concurrency,
        offthreadVideoCacheSizeInBytes: overlayRenderSettings.offthreadVideoCacheSizeInBytes,
        timeoutInMilliseconds: totalTimeout,
        // Enhanced error handling - errors will be caught by the try-catch block
      });

      status.stage = "completed";
      this.updateStatus(status);

      logger.debug(
        {
          outputLocation,
          component,
          videoID: id,
          overlayCount,
          totalRenderTime: Date.now() - startTime,
        },
        "Video rendered with overlay Remotion",
      );

    } catch (error) {
      status.stage = "failed";
      status.error = error instanceof Error ? error.message : String(error);
      this.updateStatus(status);
      
      logger.error({ error, videoID: id, status }, "Overlay rendering failed");
      
      // Retry logic if enabled
      if (options.enableRetry && (options.maxRetries || 0) > 0) {
        logger.info({ videoID: id, retriesLeft: (options.maxRetries || 0) - 1 }, "Retrying overlay render");
        return this.render(data, id, orientation, {
          ...options,
          maxRetries: (options.maxRetries || 0) - 1,
        });
      }
      
      throw error;
    }
  }

  /**
   * Test render with overlay configuration
   */
  async testRender(outputLocation: string, options: OverlayRenderOptions = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug("Starting overlay test render");

      const composition = await selectComposition({
        serveUrl: this.bundled,
        id: "TestVideo",
        timeoutInMilliseconds: 30000,
      });

      const totalTimeout = options.totalTimeout || overlayTimeouts.totalRender;

      await renderMedia({
        codec: "h264",
        composition,
        serveUrl: this.bundled,
        outputLocation,
        onProgress: ({ progress }) => {
          logger.debug(
            `Rendering overlay test video: ${Math.floor(progress * 100)}% complete`,
          );
        },
        // Overlay-specific settings
        concurrency: overlayRenderSettings.concurrency,
        offthreadVideoCacheSizeInBytes: overlayRenderSettings.offthreadVideoCacheSizeInBytes,
        timeoutInMilliseconds: totalTimeout,
      });

      logger.debug(
        { outputLocation, renderTime: Date.now() - startTime },
        "Overlay test render completed"
      );

    } catch (error) {
      logger.error({ error, outputLocation }, "Overlay test render failed");
      throw error;
    }
  }

  /**
   * Count overlays in the video data
   */
  private countOverlays(data: z.infer<typeof shortVideoSchema>): number {
    let overlayCount = 0;
    
    if (data.scenes) {
      for (const scene of data.scenes) {
        if ((scene as any).effects && Array.isArray((scene as any).effects)) {
          overlayCount += (scene as any).effects.length;
        }
      }
    }
    
    return overlayCount;
  }

  /**
   * Calculate total timeout based on overlay count and configuration
   */
  private calculateTotalTimeout(overlayCount: number, options: OverlayRenderOptions): number {
    const perOverlayTimeout = options.perOverlayTimeout || overlayTimeouts.perOverlay;
    const baseTimeout = options.totalTimeout || overlayTimeouts.totalRender;
    
    // Add per-overlay timeout to base timeout, but cap at reasonable limit
    const overlayTimeout = Math.min(overlayCount * perOverlayTimeout, 60000); // Max 60s for overlays
    const totalTimeout = baseTimeout + overlayTimeout;
    
    logger.debug(
      { overlayCount, perOverlayTimeout, baseTimeout, totalTimeout },
      "Calculated overlay render timeout"
    );
    
    return totalTimeout;
  }

  /**
   * Update and log render status
   */
  private updateStatus(status: OverlayRenderStatus): void {
    status.elapsedMs = Date.now() - status.startTime;
    
    logger.debug(
      {
        stage: status.stage,
        progress: status.progress,
        elapsedMs: status.elapsedMs,
        error: status.error,
      },
      "Overlay render status update"
    );
  }

  /**
   * Get overlay configuration
   */
  getOverlayConfig() {
    return {
      config: overlayConfig,
      timeouts: overlayTimeouts,
      renderSettings: overlayRenderSettings,
    };
  }

  /**
   * Validate overlay data before rendering
   */
  validateOverlayData(data: z.infer<typeof shortVideoSchema>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.scenes || !Array.isArray(data.scenes)) {
      errors.push("Invalid or missing scenes data");
      return { isValid: false, errors };
    }

    let totalOverlays = 0;
    
    for (let i = 0; i < data.scenes.length; i++) {
      const scene = data.scenes[i];
      
      if ((scene as any).effects && Array.isArray((scene as any).effects)) {
        const sceneOverlays = (scene as any).effects.length;
        totalOverlays += sceneOverlays;
        
        // Validate each effect
        for (let j = 0; j < sceneOverlays; j++) {
          const effect = (scene as any).effects[j];
          
          if (!effect.staticEffectPath) {
            errors.push(`Scene ${i}, Effect ${j}: Missing staticEffectPath`);
          }
          
          if (effect.opacity !== undefined && (effect.opacity < 0 || effect.opacity > 1)) {
            errors.push(`Scene ${i}, Effect ${j}: Invalid opacity (${effect.opacity})`);
          }
        }
      }
    }

    if (totalOverlays > 10) {
      errors.push(`Too many overlays (${totalOverlays}). Maximum recommended: 10`);
    }

    const isValid = errors.length === 0;
    
    if (!isValid) {
      logger.warn({ errors, totalOverlays }, "Overlay data validation failed");
    }

    return { isValid, errors };
  }
}