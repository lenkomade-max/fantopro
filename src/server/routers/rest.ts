import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import fs from "fs-extra";
import path from "path";

import { validateCreateShortInput } from "../validator";
import { ShortCreator } from "../../short-creator/ShortCreator";
import { logger } from "../../logger";
import { Config } from "../../config";

// todo abstract class
export class APIRouter {
  public router: express.Router;
  private shortCreator: ShortCreator;
  private config: Config;

  constructor(config: Config, shortCreator: ShortCreator) {
    this.config = config;
    this.router = express.Router();
    this.shortCreator = shortCreator;

    // Increase payload limit to support base64 photo uploads in JSON
    this.router.use(express.json({ limit: "50mb" }));
    this.router.use(express.urlencoded({ limit: "50mb", extended: true }));

    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.post(
      "/short-video",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const input = validateCreateShortInput(req.body);

          logger.info({ input }, "Creating short video");

          const videoId = this.shortCreator.addToQueue(
            input.scenes,
            input.config,
          );

          res.status(201).json({
            videoId,
          });
        } catch (error: unknown) {
          logger.error(error, "Error validating input");

          // Handle validation errors specifically
          if (error instanceof Error && error.message.startsWith("{")) {
            try {
              const errorData = JSON.parse(error.message);
              res.status(400).json({
                error: "Validation failed",
                message: errorData.message,
                missingFields: errorData.missingFields,
              });
              return;
            } catch (parseError: unknown) {
              logger.error(parseError, "Error parsing validation error");
            }
          }

          // Fallback for other errors
          res.status(400).json({
            error: "Invalid input",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );

    // Effects library API
    this.router.get(
      "/effects",
      async (_req: ExpressRequest, res: ExpressResponse) => {
        try {
          const effectsDir = path.join(this.config.packageDirPath, "static", "effects");
          await fs.ensureDir(effectsDir);
          const files = await fs.readdir(effectsDir);
          const items = files
            .filter((f) => !f.startsWith("."))
            .map((f) => ({
              id: f.replace(/\.[^.]+$/, ""),
              fileName: f,
              staticEffectPath: `effects/${f}`,
              url: `/static/effects/${f}`,
            }));
          res.status(200).json({ effects: items });
        } catch (error) {
          res.status(500).json({ error: "Failed to list effects" });
        }
      }
    );

    // Upload effect: expects JSON { filename, data (base64), mimeType }
    this.router.post(
      "/effects",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { filename, data, mimeType } = req.body as { filename?: string; data?: string; mimeType?: string };
          if (!data) {
            res.status(400).json({ error: "'data' (base64) is required" });
            return;
          }

          const base64Content = data.includes(",") ? data.split(",")[1] : data;
          const buffer = Buffer.from(base64Content, "base64");
          const tmpName = `upload_${Date.now()}`;
          const ext = mimeType === "video/mp4" ? ".mp4" : mimeType === "video/webm" ? ".webm" : mimeType === "image/png" ? ".png" : mimeType === "image/jpeg" ? ".jpg" : (path.extname(filename || "") || ".mp4");
          const tmpPath = path.join(this.config.tempDirPath, `${tmpName}${ext}`);
          await fs.writeFile(tmpPath, buffer);

          // Use OverlayCache to place into static/effects
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { OverlayCache } = require("../../short-creator/effects/OverlayCache");
          const cache = new OverlayCache(this.config as any);
          const { staticEffectPath, publicUrl } = await cache.put(tmpPath);

          res.status(201).json({
            fileName: path.basename(staticEffectPath),
            staticEffectPath,
            url: publicUrl,
          });
        } catch (error) {
          this.config; // keep TS happy on unused
          res.status(500).json({ error: "Failed to upload effect" });
        }
      }
    );

    this.router.delete(
      "/effects/:id",
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { id } = req.params;
          if (!id) {
            res.status(400).json({ error: "id is required" });
            return;
          }
          const effectsDir = path.join(this.config.packageDirPath, "static", "effects");
          const candidates = await fs.readdir(effectsDir);
          const match = candidates.find((f) => f.startsWith(id));
          if (!match) {
            res.status(404).json({ error: "effect not found" });
            return;
          }
          await fs.remove(path.join(effectsDir, match));
          res.status(200).json({ success: true });
        } catch (error) {
          res.status(500).json({ error: "Failed to delete effect" });
        }
      }
    );

    this.router.get(
      "/short-video/:videoId/status",
      async (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        const status = this.shortCreator.status(videoId);
        res.status(200).json({
          status,
        });
      },
    );

    this.router.get(
      "/music-tags",
      (req: ExpressRequest, res: ExpressResponse) => {
        res.status(200).json(this.shortCreator.ListAvailableMusicTags());
      },
    );

    this.router.get("/voices", (req: ExpressRequest, res: ExpressResponse) => {
      res.status(200).json(this.shortCreator.ListAvailableVoices());
    });

    this.router.get(
      "/short-videos",
      (req: ExpressRequest, res: ExpressResponse) => {
        const videos = this.shortCreator.listAllVideos();
        res.status(200).json({
          videos,
        });
      },
    );

    this.router.delete(
      "/short-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { videoId } = req.params;
        if (!videoId) {
          res.status(400).json({
            error: "videoId is required",
          });
          return;
        }
        this.shortCreator.deleteVideo(videoId);
        res.status(200).json({
          success: true,
        });
      },
    );

    this.router.get(
      "/tmp/:tmpFile",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { tmpFile } = req.params;
        if (!tmpFile) {
          res.status(400).json({
            error: "tmpFile is required",
          });
          return;
        }
        const tmpFilePath = path.join(this.config.tempDirPath, tmpFile);
        if (!fs.existsSync(tmpFilePath)) {
          res.status(404).json({
            error: "tmpFile not found",
          });
          return;
        }

        if (tmpFile.endsWith(".mp3")) {
          res.setHeader("Content-Type", "audio/mpeg");
        }
        if (tmpFile.endsWith(".wav")) {
          res.setHeader("Content-Type", "audio/wav");
        }
        if (tmpFile.endsWith(".mp4")) {
          res.setHeader("Content-Type", "video/mp4");
        }

        const tmpFileStream = fs.createReadStream(tmpFilePath);
        tmpFileStream.on("error", (error) => {
          logger.error(error, "Error reading tmp file");
          res.status(500).json({
            error: "Error reading tmp file",
            tmpFile,
          });
        });
        tmpFileStream.pipe(res);
      },
    );

    this.router.get(
      "/music/:fileName",
      (req: ExpressRequest, res: ExpressResponse) => {
        const { fileName } = req.params;
        if (!fileName) {
          res.status(400).json({
            error: "fileName is required",
          });
          return;
        }
        const musicFilePath = path.join(this.config.musicDirPath, fileName);
        if (!fs.existsSync(musicFilePath)) {
          res.status(404).json({
            error: "music file not found",
          });
          return;
        }
        const musicFileStream = fs.createReadStream(musicFilePath);
        musicFileStream.on("error", (error) => {
          logger.error(error, "Error reading music file");
          res.status(500).json({
            error: "Error reading music file",
            fileName,
          });
        });
        musicFileStream.pipe(res);
      },
    );

    this.router.get(
      "/short-video/:videoId",
      (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { videoId } = req.params;
          if (!videoId) {
            res.status(400).json({
              error: "videoId is required",
            });
            return;
          }
          const video = this.shortCreator.getVideo(videoId);
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader(
            "Content-Disposition",
            `inline; filename=${videoId}.mp4`,
          );
          res.send(video);
        } catch (error: unknown) {
          logger.error(error, "Error getting video");
          res.status(404).json({
            error: "Video not found",
          });
        }
      },
    );
  }
}
