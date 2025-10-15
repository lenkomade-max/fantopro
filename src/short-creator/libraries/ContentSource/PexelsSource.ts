/**
 * Pexels Content Source
 * 
 * Implementation of content source using Pexels API.
 * This wraps the existing PexelsAPI library.
 */

import path from "path";
import https from "https";
import http from "http";
import fs from "fs-extra";
import cuid from "cuid";
import { PexelsAPI } from "../Pexels";
import { logger } from "../../../logger";
import {
  IContentSource,
  GetMediaParams,
  MediaFile,
} from "./types";

export class PexelsSource implements IContentSource {
  private tempFiles: string[] = [];

  constructor(
    private pexelsApi: PexelsAPI,
    private searchTerms: string[],
  ) {}

  async getMedia(params: GetMediaParams): Promise<MediaFile[]> {
    logger.debug(
      { searchTerms: this.searchTerms, params },
      "Getting media from Pexels",
    );

    // Find video using existing PexelsAPI
    const video = await this.pexelsApi.findVideo(
      this.searchTerms,
      params.duration,
      params.excludeIds || [],
      params.orientation,
    );

    // Download video to temp location
    const tempId = cuid();
    const tempFileName = `pexels_${tempId}.mp4`;
    const tempPath = path.join("/tmp", tempFileName);

    logger.debug(`Downloading Pexels video from ${video.url} to ${tempPath}`);

    await new Promise<void>((resolve, reject) => {
      const fileStream = fs.createWriteStream(tempPath);
      https
        .get(video.url, (response: http.IncomingMessage) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download video: ${response.statusCode}`),
            );
            return;
          }

          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            logger.debug(`Pexels video downloaded successfully to ${tempPath}`);
            resolve();
          });
        })
        .on("error", (err: Error) => {
          fs.unlink(tempPath, () => {}); // Delete the file if download failed
          logger.error(err, "Error downloading Pexels video");
          reject(err);
        });
    });

    this.tempFiles.push(tempPath);

    // Get file stats
    const stats = await fs.stat(tempPath);

    return [
      {
        localPath: tempPath,
        filename: tempFileName,
        mimeType: "video/mp4",
        size: stats.size,
        isVideo: true,
      },
    ];
  }

  async cleanup(): Promise<void> {
    logger.debug({ files: this.tempFiles }, "Cleaning up Pexels temp files");
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

