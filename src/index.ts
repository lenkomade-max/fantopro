/* eslint-disable @typescript-eslint/no-unused-vars */
import path from "path";
import fs from "fs-extra";

import { Kokoro } from "./short-creator/libraries/Kokoro";
import { Remotion } from "./short-creator/libraries/Remotion";
import { Whisper } from "./short-creator/libraries/Whisper";
import { FFMpeg } from "./short-creator/libraries/FFmpeg";
import { PexelsAPI } from "./short-creator/libraries/Pexels";
import { Config } from "./config";
import { ShortCreator } from "./short-creator/ShortCreator";
import { logger } from "./logger";
import { Server } from "./server/server";
import { MusicManager } from "./short-creator/music";
import { AlertManager, HealthChecker, ProcessMonitor, TelegramBotController } from "./monitoring";

async function main() {
  const config = new Config();

  // Initialize monitoring
  const alertManager = new AlertManager({
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    enabled: process.env.MONITORING_ENABLED === 'true',
    serverName: 'FantaProjekt API',
    port: config.port,
  });

  const healthChecker = new HealthChecker();

  // Setup process error handlers
  process.on('uncaughtException', async (error: Error) => {
    logger.fatal(error, 'Uncaught Exception - Server will exit');
    await alertManager.sendUncaughtException(error);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason: unknown) => {
    logger.error({ reason }, 'Unhandled Promise Rejection');
    await alertManager.sendUnhandledRejection(reason);
  });

  let processMonitor: ProcessMonitor | undefined;
  let botController: TelegramBotController | undefined;

  const shutdown = async (signal: string) => {
    logger.info(`${signal} signal received - shutting down gracefully`);
    await alertManager.sendAlert({
      type: 'warning',
      message: `⚠️ Сервер получил ${signal} и завершает работу`,
    });

    // Stop monitoring components
    if (processMonitor) {
      processMonitor.stop();
    }
    if (botController) {
      await botController.stop();
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  try {
    config.ensureConfig();
  } catch (err: unknown) {
    logger.error(err, "Error in config");
    process.exit(1);
  }

  const musicManager = new MusicManager(config);
  try {
    logger.debug("checking music files");
    musicManager.ensureMusicFilesExist();
  } catch (error: unknown) {
    logger.error(error, "Missing music files");
    process.exit(1);
  }

  logger.debug("initializing remotion");
  const remotion = await Remotion.init(config);
  logger.debug("initializing kokoro");
  const kokoro = await Kokoro.init(config.kokoroModelPrecision);
  logger.debug("initializing whisper");
  const whisper = await Whisper.init(config);
  logger.debug("initializing ffmpeg");
  const ffmpeg = await FFMpeg.init();
  const pexelsApi = new PexelsAPI(config.pexelsApiKey);

  logger.debug("initializing the short creator");
  const shortCreator = new ShortCreator(
    config,
    remotion,
    kokoro,
    whisper,
    ffmpeg,
    pexelsApi,
    musicManager,
    alertManager,
  );

  // Initialize ProcessMonitor
  logger.debug("initializing process monitor");
  processMonitor = new ProcessMonitor(shortCreator, alertManager);
  processMonitor.start();

  // Connect ProcessMonitor to ShortCreator
  shortCreator.setProcessMonitor(processMonitor);

  // Initialize TelegramBotController (if monitoring enabled)
  if (process.env.MONITORING_ENABLED === 'true' && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    logger.debug("initializing telegram bot controller");
    botController = new TelegramBotController(
      {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        enabled: true,
      },
      shortCreator,
      processMonitor,
      healthChecker,
      alertManager,
    );
  }

  // Initialize Video Analyzer (if enabled)
  let videoAnalyzer;
  if (process.env.VIDEO_ANALYZER_ENABLED === 'true') {
    logger.info("Initializing Video Analyzer module...");
    try {
      const { createVideoAnalyzer } = await import('./video-analyzer/factory.js');
      videoAnalyzer = await createVideoAnalyzer(whisper);
      logger.info("Video Analyzer initialized successfully");
    } catch (error) {
      logger.warn(error, "Failed to initialize Video Analyzer - module will be disabled");
    }
  }

  if (!config.runningInDocker) {
    // the project is running with npm - we need to check if the installation is correct
    if (fs.existsSync(config.installationSuccessfulPath)) {
      logger.info("the installation is successful - starting the server");
    } else {
      logger.info(
        "testing if the installation was successful - this may take a while...",
      );
      try {
        const audioBuffer = (await kokoro.generate("hi", "af_heart")).audio;
        await ffmpeg.createMp3DataUri(audioBuffer);
        await pexelsApi.findVideo(["dog"], 2.4);
        const testVideoPath = path.join(config.tempDirPath, "test.mp4");
        await remotion.testRender(testVideoPath);
        fs.rmSync(testVideoPath, { force: true });
        fs.writeFileSync(config.installationSuccessfulPath, "ok", {
          encoding: "utf-8",
        });
        logger.info("the installation was successful - starting the server");
      } catch (error: unknown) {
        logger.fatal(
          error,
          "The environment is not set up correctly - please follow the instructions in the README.md file https://github.com/gyoridavid/short-video-maker",
        );
        process.exit(1);
      }
    }
  }

  logger.debug("initializing the server");
  const server = new Server(config, shortCreator, videoAnalyzer, healthChecker);
  server.start();

  // Send notification that server started successfully
  await alertManager.sendServerStarted();
  logger.info('Server started successfully with monitoring enabled');
}

main().catch((error: unknown) => {
  logger.error(error, "Error starting server");
});
