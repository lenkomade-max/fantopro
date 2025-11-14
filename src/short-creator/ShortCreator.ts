import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";

import { Kokoro } from "./libraries/Kokoro";
import { Remotion } from "./libraries/Remotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import { ContentSourceFactory } from "./libraries/ContentSource";
import { EffectManager } from "./effects/EffectManager";
import type { AlertManager, ProcessMonitor } from "../monitoring";
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
  private progressMap: Map<string, { progress: number; stage: string }> = new Map();
  private alertManager?: AlertManager;
  private processMonitor?: ProcessMonitor;

  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
    alertManager?: AlertManager,
  ) {
    this.contentSourceFactory = new ContentSourceFactory(config, pexelsApi);
    this.effectManager = new EffectManager(config);
    this.alertManager = alertManager;
  }

  /**
   * Set process monitor (called after ShortCreator creation)
   */
  public setProcessMonitor(processMonitor: ProcessMonitor): void {
    this.processMonitor = processMonitor;
  }

  public status(id: string): { status: VideoStatus; progress?: number; stage?: string } {
    const videoPath = this.getVideoPath(id);
    const progressInfo = this.progressMap.get(id);

    if (this.queue.find((item) => item.id === id)) {
      return {
        status: "processing",
        progress: progressInfo?.progress || 0,
        stage: progressInfo?.stage || "Initializing..."
      };
    }
    if (fs.existsSync(videoPath)) {
      // Clean up progress info for completed videos
      this.progressMap.delete(id);
      return { status: "ready", progress: 100 };
    }
    // Clean up progress info for failed videos
    this.progressMap.delete(id);
    return { status: "failed", progress: 0 };
  }

  private updateProgress(id: string, progress: number, stage: string): void {
    this.progressMap.set(id, { progress: Math.min(100, Math.max(0, progress)), stage });
    logger.debug({ videoId: id, progress, stage }, "Progress updated");

    // Update ProcessMonitor if available
    if (this.processMonitor) {
      this.processMonitor.updateProcess(id, progress, stage, 'processing');
    }
  }

  public addToQueue(sceneInput: SceneInput[], config: RenderConfig): string {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
    });

    // Register process in monitor
    if (this.processMonitor) {
      this.processMonitor.registerProcess(id);
    }

    // Отправить уведомление о новом запросе
    if (this.alertManager) {
      this.alertManager.sendVideoRequestReceived(id, sceneInput.length).catch((error) => {
        logger.error(error, 'Failed to send video request notification');
      });
    }

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
      const duration = await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");

      // Mark process as completed in monitor
      if (this.processMonitor) {
        this.processMonitor.updateProcess(id, 100, 'Completed', 'completed');
        this.processMonitor.removeProcess(id);
      }

      // Отправить уведомление об успешном создании
      if (this.alertManager) {
        this.alertManager.sendVideoCreated(id, duration, sceneInput.length).catch((error) => {
          logger.error(error, 'Failed to send video created notification');
        });
      }
    } catch (error: unknown) {
      logger.error(error, "Error creating video");

      // Mark process as failed in monitor
      if (this.processMonitor) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.processMonitor.updateProcess(id, 0, `Failed: ${errorMsg}`, 'failed');
        this.processMonitor.removeProcess(id);
      }

      // Отправить уведомление об ошибке
      if (this.alertManager) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.alertManager.sendVideoCreationFailed(id, err, sceneInput.length).catch((alertError) => {
          logger.error(alertError, 'Failed to send video creation failed notification');
        });
      }
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<number> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );

    // Initialize progress
    this.updateProgress(videoId, 0, "Starting video creation...");

    const scenes: any[] = [];
    let totalDuration = 0;
    const excludeVideoIds: string[] = [];
    const tempFiles: string[] = [];
    const contentSources: Array<{ cleanup?: () => Promise<void> }> = [];
    const effectManagers: EffectManager[] = [];
    const allProcessedEffects: any[] = []; // Collect all effects for FFmpeg post-processing

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    const totalScenes = inputScenes.length;
    let index = 0;
    for (const scene of inputScenes) {
      try {
        // Progress: 0-30% for TTS generation
        const ttsProgress = (index / totalScenes) * 30;
        this.updateProgress(videoId, ttsProgress, `Generating voice for scene ${index + 1}/${totalScenes}...`);

        const audio = await this.kokoro.generate(
          scene.text,
          config.voice ?? "af_heart",
        );
        let { audioLength } = audio;
        let { audio: audioStream } = audio;

        // Apply voice speed change if specified (1.0-1.5x)
        const voiceSpeed = config.voiceSpeed ?? 1.0;
        if (voiceSpeed !== 1.0) {
          logger.info({ voiceSpeed, scene: index + 1 }, "Applying voice speed change");
          audioStream = await this.ffmpeg.changeAudioSpeed(audioStream, voiceSpeed);
          // Adjust audio length based on speed (faster = shorter duration)
          audioLength = audioLength / voiceSpeed;
          logger.debug({ originalLength: audioLength * voiceSpeed, newLength: audioLength, voiceSpeed }, "Audio length adjusted for speed");
        }

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

        // Progress: 30-40% for subtitles generation
        const subtitlesProgress = 30 + (index / totalScenes) * 10;
        this.updateProgress(videoId, subtitlesProgress, `Generating subtitles for scene ${index + 1}/${totalScenes}...`);

        const captions = await this.whisper.CreateCaption(tempWavPath);
        await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);

        // Progress: 40-50% for media acquisition
        const mediaProgress = 40 + (index / totalScenes) * 10;
        this.updateProgress(videoId, mediaProgress, `Getting media for scene ${index + 1}/${totalScenes}...`);

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

        // Check if mediaDuration is specified (multi-media looping support)
        const useMultiMedia = scene.mediaDuration !== undefined;

        let mediaUrls: string[] = [];

        if (useMultiMedia) {
          // NEW: Multi-media support with looping
          logger.debug(
            {
              mediaCount: mediaFiles.length,
              mediaDuration: scene.mediaDuration,
              source: scene.media?.type || "pexels-legacy"
            },
            "Using multi-media mode with looping",
          );

          // Copy all media files to temp location
          for (let i = 0; i < mediaFiles.length; i++) {
            const mediaFile = mediaFiles[i];
            const tempMediaFileName = `${tempId}_${i}${path.extname(mediaFile.filename)}`;
            const tempMediaPath = path.join(this.config.tempDirPath, tempMediaFileName);

            await fs.copy(mediaFile.localPath, tempMediaPath);
            tempFiles.push(tempMediaPath);

            mediaUrls.push(`http://localhost:${this.config.port}/api/tmp/${tempMediaFileName}`);
          }
        } else {
          // LEGACY: Use only the first media file
          const primaryMedia = mediaFiles[0];
          logger.debug(
            { mediaFile: primaryMedia.filename, source: scene.media?.type || "pexels-legacy" },
            "Using single media file for scene",
          );

          const tempVideoFileName = `${tempId}${path.extname(primaryMedia.filename)}`;
          const tempVideoPath = path.join(this.config.tempDirPath, tempVideoFileName);

          await fs.copy(primaryMedia.localPath, tempVideoPath);
          tempFiles.push(tempVideoPath);

          mediaUrls.push(`http://localhost:${this.config.port}/api/tmp/${tempVideoFileName}`);
        }

        // Process effects if any
        let processedEffects: any[] | undefined;
        if (scene.effects && scene.effects.length > 0) {
          const sceneEffectManager = new EffectManager(this.config);
          processedEffects = await sceneEffectManager.processEffects(scene.effects);
          effectManagers.push(sceneEffectManager);
          // Collect effects for FFmpeg post-processing
          allProcessedEffects.push(...processedEffects);
          logger.debug({ effectCount: processedEffects.length }, "Processed scene effects");
        }

        // Build scene object
        const sceneData: any = {
          captions,
          audio: {
            url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
            duration: audioLength,
          },
        };

        // Add media URLs based on mode
        if (useMultiMedia) {
          sceneData.videos = mediaUrls;
          sceneData.mediaDuration = scene.mediaDuration;
        } else {
          sceneData.video = mediaUrls[0];
        }

        // Don't add effects to sceneData - they will be applied via FFmpeg post-processing
        if (processedEffects && processedEffects.length > 0) {
          // sceneData.effects = processedEffects;  // DISABLED - effects via FFmpeg
          logger.debug(
            {
              sceneIndex: index,
              effectCount: processedEffects.length,
              effects: processedEffects.map(e => ({
                type: e.type,
                localPath: e.localPath,
                blendMode: e.blendMode,
                opacity: e.opacity
              }))
            },
            "Effects will be applied via FFmpeg post-processing (not in Remotion)"
          );
        }

        // Add text overlays if any
        if (scene.textOverlays && scene.textOverlays.length > 0) {
          sceneData.textOverlays = scene.textOverlays;
          logger.debug({ overlayCount: scene.textOverlays.length }, "Added text overlays to scene");
        }

        // Add advanced text overlays if any (multi-color/multi-style text)
        if (scene.advancedTextOverlays && scene.advancedTextOverlays.length > 0) {
          sceneData.advancedTextOverlays = scene.advancedTextOverlays;
          logger.debug({ overlayCount: scene.advancedTextOverlays.length }, "Added advanced text overlays to scene");
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

      // ========================================
      // IMPORTANT: Always use standard renderer WITHOUT effects
      // Effects will be applied via FFmpeg post-processing
      // ========================================
      logger.info({ videoId, effectCount: allProcessedEffects.length }, "Using standard renderer (effects via FFmpeg post-processing)");

      // Progress: 50-85% for Remotion rendering
      this.updateProgress(videoId, 50, "Rendering video with Remotion...");

      // Use standard Remotion renderer (NO effects in Remotion)
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

      this.updateProgress(videoId, 85, "Remotion rendering complete!");

      // ========================================
      // FFmpeg Post-Processing (Blend + Chromakey)
      // ========================================
      if (allProcessedEffects.length > 0) {
        logger.info({ videoId, effectCount: allProcessedEffects.length }, "Starting FFmpeg post-processing");
        this.updateProgress(videoId, 85, "Applying visual effects...");

        let currentVideoPath = this.getVideoPath(videoId);

        // Separate effects by type
        const blendEffects = allProcessedEffects.filter(e => e.type === "blend");
        const bannerEffects = allProcessedEffects.filter(e => e.type === "banner_overlay");
        const totalEffects = blendEffects.length + bannerEffects.length;
        let effectIndex = 0;

        // Apply blend overlays first
        for (const effect of blendEffects) {
          effectIndex++;
          const effectProgress = 85 + ((effectIndex / totalEffects) * 10);
          this.updateProgress(videoId, effectProgress, `Applying effect ${effectIndex}/${totalEffects}...`);

          logger.info({
            blendMode: effect.blendMode,
            opacity: effect.opacity,
            overlayPath: effect.localPath
          }, "Applying FFmpeg blend overlay");

          const outputPath = await this.effectManager.applyBlendOverlay(
            currentVideoPath,
            effect.localPath,
            effect.blendMode,
            effect.opacity,
            orientation === OrientationEnum.portrait ? 1080 : 1920,
            orientation === OrientationEnum.portrait ? 1920 : 1080
          );

          // Replace original with blended version
          if (currentVideoPath !== this.getVideoPath(videoId)) {
            // Clean up intermediate file
            fs.removeSync(currentVideoPath);
          }
          currentVideoPath = outputPath;

          logger.info({ outputPath }, "Blend overlay applied successfully");
        }

        // Apply banner chromakey overlays second (after blend)
        for (const effect of bannerEffects) {
          effectIndex++;
          const effectProgress = 85 + ((effectIndex / totalEffects) * 10);
          this.updateProgress(videoId, effectProgress, `Applying banner ${effectIndex}/${totalEffects}...`);

          logger.info({
            chromakey: effect.chromakey,
            position: effect.position,
            bannerPath: effect.localPath
          }, "Applying FFmpeg banner chromakey");

          const outputPath = await this.effectManager.applyBannerChromakey(
            currentVideoPath,
            effect.localPath,
            effect.chromakey.similarity,
            effect.chromakey.blend,
            effect.position,
            effect.duration,
            orientation
          );

          // Replace original with chromakeyed version
          if (currentVideoPath !== this.getVideoPath(videoId)) {
            // Clean up intermediate file
            fs.removeSync(currentVideoPath);
          }
          currentVideoPath = outputPath;

          logger.info({ outputPath }, "Banner chromakey applied successfully");
        }

        // Replace final video
        const finalVideoPath = this.getVideoPath(videoId);
        if (currentVideoPath !== finalVideoPath) {
          await fs.move(currentVideoPath, finalVideoPath, { overwrite: true });
          logger.info({ finalVideoPath }, "FFmpeg post-processing complete, final video saved");
        }

        this.updateProgress(videoId, 95, "Effects applied successfully!");
      } else {
        // No effects, skip to finalization
        this.updateProgress(videoId, 95, "Finalizing video...");
      }

      // Final progress update
      this.updateProgress(videoId, 100, "Video complete!");
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

    return totalDuration;
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
