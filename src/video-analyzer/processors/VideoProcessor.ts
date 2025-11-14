/**
 * Video Processor
 *
 * Handles video processing operations for clip generation:
 * - Extracting audio from video
 * - Creating vertical clips (9:16 aspect ratio)
 * - Video metadata extraction
 * - Video validation
 *
 * Extends FFmpeg functionality specifically for video-analyzer module.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import { existsSync } from 'fs';
import pino from 'pino';
import {
  VideoMetadata,
  ClipProcessingOptions,
  VideoAnalyzerError,
  VideoAnalyzerErrorCode
} from '../types/video-analysis';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const logger = pino({ name: 'VideoProcessor' });

export class VideoProcessor {
  private defaultProcessingOptions: ClipProcessingOptions;

  constructor(options?: Partial<ClipProcessingOptions>) {
    this.defaultProcessingOptions = {
      width: 1080,
      height: 1920,
      codec: 'libx264',
      preset: 'medium',
      crf: 23,
      audioBitrate: '128k',
      ...options
    };

    logger.info({
      ffmpegPath: ffmpegInstaller.path,
      defaultOptions: this.defaultProcessingOptions
    }, 'VideoProcessor initialized');
  }

  /**
   * Extract audio from video file
   * @param videoPath Path to video file
   * @param outputPath Path for output audio file
   * @returns Path to extracted audio file
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<string> {
    logger.info({ videoPath, outputPath }, 'Extracting audio from video');

    if (!existsSync(videoPath)) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.INVALID_INPUT,
        `Video file not found: ${videoPath}`
      );
    }

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')  // WAV format with 16-bit PCM
        .audioChannels(1)          // Mono (Whisper works better with mono)
        .audioFrequency(16000)     // 16kHz sample rate (required by Whisper)
        .output(outputPath)
        .on('end', () => {
          logger.info({ outputPath }, 'Audio extraction complete');
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error({ videoPath, error }, 'Audio extraction failed');
          reject(new VideoAnalyzerError(
            VideoAnalyzerErrorCode.ANALYSIS_FAILED,
            `Failed to extract audio: ${error.message}`,
            { originalError: error }
          ));
        })
        .run();
    });
  }

  /**
   * Create vertical clip (9:16 aspect ratio) from video
   * @param inputPath Input video path
   * @param outputPath Output clip path
   * @param start Start time in seconds
   * @param end End time in seconds
   * @param options Processing options (optional)
   * @returns Path to generated clip
   */
  async createVerticalClip(
    inputPath: string,
    outputPath: string,
    start: number,
    end: number,
    options?: Partial<ClipProcessingOptions>
  ): Promise<string> {
    const opts = { ...this.defaultProcessingOptions, ...options };

    logger.info({
      inputPath,
      outputPath,
      start,
      end,
      duration: end - start,
      options: opts
    }, 'Creating vertical clip');

    if (!existsSync(inputPath)) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.INVALID_INPUT,
        `Video file not found: ${inputPath}`
      );
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(start)
        .setDuration(end - start)
        // Video filters: scale to fill vertical frame, then crop
        .videoFilters([
          `scale=${opts.width}:${opts.height}:force_original_aspect_ratio=increase`,
          `crop=${opts.width}:${opts.height}`
        ])
        // Video codec options
        .videoCodec(opts.codec)
        .outputOptions([
          `-preset ${opts.preset}`,
          `-crf ${opts.crf}`,
          '-pix_fmt yuv420p', // Compatibility
          '-movflags +faststart' // Enable streaming
        ])
        // Audio options
        .audioCodec('aac')
        .audioBitrate(opts.audioBitrate)
        .output(outputPath)
        .on('progress', (progress) => {
          logger.debug({
            percent: progress.percent,
            timemark: progress.timemark
          }, 'Clip generation progress');
        })
        .on('end', () => {
          logger.info({ outputPath }, 'Vertical clip created successfully');
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error({ inputPath, outputPath, error }, 'Clip generation failed');
          reject(new VideoAnalyzerError(
            VideoAnalyzerErrorCode.CLIP_GENERATION_FAILED,
            `Failed to create clip: ${error.message}`,
            { originalError: error }
          ));
        })
        .run();
    });
  }

  /**
   * Create landscape clip (16:9 aspect ratio) from video
   * @param inputPath Input video path
   * @param outputPath Output clip path
   * @param start Start time in seconds
   * @param end End time in seconds
   * @returns Path to generated clip
   */
  async createLandscapeClip(
    inputPath: string,
    outputPath: string,
    start: number,
    end: number
  ): Promise<string> {
    const landscapeOptions: ClipProcessingOptions = {
      width: 1920,
      height: 1080,
      codec: this.defaultProcessingOptions.codec,
      preset: this.defaultProcessingOptions.preset,
      crf: this.defaultProcessingOptions.crf,
      audioBitrate: this.defaultProcessingOptions.audioBitrate
    };

    return this.createVerticalClip(inputPath, outputPath, start, end, landscapeOptions);
  }

  /**
   * Get video metadata using FFprobe
   * @param videoPath Path to video file
   * @returns Video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    logger.info({ videoPath }, 'Getting video metadata');

    if (!existsSync(videoPath)) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.INVALID_INPUT,
        `Video file not found: ${videoPath}`
      );
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          logger.error({ videoPath, error }, 'FFprobe failed');
          reject(new VideoAnalyzerError(
            VideoAnalyzerErrorCode.INVALID_INPUT,
            `Failed to read video metadata: ${error.message}`,
            { originalError: error }
          ));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');

        if (!videoStream) {
          reject(new VideoAnalyzerError(
            VideoAnalyzerErrorCode.INVALID_INPUT,
            'No video stream found in file'
          ));
          return;
        }

        const result: VideoMetadata = {
          duration: metadata.format.duration || 0,
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          fps: this.parseFps(videoStream.r_frame_rate),
          filesize: metadata.format.size,
          format: metadata.format.format_name,
          codec: videoStream.codec_name,
          bitrate: metadata.format.bit_rate
        };

        logger.debug(result, 'Video metadata extracted');
        resolve(result);
      });
    });
  }

  /**
   * Validate video file
   * @param videoPath Path to video file
   * @param maxDuration Max allowed duration in seconds
   * @param maxFileSize Max allowed file size in bytes
   * @throws VideoAnalyzerError if validation fails
   */
  async validateVideo(
    videoPath: string,
    maxDuration: number = 7200, // 2 hours
    maxFileSize: number = 2 * 1024 * 1024 * 1024 // 2GB
  ): Promise<VideoMetadata> {
    const metadata = await this.getVideoMetadata(videoPath);

    // Check duration
    if (metadata.duration > maxDuration) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.VIDEO_TOO_LONG,
        `Video duration (${Math.round(metadata.duration)}s) exceeds maximum (${maxDuration}s)`
      );
    }

    // Check file size
    if (metadata.filesize && metadata.filesize > maxFileSize) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.FILE_TOO_LARGE,
        `File size (${Math.round(metadata.filesize / (1024 * 1024))}MB) exceeds maximum (${Math.round(maxFileSize / (1024 * 1024))}MB)`
      );
    }

    logger.info({
      duration: metadata.duration,
      filesize: metadata.filesize,
      resolution: `${metadata.width}x${metadata.height}`
    }, 'Video validation passed');

    return metadata;
  }

  /**
   * Parse FFmpeg frame rate string (e.g., "30000/1001" or "30")
   * @param fpsString Frame rate string
   * @returns FPS as number
   */
  private parseFps(fpsString?: string): number {
    if (!fpsString) return 30;

    if (fpsString.includes('/')) {
      const [num, den] = fpsString.split('/').map(Number);
      return Math.round((num / den) * 100) / 100;
    }

    return parseFloat(fpsString);
  }

  /**
   * Get processing options
   * @returns Current default processing options
   */
  getDefaultOptions(): ClipProcessingOptions {
    return { ...this.defaultProcessingOptions };
  }

  /**
   * Update default processing options
   * @param options Partial processing options to update
   */
  setDefaultOptions(options: Partial<ClipProcessingOptions>): void {
    this.defaultProcessingOptions = {
      ...this.defaultProcessingOptions,
      ...options
    };

    logger.info(this.defaultProcessingOptions, 'Default processing options updated');
  }
}

/**
 * Factory function to create VideoProcessor from env config
 */
export function createVideoProcessor(): VideoProcessor {
  const preset = (process.env.FFMPEG_PRESET || 'medium') as string;
  const crf = parseInt(process.env.FFMPEG_CRF || '23', 10);

  return new VideoProcessor({
    preset,
    crf
  });
}
