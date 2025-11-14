/**
 * Video Enhancer
 *
 * Creates final enhanced video by combining:
 * - Original video clip (muted or low volume)
 * - AI-generated narrative (TTS via Kokoro)
 * - Subtitles (Whisper)
 * - Text overlays
 * - Effects
 *
 * Integrates with existing ShortCreator infrastructure
 */

import path from 'path';
import pino from 'pino';
import { randomUUID } from 'crypto';
import {
  VideoEnhancementInput,
  EnhancedClip,
  EnhancementError,
  EnhancementErrorCode
} from '../types/narrative-enhancement';
import { ShortCreator } from '../../short-creator/ShortCreator';
import { Kokoro } from '../../short-creator/libraries/Kokoro';
import { Whisper } from '../../short-creator/libraries/Whisper';

const logger = pino({ name: 'VideoEnhancer' });

export class VideoEnhancer {
  constructor(
    private shortCreator: ShortCreator,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private outputDir: string
  ) {}

  /**
   * Enhance clip with AI narrative
   */
  async enhanceClip(
    input: VideoEnhancementInput,
    metadata: {
      clipId: string;
      startTime: number;
      endTime: number;
      originalTranscript: string;
      visualAnalysis: any;
      score: number;
    }
  ): Promise<Omit<EnhancedClip, 'enhancedAt' | 'enhancementDuration'>> {
    const startTime = Date.now();

    logger.info({
      clipId: metadata.clipId,
      narrativeLength: input.narrative.text.length
    }, 'Enhancing clip');

    try {
      // 1. Generate TTS audio for narrative
      const { audioPath, duration: audioDuration } = await this.generateNarrativeAudio(
        input.narrative.text,
        input.options.voice || 'af_heart'
      );

      logger.info({
        clipId: metadata.clipId,
        duration: audioDuration
      }, 'Narrative audio generated');

      // 2. Create subtitles for narrative
      const subtitles = input.options.addSubtitles
        ? await this.generateSubtitles(audioPath)
        : null;

      // 3. Prepare text overlays
      const textOverlays = this.prepareTextOverlays(
        input.options.textOverlays || [],
        input.narrative.text
      );

      // 4. Create enhanced video using ShortCreator
      const enhancedPath = await this.createEnhancedVideo({
        originalClipPath: input.originalClipPath,
        narrativeAudioPath: audioPath,
        narrativeText: input.narrative.text,
        subtitles,
        textOverlays,
        effects: input.options.effects || [],
        orientation: input.orientation,
        keepOriginalAudio: input.options.keepOriginalAudio || false,
        originalAudioVolume: input.options.originalAudioVolume || 0.2,
        clipId: metadata.clipId
      });

      logger.info({
        clipId: metadata.clipId,
        path: enhancedPath
      }, 'Enhanced video created');

      // 5. Get video info
      const videoInfo = await this.getVideoInfo(enhancedPath);

      return {
        clipId: metadata.clipId,
        originalPath: input.originalClipPath,
        enhancedPath,
        enhancedUrl: `/api/video-analyzer/enhanced/${metadata.clipId}`,
        startTime: metadata.startTime,
        endTime: metadata.endTime,
        duration: metadata.endTime - metadata.startTime,
        score: metadata.score,
        originalTranscript: metadata.originalTranscript,
        visualAnalysis: metadata.visualAnalysis,
        narrative: {
          ...input.narrative,
          audioPath,
          audioDuration
        },
        orientation: input.orientation,
        videoInfo,
        createdAt: new Date()
      };

    } catch (error: any) {
      logger.error({
        clipId: metadata.clipId,
        error: error.message
      }, 'Video enhancement failed');

      throw new EnhancementError(
        EnhancementErrorCode.VIDEO_CREATION_ERROR,
        `Failed to enhance video: ${error.message}`,
        { clipId: metadata.clipId }
      );
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Generate TTS audio for narrative
   */
  private async generateNarrativeAudio(
    text: string,
    voice: string
  ): Promise<{ audioPath: string; duration: number }> {
    logger.info({ voice, textLength: text.length }, 'Generating TTS');

    try {
      // Generate audio with Kokoro (cast voice string to VoiceEnum)
      const result = await this.kokoro.generate(text, voice as any);

      // Save audio to file
      const audioPath = path.join(
        this.outputDir,
        `narrative_${randomUUID()}.mp3`
      );

      // Convert ArrayBuffer to Buffer and save
      const buffer = Buffer.from(result.audio);
      await this.saveAudioBuffer(buffer, audioPath);

      // Calculate duration (approximate)
      const duration = this.estimateAudioDuration(text);

      return { audioPath, duration };

    } catch (error: any) {
      throw new EnhancementError(
        EnhancementErrorCode.TTS_ERROR,
        `TTS generation failed: ${error.message}`,
        { text, voice }
      );
    }
  }

  /**
   * Generate subtitles for narrative audio
   */
  private async generateSubtitles(audioPath: string): Promise<any> {
    logger.info({ audioPath }, 'Generating subtitles');

    try {
      // Use Whisper.CreateCaption from FantaProjekt
      const captions = await this.whisper.CreateCaption(audioPath);

      return captions;

    } catch (error: any) {
      logger.warn({
        error: error.message
      }, 'Subtitle generation failed, continuing without subtitles');
      return null;
    }
  }

  /**
   * Prepare text overlays (replace placeholders)
   */
  private prepareTextOverlays(
    overlays: any[],
    narrativeText: string
  ): any[] {
    return overlays.map(overlay => ({
      ...overlay,
      text: overlay.text.replace('{{narrative}}', narrativeText)
    }));
  }

  /**
   * Create enhanced video using ShortCreator
   */
  private async createEnhancedVideo(options: {
    originalClipPath: string;
    narrativeAudioPath: string;
    narrativeText: string;
    subtitles: any;
    textOverlays: any[];
    effects: any[];
    orientation: 'portrait' | 'landscape';
    keepOriginalAudio: boolean;
    originalAudioVolume: number;
    clipId: string;
  }): Promise<string> {
    logger.info({
      clipId: options.clipId
    }, 'Creating enhanced video via ShortCreator');

    // TODO: Integrate with ShortCreator API
    // For now, return placeholder path
    // This will be implemented when ShortCreator supports:
    // 1. Custom audio tracks (narrative)
    // 2. Audio mixing (original + narrative)
    // 3. Dynamic text overlays

    const enhancedPath = path.join(
      this.outputDir,
      `enhanced_${options.clipId}.mp4`
    );

    logger.warn({
      enhancedPath
    }, 'ShortCreator integration pending - using placeholder');

    // Placeholder: copy original clip
    // Real implementation will call ShortCreator.create() with:
    // - Original video as background
    // - Narrative audio overlaid
    // - Subtitles rendered
    // - Text overlays applied

    return enhancedPath;
  }

  /**
   * Get video info (resolution, codec, fps, filesize)
   */
  private async getVideoInfo(videoPath: string): Promise<{
    width: number;
    height: number;
    fps: number;
    codec: string;
    fileSize: number;
  }> {
    // TODO: Use ffprobe to get real video info
    // Placeholder for now
    return {
      width: 1080,
      height: 1920,
      fps: 30,
      codec: 'h264',
      fileSize: 0
    };
  }

  /**
   * Save audio buffer to file
   */
  private async saveAudioBuffer(buffer: Buffer, outputPath: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, buffer);
  }

  /**
   * Estimate audio duration from text
   */
  private estimateAudioDuration(text: string): number {
    // Russian: ~180 words/min = 3 words/sec
    const words = text.split(/\s+/).length;
    return words / 3;
  }
}
