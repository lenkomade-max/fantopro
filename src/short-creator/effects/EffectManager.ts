/**
 * Effect Manager
 * 
 * Manages visual effects like blend overlays for video scenes.
 */

import path from "path";
import https from "https";
import http from "http";
import fs from "fs-extra";
import cuid from "cuid";
import { Config } from "../../config";
import { logger } from "../../logger";
import type { Effect, BlendEffect } from "../../types/shorts";

export interface ProcessedEffect {
  type: "blend";
  localPath: string;
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

    // Download from URL or use uploaded file
    if (effect.overlayUrl) {
      localPath = await this.downloadOverlay(effect.overlayUrl);
      // Determine if it's a video based on extension
      const ext = path.extname(localPath).toLowerCase();
      isVideo = [".mp4", ".mov", ".webm", ".avi"].includes(ext);
    } else if (effect.overlayFile) {
      localPath = await this.saveUploadedOverlay(effect.overlayFile);
      isVideo = effect.overlayFile.mimeType.startsWith("video/");
    } else {
      throw new Error("Either overlayUrl or overlayFile must be provided for blend effect");
    }

    return {
      type: "blend",
      localPath,
      blendMode: effect.blendMode,
      opacity: effect.opacity ?? 1,
      duration: effect.duration,
      isVideo,
    };
  }

  private async downloadOverlay(url: string): Promise<string> {
    const parsedUrl = new URL(url);
    const tempId = cuid();
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

    const tempId = cuid();
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
}

