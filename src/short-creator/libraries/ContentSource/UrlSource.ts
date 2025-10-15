/**
 * URL Content Source
 * 
 * Downloads media files from HTTP/HTTPS URLs.
 * Supports videos (MP4, MOV, AVI, WebM) and images (JPG, PNG, WebP).
 */

import path from "path";
import https from "https";
import http from "http";
import fs from "fs-extra";
import cuid from "cuid";
import { Config } from "../../../config";
import { logger } from "../../../logger";
import {
  IContentSource,
  GetMediaParams,
  MediaFile,
} from "./types";

// Maximum file size: 500 MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Download timeout: 5 minutes
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000;

// Supported MIME types
const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // MOV
  "video/x-msvideo", // AVI
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

export class UrlSource implements IContentSource {
  private tempFiles: string[] = [];

  constructor(
    private config: Config,
    private urls: string[],
  ) {}

  async getMedia(params: GetMediaParams): Promise<MediaFile[]> {
    logger.debug({ urls: this.urls, params }, "Getting media from URLs");

    const mediaFiles: MediaFile[] = [];

    for (const url of this.urls) {
      try {
        const file = await this.downloadFile(url);
        mediaFiles.push(file);
      } catch (error) {
        logger.error({ url, error }, "Failed to download file from URL");
        throw new Error(`Failed to download file from ${url}: ${error}`);
      }
    }

    return mediaFiles;
  }

  private async downloadFile(url: string): Promise<MediaFile> {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }

    const tempId = cuid();
    const extension = this.getExtensionFromUrl(url);
    const tempFileName = `url_${tempId}${extension}`;
    const tempPath = path.join(this.config.tempDirPath, tempFileName);

    logger.debug(`Downloading file from ${url} to ${tempPath}`);

    return new Promise<MediaFile>((resolve, reject) => {
      const httpLib = parsedUrl.protocol === "https:" ? https : http;
      
      const request = httpLib.get(url, (response: http.IncomingMessage) => {
        // Handle redirects
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            logger.debug(`Following redirect to ${redirectUrl}`);
            this.downloadFile(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // Validate content type
        const contentType = response.headers["content-type"]?.split(";")[0].trim();
        if (contentType && !SUPPORTED_MIME_TYPES.includes(contentType)) {
          reject(new Error(`Unsupported content type: ${contentType}`));
          return;
        }

        // Check file size
        const contentLength = parseInt(response.headers["content-length"] || "0", 10);
        if (contentLength > MAX_FILE_SIZE) {
          reject(
            new Error(
              `File too large: ${contentLength} bytes (max: ${MAX_FILE_SIZE} bytes)`,
            ),
          );
          return;
        }

        const fileStream = fs.createWriteStream(tempPath);
        let downloadedBytes = 0;

        response.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_FILE_SIZE) {
            fileStream.close();
            fs.unlink(tempPath, () => {});
            reject(new Error(`File size exceeded maximum limit`));
          }
        });

        response.pipe(fileStream);

        fileStream.on("finish", async () => {
          fileStream.close();
          logger.debug(`File downloaded successfully to ${tempPath}`);

          try {
            // Get file stats
            const stats = await fs.stat(tempPath);
            
            // Determine MIME type and if it's a video
            const mimeType = contentType || this.getMimeTypeFromExtension(extension);
            const isVideo = SUPPORTED_VIDEO_TYPES.includes(mimeType);

            this.tempFiles.push(tempPath);

            resolve({
              localPath: tempPath,
              filename: tempFileName,
              mimeType,
              size: stats.size,
              isVideo,
            });
          } catch (error) {
            reject(error);
          }
        });

        fileStream.on("error", (err: Error) => {
          fs.unlink(tempPath, () => {});
          logger.error(err, "Error writing file");
          reject(err);
        });
      });

      request.setTimeout(DOWNLOAD_TIMEOUT, () => {
        request.destroy();
        reject(new Error(`Download timeout after ${DOWNLOAD_TIMEOUT}ms`));
      });

      request.on("error", (err: Error) => {
        fs.unlink(tempPath, () => {});
        logger.error(err, "Error downloading file");
        reject(err);
      });
    });
  }

  private getExtensionFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname);
      if (ext) {
        return ext;
      }
    } catch {
      // Ignore parsing errors
    }
    return ".mp4"; // Default extension
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".webm": "video/webm",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    return mimeMap[extension.toLowerCase()] || "video/mp4";
  }

  async cleanup(): Promise<void> {
    logger.debug({ files: this.tempFiles }, "Cleaning up URL temp files");
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

