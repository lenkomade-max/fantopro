import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";

import { Kokoro } from "./libraries/Kokoro";
import { Remotion } from "./libraries/Remotion";
import { OverlayRemotion } from "./libraries/OverlayRemotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import { ContentSourceFactory } from "./libraries/ContentSource";
import { EffectManager } from "./effects/EffectManager";
import { OverlayRenderer } from "../remotion/services/OverlayRenderer";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];
  private contentSourceFactory: ContentSourceFactory;
  private effectManager: EffectManager;

  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {
    this.contentSourceFactory = new ContentSourceFactory(config, pexelsApi);
    this.effectManager = new EffectManager(config);
  }

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(sceneInput: SceneInput[], config: RenderConfig): string {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    const scenes: any[] = [];
    let totalDuration = 0;
    const excludeVideoIds: string[] = [];
    const tempFiles: string[] = [];
    const contentSources: Array<{ cleanup?: () => Promise<void> }> = [];
    const effectManagers: EffectManager[] = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    let index = 0;
    for (const scene of inputScenes) {
      try {
        const audio = await this.kokoro.generate(
          scene.text,
          config.voice ?? "af_heart",
        );
        let { audioLength } = audio;
        const { audio: audioStream } = audio;

        // add the paddingBack in seconds to the last scene
        if (index + 1 === inputScenes.length && config.paddingBack) {
          audioLength += config.paddingBack / 1000;
        }

        const tempId = cuid();
        const tempWavFileName = `${tempId}.wav`;
        const tempMp3FileName = `${tempId}.mp3`;
        const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
        const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
        tempFiles.push(tempWavPath, tempMp3Path);

        await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
        const captions = await this.whisper.CreateCaption(tempWavPath);
        await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);

        // Determine content source (backward compatibility)
        let contentSource;
        if (scene.media) {
          // NEW: Use flexible media source
          contentSource = this.contentSourceFactory.create(scene.media);
        } else if (scene.searchTerms) {
          // LEGACY: Use searchTerms for Pexels
          contentSource = this.contentSourceFactory.createFromLegacySearchTerms(
            scene.searchTerms,
          );
        } else {
          throw new Error("Either 'media' or 'searchTerms' must be provided");
        }

        contentSources.push(contentSource);

        // Get media files from content source
        const mediaFiles = await contentSource.getMedia({
          duration: audioLength,
          orientation,
          excludeIds: excludeVideoIds,
        });

        if (mediaFiles.length === 0) {
          throw new Error("No media files returned from content source");
        }

        // Use the first media file for now (multi-media support will come later)
        const primaryMedia = mediaFiles[0];
        logger.debug(
          { mediaFile: primaryMedia.filename, source: scene.media?.type || "pexels-legacy" },
          "Using media file for scene",
        );

        // Copy to temp location with expected filename for serving
        const tempVideoFileName = `${tempId}${path.extname(primaryMedia.filename)}`;
        const tempVideoPath = path.join(this.config.tempDirPath, tempVideoFileName);
        
        // Copy the media file to temp location
        await fs.copy(primaryMedia.localPath, tempVideoPath);
        tempFiles.push(tempVideoPath);

        // Process effects if any
        let processedEffects: any[] | undefined;
        if (scene.effects && scene.effects.length > 0) {
          const sceneEffectManager = new EffectManager(this.config);
          processedEffects = await sceneEffectManager.processEffects(scene.effects);
          effectManagers.push(sceneEffectManager);
          logger.debug({ effectCount: processedEffects.length }, "Processed scene effects");
        }

        // Build scene object
        const sceneData: any = {
          captions,
          video: `http://localhost:${this.config.port}/api/tmp/${tempVideoFileName}`,
          audio: {
            url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
            duration: audioLength,
          },
        };

        // Add effects if processed
        if (processedEffects && processedEffects.length > 0) {
          sceneData.effects = processedEffects;
          logger.debug(
            {
              sceneIndex: index,
              effectCount: processedEffects.length,
              effects: processedEffects.map(e => ({
                type: e.type,
                staticEffectPath: e.staticEffectPath,
                blendMode: e.blendMode,
                opacity: e.opacity
              }))
            },
            "Added processed effects to scene"
          );
        }

        // Add text overlays if any
        if (scene.textOverlays && scene.textOverlays.length > 0) {
          sceneData.textOverlays = scene.textOverlays;
          logger.debug({ overlayCount: scene.textOverlays.length }, "Added text overlays to scene");
        }

        scenes.push(sceneData);

        totalDuration += audioLength;
        index++;
      } catch (error) {
        logger.error({ error, sceneIndex: index }, "Error processing scene");
        throw error;
      }
    }

    if (config.paddingBack) {
      totalDuration += config.paddingBack / 1000;
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

    try {
      // Debug: Log that we're reaching overlay detection
      logger.info(
        {
          videoId,
          sceneCount: scenes.length,
          totalDuration,
          aboutToRunOverlayDetection: true,
        },
        "About to start overlay detection"
      );

      // Debug: Log scene data before overlay detection
      logger.info(
        {
          videoId,
          sceneCount: scenes.length,
          scenes: scenes.map((s, i) => ({
            index: i,
            hasEffects: !!(s as any).effects,
            effectCount: (s as any).effects?.length || 0,
            effects: (s as any).effects?.map((e: any) => ({
              type: e.type,
              staticEffectPath: e.staticEffectPath,
              blendMode: e.blendMode,
              opacity: e.opacity
            }))
          }))
        },
        "Scene data before overlay detection"
      );

      // Detect overlays and determine renderer with enhanced error handling
      let overlayDetection;
      try {
        logger.info({ videoId }, "Creating OverlayRenderer instance");
        const overlayRenderer = new OverlayRenderer(this.effectManager);
        
        logger.info({ videoId, sceneCount: scenes.length }, "Starting overlay detection");
        overlayDetection = await overlayRenderer.detectOverlays(scenes);
        
        logger.info(
          {
            overlayDetection,
            videoId,
            sceneCount: scenes.length,
            hasEffects: scenes.some(s => (s as any).effects && (s as any).effects.length > 0),
            totalEffects: scenes.reduce((sum, s) => sum + ((s as any).effects?.length || 0), 0),
          },
          "Overlay detection complete"
        );
      } catch (overlayError) {
        logger.error(
          {
            error: overlayError,
            videoId,
            sceneCount: scenes.length,
            hasEffects: scenes.some(s => (s as any).effects && (s as any).effects.length > 0),
            totalEffects: scenes.reduce((sum, s) => sum + ((s as any).effects?.length || 0), 0),
          },
          "Overlay detection failed, falling back to standard renderer"
        );
        
        // Fallback to standard renderer
        overlayDetection = {
          hasOverlays: false,
          overlayCount: 0,
          effects: [],
          recommendedRenderer: "standard" as const,
          reason: "Overlay detection failed, using fallback",
        };
      }

      // Choose renderer based on detection
      if (overlayDetection.recommendedRenderer === "overlay") {
        logger.info(
          {
            reason: overlayDetection.reason,
            overlayCount: overlayDetection.overlayCount,
            videoId,
          },
          "Using overlay renderer for enhanced stability"
        );

        // Initialize overlay-specific Remotion instance
        let overlayModuleRendered = false;
        try {
          logger.info({ videoId }, "Using overlay-effects module for rendering");
          // Lazy require new module facade to avoid NodeNext extension issues
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { OverlayEffects } = require("../../packages/overlay-effects/src/overlay-effects");
          await OverlayEffects.render(
            this.config,
            {
              music: selectedMusic,
              scenes,
              config: {
                durationMs: totalDuration * 1000,
                paddingBack: config.paddingBack,
                captionBackgroundColor: config.captionBackgroundColor,
                captionPosition: config.captionPosition,
                musicVolume: config.musicVolume,
              },
            },
            videoId,
            orientation,
          );
          overlayModuleRendered = true;
          logger.info({ videoId }, "overlay-effects module render completed");
        } catch (initError) {
          logger.error(
            { error: initError, videoId },
            "overlay-effects module failed, falling back to standard renderer"
          );
          // Fallback to standard renderer
          await this.remotion.render(
            {
              music: selectedMusic,
              scenes,
              config: {
                durationMs: totalDuration * 1000,
                paddingBack: config.paddingBack,
                captionBackgroundColor: config.captionBackgroundColor,
                captionPosition: config.captionPosition,
                musicVolume: config.musicVolume,
              },
            },
            videoId,
            orientation,
          );
          return videoId; // Exit early since we fell back to standard renderer
        }
        if (!overlayModuleRendered) {
          // Safety net already handled in catch, but keep branch structure intact
        }

        // Cleanup overlay renderer
        try {
          const overlayRenderer = new OverlayRenderer(this.effectManager);
          await overlayRenderer.cleanup();
        } catch (cleanupError) {
          logger.warn({ error: cleanupError, videoId }, "Failed to cleanup overlay renderer");
        }
      } else {
        logger.info(
          { reason: overlayDetection.reason, videoId },
          "Using standard renderer"
        );

        // Use standard Remotion renderer
        await this.remotion.render(
          {
            music: selectedMusic,
            scenes,
            config: {
              durationMs: totalDuration * 1000,
              paddingBack: config.paddingBack,
              captionBackgroundColor: config.captionBackgroundColor,
              captionPosition: config.captionPosition,
              musicVolume: config.musicVolume,
            },
          },
          videoId,
          orientation,
        );
      }
    } finally {
      // Cleanup temp files
      for (const file of tempFiles) {
        try {
          fs.removeSync(file);
        } catch (error) {
          logger.warn({ file, error }, "Failed to remove temp file");
        }
      }

      // Cleanup content sources
      for (const source of contentSources) {
        if (source.cleanup) {
          try {
            await source.cleanup();
          } catch (error) {
            logger.warn({ error }, "Failed to cleanup content source");
          }
        }
      }

      // Cleanup effect managers
      for (const effectMgr of effectManagers) {
        try {
          await effectMgr.cleanup();
        } catch (error) {
          logger.warn({ error }, "Failed to cleanup effect manager");
        }
      }
    }

    return videoId;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    return musicFiles[Math.floor(Math.random() * musicFiles.length)];
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }

  public listAllVideos(): { id: string; status: VideoStatus }[] {
    const videos: { id: string; status: VideoStatus }[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for MP4 files and extract video IDs
    for (const file of files) {
      if (file.endsWith(".mp4")) {
        const videoId = file.replace(".mp4", "");

        let status: VideoStatus = "ready";
        const inQueue = this.queue.find((item) => item.id === videoId);
        if (inQueue) {
          status = "processing";
        }

        videos.push({ id: videoId, status });
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push({ id: queueItem.id, status: "processing" });
      }
    }

    return videos;
  }

  public ListAvailableVoices(): string[] {
    return this.kokoro.listAvailableVoices();
  }
}
