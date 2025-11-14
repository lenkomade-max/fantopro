import http from "http";
import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import path from "path";
import { ShortCreator } from "../short-creator/ShortCreator";
import { APIRouter } from "./routers/rest";
import { MCPRouter } from "./routers/mcp";
import { logger } from "../logger";
import { Config } from "../config";
import { VideoAnalyzer } from "../video-analyzer/VideoAnalyzer";
import videoAnalyzerRouter from "./routers/video-analyzer";
import { initVideoAnalyzerRouter } from "./routers/video-analyzer";
import { HealthChecker } from "../monitoring";

export class Server {
  private app: express.Application;
  private config: Config;
  private healthChecker?: HealthChecker;

  constructor(
    config: Config,
    shortCreator: ShortCreator,
    videoAnalyzer?: VideoAnalyzer,
    healthChecker?: HealthChecker
  ) {
    this.config = config;
    this.healthChecker = healthChecker;
    this.app = express();

    // Increase payload size limit for large photo uploads
    this.app.use(express.json({ limit: '150mb' }));
    this.app.use(express.urlencoded({ limit: '150mb', extended: true }));

    // Enhanced health check endpoint
    this.app.get("/health", (_req: ExpressRequest, res: ExpressResponse) => {
      if (this.healthChecker) {
        const health = this.healthChecker.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } else {
        // Fallback to simple health check
        res.status(200).json({ status: "ok" });
      }
    });

    const apiRouter = new APIRouter(config, shortCreator);
    const mcpRouter = new MCPRouter(shortCreator);
    this.app.use("/api", apiRouter.router);
    this.app.use("/mcp", mcpRouter.router);

    // Video Analyzer router (optional)
    if (videoAnalyzer) {
      logger.info("Initializing Video Analyzer API routes");
      const analyzerRouter = initVideoAnalyzerRouter(videoAnalyzer);
      this.app.use("/api/video-analyzer", analyzerRouter);
    } else {
      logger.info("Video Analyzer is disabled");
    }

    // Serve static files from the UI build
    this.app.use(express.static(path.join(__dirname, "../../dist/ui")));
    this.app.use(
      "/static",
      express.static(path.join(__dirname, "../../static")),
    );

    // Serve local overlay assets (VHS/arrow) for blend effects
    // This allows using overlayUrl: "http://localhost:<port>/overlays/<file>"
    this.app.use(
      "/overlays",
      express.static("/root/media-video-maker-test"),
    );

    // Serve the React app for all other routes (must be last)
    this.app.get("*", (_req: ExpressRequest, res: ExpressResponse) => {
      res.sendFile(path.join(__dirname, "../../dist/ui/index.html"));
    });
  }

  public start(): http.Server {
    const server = this.app.listen(this.config.port, () => {
      logger.info(
        { port: this.config.port, mcp: "/mcp", api: "/api" },
        "MCP and API server is running",
      );
      logger.info(
        `UI server is running on http://localhost:${this.config.port}`,
      );
    });

    server.on("error", (error: Error) => {
      logger.error(error, "Error starting server");
    });

    return server;
  }

  public getApp() {
    return this.app;
  }
}
