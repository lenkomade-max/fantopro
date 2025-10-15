/**
 * File Content Source
 * 
 * Handles direct file uploads (base64 encoded or binary buffers).
 * Useful for N8N integrations and direct file uploads.
 */

import path from "path";
import fs from "fs-extra";
import cuid from "cuid";
import { Config } from "../../../config";
import { logger } from "../../../logger";
import {
  IContentSource,
  GetMediaParams,
  MediaFile,
  FileUpload,
} from "./types";

// Maximum file size: 500 MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Supported MIME types
const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
];

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const SUPPORTED_MIME_TYPES = [
  ...SUPPORTED_VIDEO_TYPES,
  ...SUPPORTED_IMAGE_TYPES,
];

export class FileSource implements IContentSource {
  private tempFiles: string[] = [];

  constructor(
    private config: Config,
    private files: FileUpload[],
  ) {}

  async getMedia(params: GetMediaParams): Promise<MediaFile[]> {
    logger.debug({ fileCount: this.files.length, params }, "Processing direct files");

    const mediaFiles: MediaFile[] = [];

    for (const fileUpload of this.files) {
      try {
        const file = await this.processFile(fileUpload);
        mediaFiles.push(file);
      } catch (error) {
        logger.error({ filename: fileUpload.filename, error }, "Failed to process file");
        throw new Error(
          `Failed to process file ${fileUpload.filename}: ${error}`,
        );
      }
    }

    return mediaFiles;
  }

  private async processFile(fileUpload: FileUpload): Promise<MediaFile> {
    // Validate MIME type
    if (!SUPPORTED_MIME_TYPES.includes(fileUpload.mimeType)) {
      throw new Error(`Unsupported MIME type: ${fileUpload.mimeType}`);
    }

    // Validate data field
    if (!fileUpload.data) {
      throw new Error("File data is required");
    }

    // Prepare temp file path
    const tempId = cuid();
    const extension = this.getExtensionFromMimeType(fileUpload.mimeType);
    const tempFileName = `file_${tempId}${extension}`;
    const tempPath = path.join(this.config.tempDirPath, tempFileName);

    logger.debug(
      { filename: fileUpload.filename, tempPath },
      "Saving uploaded file",
    );

    // Handle base64 encoded data
    if (typeof fileUpload.data === "string") {
      await this.saveBase64File(fileUpload.data, tempPath);
    } else {
      // Handle binary buffer
      await this.saveBinaryFile(fileUpload.data, tempPath);
    }

    // Validate file size
    const stats = await fs.stat(tempPath);
    if (stats.size > MAX_FILE_SIZE) {
      await fs.remove(tempPath);
      throw new Error(
        `File size ${stats.size} bytes exceeds maximum ${MAX_FILE_SIZE} bytes`,
      );
    }

    this.tempFiles.push(tempPath);

    const isVideo = SUPPORTED_VIDEO_TYPES.includes(fileUpload.mimeType);

    return {
      localPath: tempPath,
      filename: tempFileName,
      mimeType: fileUpload.mimeType,
      size: stats.size,
      isVideo,
    };
  }

  private async saveBase64File(base64Data: string, targetPath: string): Promise<void> {
    try {
      // Remove data URL prefix if present (e.g., "data:video/mp4;base64,")
      const base64Content = base64Data.includes(",")
        ? base64Data.split(",")[1]
        : base64Data;

      const buffer = Buffer.from(base64Content, "base64");
      await fs.writeFile(targetPath, buffer);
      logger.debug({ targetPath, size: buffer.length }, "Saved base64 file");
    } catch (error) {
      throw new Error(`Failed to decode base64 data: ${error}`);
    }
  }

  private async saveBinaryFile(buffer: unknown, targetPath: string): Promise<void> {
    try {
      // Type guard for Buffer
      if (!Buffer.isBuffer(buffer)) {
        throw new Error("Data is not a Buffer");
      }
      await fs.writeFile(targetPath, buffer);
      logger.debug({ targetPath, size: buffer.length }, "Saved binary file");
    } catch (error) {
      throw new Error(`Failed to save binary file: ${error}`);
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "video/x-msvideo": ".avi",
      "video/webm": ".webm",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };
    return extensionMap[mimeType] || ".mp4";
  }

  async cleanup(): Promise<void> {
    logger.debug({ files: this.tempFiles }, "Cleaning up uploaded files");
    for (const file of this.tempFiles) {
      try {
        await fs.remove(file);
      } catch (error) {
        logger.warn({ file, error }, "Failed to cleanup temp file");
      }
    }
    this.tempFiles = [];
  }
}

