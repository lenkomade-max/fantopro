/**
 * Effect Manager
 * 
 * Manages visual effects like blend overlays for video scenes.
 */

import path from "path";
import https from "https";
import http from "http";
import fs from "fs-extra";
import { Config } from "../../config";
import { logger } from "../../logger";
import type { Effect, BlendEffect } from "../../types/shorts";
import { OverlayCache } from "./OverlayCache";

export interface ProcessedEffect {
  type: "blend";
  localPath: string;
  publicUrl?: string;
  staticEffectPath?: string; // 'effects/<hash>.<ext>' for staticFile()
  blendMode: string;
  opacity: number;
  duration?: "full" | { start: number; end: number };
  isVideo: boolean;
}

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

  private async downloadOverlay(url: string): Promise<string> {
    const parsedUrl = new URL(url);
    const tempId = this.generateTempId();
    const extension = path.extname(parsedUrl.pathname) || ".mp4";
    const tempFileName = `overlay_${tempId}${extension}`;
    const tempPath = path.join(this.config.tempDirPath, tempFileName);

    logger.debug({ url, tempPath }, "Downloading overlay file");

    return new Promise<string>((resolve, reject) => {
      const httpLib = parsedUrl.protocol === "https:" ? https : http;
      
      const request = httpLib.get(url, (response: http.IncomingMessage) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const fileStream = fs.createWriteStream(tempPath);
        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          logger.debug({ tempPath }, "Overlay downloaded successfully");
          this.tempFiles.push(tempPath);
          resolve(tempPath);
        });

        fileStream.on("error", (err: Error) => {
          fs.unlink(tempPath, () => {});
          reject(err);
        });
      });

      request.on("error", (err: Error) => {
        fs.unlink(tempPath, () => {});
        reject(err);
      });
    });
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
}

