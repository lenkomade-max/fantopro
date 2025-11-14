/**
 * Effect Manager
 *
 * Manages visual effects using FFmpeg:
 * - BLEND OVERLAY: VHS effects, light leaks (RGB blend)
 * - GREEN SCREEN CHROMAKEY: Advertising banners (chromakey filter)
 *
 * NOTE: Canvas API removed - FFmpeg overlay methods replace Remotion overlays
 */

import path from "path";
import fs from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
import { Config } from "../../config";
import { logger } from "../../logger";
import type { Effect, BlendEffect, BannerOverlayEffect } from "../../types/shorts";
import { OverlayCache } from "./OverlayCache";
import { resolvePosition, getVideoDimensions } from "../../components/utils/position";

export interface ProcessedBlendEffect {
  type: "blend";
  localPath: string;
  publicUrl?: string;
  staticEffectPath?: string; // 'effects/<hash>.<ext>' for staticFile()
  blendMode: string;
  opacity: number;
  duration?: "full" | { start: number; end: number };
  isVideo: boolean;
}

export interface ProcessedBannerEffect {
  type: "banner_overlay";
  localPath: string;
  publicUrl?: string;
  staticBannerPath?: string; // 'effects/<hash>.<ext>' for staticFile()
  chromakey: {
    color: string;
    similarity: number;
    blend: number;
  };
  position: {
    x: number | string;  // Pixels, percentage ("50%"), or alias ("left", "center", "right")
    y: number | string;  // Pixels, percentage ("50%"), or alias ("top", "center", "bottom")
  };
  duration?: "full" | { start: number; end: number };
  isVideo: boolean;
}

export type ProcessedEffect = ProcessedBlendEffect | ProcessedBannerEffect;

export class EffectManager {
  private tempFiles: string[] = [];

  constructor(private config: Config) {}

  /**
   * Process effects and download/prepare overlay files
   */
  async processEffects(effects: Effect[]): Promise<ProcessedEffect[]> {
    const processedEffects: ProcessedEffect[] = [];

    for (const effect of effects) {
      if (effect.type === "blend") {
        const processed = await this.processBlendEffect(effect);
        processedEffects.push(processed);
      } else if (effect.type === "banner_overlay") {
        const processed = await this.processBannerEffect(effect);
        processedEffects.push(processed);
      }
    }

    return processedEffects;
  }

  private async processBlendEffect(effect: BlendEffect): Promise<ProcessedEffect> {
    let localPath: string;
    let isVideo = true;
    let publicUrl: string | undefined;
    let staticEffectPath: string | undefined;

    // Handle staticEffectPath (direct from effects cache)
    if ((effect as any).staticEffectPath) {
      staticEffectPath = (effect as any).staticEffectPath;
      // Construct local path from static directory
      const staticDirPath = this.config.getStaticDirPath();
      if (!staticDirPath) {
        throw new Error("Static directory path is not configured");
      }
      if (!staticEffectPath) {
        throw new Error("Static effect path is undefined");
      }
      localPath = path.join(staticDirPath, staticEffectPath);
      // Ensure localPath is set for BlendOverlay
      if (!localPath) {
        throw new Error("Failed to construct local path from staticEffectPath");
      }
      // Determine if it's a video based on extension
      const ext = path.extname(localPath).toLowerCase();
      // Enforce local MP4 only for videos; images remain allowed
      if ([".mov"].includes(ext)) {
        throw new Error(`Unsupported video format for overlays: ${ext}. Use MP4 only.`);
      }
      isVideo = [".mp4", ".webm", ".avi"].includes(ext);
      if (isVideo && ext !== ".mp4") {
        throw new Error(`Only MP4 video overlays are allowed. Received: ${ext}`);
      }
      publicUrl = `/static/${staticEffectPath}`;
    } else if (effect.overlayUrl) {
      // Enforce: No HTTP/HTTPS; only local file URIs are allowed
      if (effect.overlayUrl.startsWith("http://") || effect.overlayUrl.startsWith("https://")) {
        throw new Error("HTTP/HTTPS overlays are not allowed. Provide local file (file://) or cached staticEffectPath.");
      }

      // Handle file:// local paths
      if (effect.overlayUrl.startsWith("file://")) {
        const filePath = effect.overlayUrl.replace("file://", "");
        const tempId = this.generateTempId();
        const extension = path.extname(filePath) || ".mp4";
        const tempFileName = `overlay_${tempId}${extension}`;
        const tempPath = path.join(this.config.tempDirPath, tempFileName);
        await fs.copy(filePath, tempPath);
        this.tempFiles.push(tempPath);
        localPath = tempPath;
      } else {
        // If it's not file:// and not http(s), disallow to avoid ambiguity
        throw new Error("Only local file overlays are allowed (file://). Provide file:// or use staticEffectPath.");
      }
      // Determine if it's a video based on extension and enforce MP4-only
      const ext = path.extname(localPath).toLowerCase();
      if (ext === ".mov") {
        throw new Error(".mov overlays are not allowed. Convert to .mp4");
      }
      isVideo = [".mp4", ".webm", ".avi"].includes(ext);
      if (isVideo && ext !== ".mp4") {
        throw new Error(`Only MP4 video overlays are allowed. Received: ${ext}`);
      }

      // Кладём в стабильный кэш и используем оттуда (устойчиво для рендера)
      const cache = new OverlayCache(this.config);
      const { localPath: cachedPath, publicUrl: cachedPublicUrl, staticEffectPath: cachedStaticPath } = await cache.put(localPath);
      localPath = cachedPath;
      publicUrl = cachedPublicUrl;
      staticEffectPath = cachedStaticPath;
    } else if (effect.overlayFile) {
      localPath = await this.saveUploadedOverlay(effect.overlayFile);
      isVideo = effect.overlayFile.mimeType.startsWith("video/");
      // Enforce MP4-only for uploaded videos
      if (isVideo) {
        const ext = this.getExtensionFromMimeType(effect.overlayFile.mimeType);
        if (ext !== ".mp4") {
          throw new Error("Only MP4 video overlays are allowed for uploads.");
        }
      }

      // Кладём в стабильный кэш и используем оттуда (устойчиво для рендера)
      const cache = new OverlayCache(this.config);
      const { localPath: cachedPath, publicUrl: cachedPublicUrl, staticEffectPath: cachedStaticPath } = await cache.put(localPath);
      localPath = cachedPath;
      publicUrl = cachedPublicUrl;
      staticEffectPath = cachedStaticPath;
    } else {
      throw new Error("Either overlayUrl, overlayFile, or staticEffectPath must be provided for blend effect");
    }

    return {
      type: "blend",
      localPath,
      publicUrl,
      staticEffectPath,
      blendMode: effect.blendMode,
      opacity: effect.opacity ?? 1,
      duration: effect.duration,
      isVideo,
    };
  }

  private async processBannerEffect(effect: BannerOverlayEffect): Promise<ProcessedBannerEffect> {
    let localPath: string;
    let isVideo = true;
    let publicUrl: string | undefined;
    let staticBannerPath: string | undefined;

    // Handle staticBannerPath (direct from effects cache)
    if (effect.staticBannerPath) {
      staticBannerPath = effect.staticBannerPath;
      const staticDirPath = this.config.getStaticDirPath();
      if (!staticDirPath) {
        throw new Error("Static directory path is not configured");
      }
      localPath = path.join(staticDirPath, staticBannerPath);
      if (!localPath) {
        throw new Error("Failed to construct local path from staticBannerPath");
      }

      // Determine if it's a video based on extension
      const ext = path.extname(localPath).toLowerCase();
      if ([".mov"].includes(ext)) {
        throw new Error(`Unsupported video format for banner overlays: ${ext}. Use MP4 only.`);
      }
      isVideo = [".mp4", ".webm", ".avi"].includes(ext);
      if (isVideo && ext !== ".mp4") {
        throw new Error(`Only MP4 video banners are allowed. Received: ${ext}`);
      }
      publicUrl = `/static/${staticBannerPath}`;
    } else if (effect.bannerUrl) {
      // Enforce: No HTTP/HTTPS; only local file URIs are allowed
      if (effect.bannerUrl.startsWith("http://") || effect.bannerUrl.startsWith("https://")) {
        throw new Error("HTTP/HTTPS banner URLs are not allowed. Provide local file (file://) or cached staticBannerPath.");
      }

      // Handle file:// local paths
      if (effect.bannerUrl.startsWith("file://")) {
        const filePath = effect.bannerUrl.replace("file://", "");
        const tempId = this.generateTempId();
        const extension = path.extname(filePath) || ".mp4";
        const tempFileName = `banner_${tempId}${extension}`;
        const tempPath = path.join(this.config.tempDirPath, tempFileName);
        await fs.copy(filePath, tempPath);
        this.tempFiles.push(tempPath);
        localPath = tempPath;
      } else {
        throw new Error("Only local file banners are allowed (file://). Provide file:// or use staticBannerPath.");
      }

      // Determine if it's a video and enforce MP4-only
      const ext = path.extname(localPath).toLowerCase();
      if (ext === ".mov") {
        throw new Error(".mov banners are not allowed. Convert to .mp4");
      }
      isVideo = [".mp4", ".webm", ".avi"].includes(ext);
      if (isVideo && ext !== ".mp4") {
        throw new Error(`Only MP4 video banners are allowed. Received: ${ext}`);
      }

      // Cache in stable directory
      const cache = new OverlayCache(this.config);
      const { localPath: cachedPath, publicUrl: cachedPublicUrl, staticEffectPath: cachedStaticPath } = await cache.put(localPath);
      localPath = cachedPath;
      publicUrl = cachedPublicUrl;
      staticBannerPath = cachedStaticPath;
    } else if (effect.bannerFile) {
      localPath = await this.saveUploadedOverlay(effect.bannerFile);
      isVideo = effect.bannerFile.mimeType.startsWith("video/");

      // Enforce MP4-only for uploaded videos
      if (isVideo) {
        const ext = this.getExtensionFromMimeType(effect.bannerFile.mimeType);
        if (ext !== ".mp4") {
          throw new Error("Only MP4 video banners are allowed for uploads.");
        }
      }

      // Cache in stable directory
      const cache = new OverlayCache(this.config);
      const { localPath: cachedPath, publicUrl: cachedPublicUrl, staticEffectPath: cachedStaticPath } = await cache.put(localPath);
      localPath = cachedPath;
      publicUrl = cachedPublicUrl;
      staticBannerPath = cachedStaticPath;
    } else {
      throw new Error("Either bannerUrl, bannerFile, or staticBannerPath must be provided for banner_overlay effect");
    }

    return {
      type: "banner_overlay",
      localPath,
      publicUrl,
      staticBannerPath,
      chromakey: effect.chromakey ?? {
        color: "0x00FF00",
        similarity: 0.2,
        blend: 0.2,
      },
      // BANNER POSITION: Always static at (0, 0) - full screen overlay
      // User prepares banner with greenscreen in exact position needed
      position: {
        x: 0,
        y: 0,
      },
      duration: effect.duration,
      isVideo,
    };
  }

  private async saveUploadedOverlay(fileUpload: any): Promise<string> {
    if (!fileUpload.data) {
      throw new Error("File data is required");
    }

    const tempId = this.generateTempId();
    const extension = this.getExtensionFromMimeType(fileUpload.mimeType);
    const tempFileName = `overlay_${tempId}${extension}`;
    const tempPath = path.join(this.config.tempDirPath, tempFileName);

    logger.debug({ filename: fileUpload.filename, tempPath }, "Saving uploaded overlay");

    if (typeof fileUpload.data === "string") {
      // Base64
      const base64Content = fileUpload.data.includes(",")
        ? fileUpload.data.split(",")[1]
        : fileUpload.data;
      const buffer = Buffer.from(base64Content, "base64");
      await fs.writeFile(tempPath, buffer);
    } else {
      // Binary
      if (!Buffer.isBuffer(fileUpload.data)) {
        throw new Error("Invalid file data");
      }
      await fs.writeFile(tempPath, fileUpload.data);
    }

    this.tempFiles.push(tempPath);
    return tempPath;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const map: Record<string, string> = {
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "video/webm": ".webm",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };
    return map[mimeType] || ".mp4";
  }

  async cleanup(): Promise<void> {
    logger.debug({ files: this.tempFiles }, "Cleaning up effect temp files");
    for (const file of this.tempFiles) {
      try {
        await fs.remove(file);
      } catch (error) {
        logger.warn({ file, error }, "Failed to cleanup effect temp file");
      }
    }
    this.tempFiles = [];
  }

  /**
   * Generate a temporary identifier without external dependencies
   */
  private generateTempId(): string {
    const randomPart = Math.random().toString(36).slice(2);
    const timePart = Date.now().toString(36);
    return `${randomPart}${timePart}`;
  }

  // ========================================
  // FFmpeg-based Overlay Methods
  // ========================================

  /**
   * BLEND OVERLAY - VHS effects, light leaks, textures
   *
   * Uses FFmpeg blend filter with RGB color space conversion.
   * Blends two videos together with adjustable opacity and blend mode.
   *
   * @param baseVideo - Path to base video
   * @param overlayVideo - Path to overlay effect video
   * @param blendMode - FFmpeg blend mode (addition, screen, overlay, multiply, average, lighten)
   * @param opacity - Effect opacity (0.0 - 1.0)
   * @param width - Video width (default: 1080)
   * @param height - Video height (default: 1920)
   * @returns Path to output video with blend effect applied
   */
  async applyBlendOverlay(
    baseVideo: string,
    overlayVideo: string,
    blendMode: "addition" | "screen" | "overlay" | "multiply" | "average" | "lighten" | "darken" | "hardlight" = "addition",
    opacity: number = 0.5,
    width: number = 1080,
    height: number = 1920
  ): Promise<string> {
    const outputPath = path.join(this.config.tempDirPath, `blend_${this.generateTempId()}.mp4`);

    logger.info({
      baseVideo,
      overlayVideo,
      blendMode,
      opacity,
      outputPath,
    }, "Applying FFmpeg blend overlay");

    const filterComplex = [
      `[0:v]format=gbrp[base]`,
      `[1:v]scale=${width}:${height},format=gbrp,loop=loop=0:size=32767[overlay]`,
      `[base][overlay]blend=all_mode='${blendMode}':all_opacity=${opacity}:shortest=1,format=yuv420p[out]`
    ].join(';');

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(baseVideo)
        .input(overlayVideo)
        .complexFilter(filterComplex)
        .outputOptions(['-map', '[out]', '-map', '0:a?', '-c:a', 'aac', '-b:a', '192k'])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug({ commandLine }, "FFmpeg blend command started");
        })
        .on('progress', (progress) => {
          logger.debug({ progress: progress.percent }, "FFmpeg blend progress");
        })
        .on('end', () => {
          logger.info({ outputPath }, "FFmpeg blend overlay completed");
          this.tempFiles.push(outputPath);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error({ error: err.message }, "FFmpeg blend overlay failed");
          reject(new Error(`FFmpeg blend overlay failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * GREEN SCREEN CHROMAKEY - Advertising banners, logos
   *
   * Uses FFmpeg chromakey filter to remove green background (#00FF00).
   * Banner remains 100% opaque, no mixing with base video.
   *
   * @param baseVideo - Path to base video
   * @param bannerVideo - Path to banner video with green screen (#00FF00)
   * @param similarity - How similar colors to remove (0.0 - 1.0, default: 0.2 aggressive)
   * @param blend - Edge softness (0.0 - 1.0, default: 0.2)
   * @param position - Banner position {x, y} - supports pixels (100), percentages ("50%"), or aliases ("left", "center", "right", "top", "bottom")
   * @param duration - Time range for banner appearance (default: "full", or {start: number, end: number} in seconds)
   * @param orientation - Video orientation ("portrait" or "landscape") for position resolution
   * @returns Path to output video with banner overlay applied
   */
  async applyBannerChromakey(
    baseVideo: string,
    bannerVideo: string,
    similarity: number = 0.2,
    blend: number = 0.2,
    position: { x: number | string; y: number | string } = { x: 0, y: 0 },
    duration?: "full" | { start: number; end: number },
    orientation: "portrait" | "landscape" = "portrait"
  ): Promise<string> {
    const outputPath = path.join(this.config.tempDirPath, `banner_${this.generateTempId()}.mp4`);

    // Resolve position from flexible format (pixels, percentages, aliases) to absolute pixels
    const videoDimensions = getVideoDimensions(orientation);
    const resolvedPosition = resolvePosition(
      position as any,
      videoDimensions.width,
      videoDimensions.height
    );

    logger.info({
      baseVideo,
      bannerVideo,
      similarity,
      blend,
      position,
      resolvedPosition,
      duration,
      outputPath,
    }, "Applying FFmpeg chromakey banner");

    // Build overlay filter with optional time-based enable
    let overlayFilter = `overlay=${resolvedPosition.x}:${resolvedPosition.y}:shortest=1`;

    // Add enable option for time-based appearance
    if (duration && duration !== "full") {
      overlayFilter += `:enable='between(t,${duration.start},${duration.end})'`;
    }

    // Banner должен быть уже правильного размера (portrait: 1080x1920, landscape: 1920x1080)
    // Просто убираем greenscreen и накладываем баннер как есть
    const filterComplex = [
      `[1:v]chromakey=0x00FF00:${similarity}:${blend}[banner]`,
      `[0:v][banner]${overlayFilter}[out]`
    ].join(';');

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(baseVideo)
        .input(bannerVideo)
        .inputOptions(['-stream_loop', '-1'])
        .complexFilter(filterComplex)
        .outputOptions(['-map', '[out]', '-map', '0:a?', '-c:a', 'aac', '-b:a', '192k'])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug({ commandLine }, "FFmpeg chromakey command started");
        })
        .on('progress', (progress) => {
          logger.debug({ progress: progress.percent }, "FFmpeg chromakey progress");
        })
        .on('end', () => {
          logger.info({ outputPath }, "FFmpeg chromakey banner completed");
          this.tempFiles.push(outputPath);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error({ error: err.message }, "FFmpeg chromakey banner failed");
          reject(new Error(`FFmpeg chromakey banner failed: ${err.message}`));
        })
        .run();
    });
  }
}
