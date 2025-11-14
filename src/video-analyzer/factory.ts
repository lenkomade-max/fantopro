/**
 * Video Analyzer Factory
 *
 * Creates and initializes VideoAnalyzer instance with all dependencies.
 * Integrates with existing FantaProjekt infrastructure.
 */

import path from 'path';
import pino from 'pino';
import { Whisper } from '../short-creator/libraries/Whisper';
import { VideoAnalyzer } from './VideoAnalyzer';
import { YouTubeDownloader } from './youtube/YouTubeDownloader';
import { TextAnalyzer } from './analyzers/TextAnalyzer';
import { AudioAnalyzer } from './analyzers/AudioAnalyzer';
import { VisualAnalyzer } from './analyzers/VisualAnalyzer';
import { VideoProcessor } from './processors/VideoProcessor';
import { ClipGenerator } from './processors/ClipGenerator';
import { VideoAnalyzerConfig, DEFAULT_ANALYZER_CONFIG } from './types/video-analysis';

const logger = pino({ name: 'VideoAnalyzerFactory' });

/**
 * Create VideoAnalyzer instance with all dependencies
 * @param whisper WhisperLibrary instance (from existing FantaProjekt)
 * @param config Optional configuration overrides
 * @returns Initialized VideoAnalyzer
 */
export async function createVideoAnalyzer(
  whisper: Whisper,
  config?: Partial<VideoAnalyzerConfig>
): Promise<VideoAnalyzer> {
  logger.info('Initializing VideoAnalyzer...');

  // Merge config with defaults and environment variables
  const finalConfig: VideoAnalyzerConfig = {
    ...DEFAULT_ANALYZER_CONFIG,
    ...config,
    enabled: process.env.VIDEO_ANALYZER_ENABLED === 'true',
    maxDuration: parseInt(process.env.VIDEO_ANALYZER_MAX_DURATION || '1800', 10),
    maxFileSize: parseInt(process.env.VIDEO_ANALYZER_MAX_FILE_SIZE || '1073741824', 10),
    storageDir: process.env.VIDEO_ANALYZER_STORAGE || './static/video-analyzer',
    retentionDays: parseInt(process.env.VIDEO_ANALYZER_RETENTION_DAYS || '3', 10)
  };

  logger.info(finalConfig, 'VideoAnalyzer configuration');

  // Initialize dependencies
  const youtubeDownloader = new YouTubeDownloader(
    finalConfig.storageDir,
    process.env.YOUTUBE_COOKIES_FILE
  );

  const textAnalyzer = new TextAnalyzer();
  const audioAnalyzer = new AudioAnalyzer();
  const visualAnalyzer = new VisualAnalyzer();

  const videoProcessor = new VideoProcessor({
    preset: finalConfig.processing.ffmpegPreset as any,
    crf: finalConfig.processing.outputCrf,
    audioBitrate: finalConfig.processing.audioBitrate
  });

  const clipGenerator = new ClipGenerator(
    videoProcessor,
    path.join(finalConfig.storageDir, 'clips')
  );

  // Create VideoAnalyzer
  const analyzer = new VideoAnalyzer(
    whisper,
    youtubeDownloader,
    textAnalyzer,
    audioAnalyzer,
    visualAnalyzer,
    videoProcessor,
    clipGenerator,
    finalConfig
  );

  logger.info('VideoAnalyzer initialized successfully');

  return analyzer;
}

/**
 * Check if VideoAnalyzer is enabled
 * @returns True if enabled in environment
 */
export function isVideoAnalyzerEnabled(): boolean {
  return process.env.VIDEO_ANALYZER_ENABLED === 'true';
}

/**
 * Get VideoAnalyzer configuration from environment
 * @returns Configuration object
 */
export function getVideoAnalyzerConfig(): Partial<VideoAnalyzerConfig> {
  return {
    enabled: process.env.VIDEO_ANALYZER_ENABLED === 'true',
    maxDuration: parseInt(process.env.VIDEO_ANALYZER_MAX_DURATION || '1800', 10),
    maxFileSize: parseInt(process.env.VIDEO_ANALYZER_MAX_FILE_SIZE || '1073741824', 10),
    storageDir: process.env.VIDEO_ANALYZER_STORAGE || './static/video-analyzer',
    retentionDays: parseInt(process.env.VIDEO_ANALYZER_RETENTION_DAYS || '3', 10),

    processing: {
      maxConcurrentClips: parseInt(process.env.VIDEO_ANALYZER_MAX_CONCURRENT_CLIPS || '2', 10),
      ffmpegPreset: (process.env.FFMPEG_PRESET || 'ultrafast') as any,
      outputCrf: parseInt(process.env.FFMPEG_CRF || '28', 10),
      audioBitrate: process.env.FFMPEG_AUDIO_BITRATE || '96k'
    }
  };
}
