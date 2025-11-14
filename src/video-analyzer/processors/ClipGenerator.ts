/**
 * Clip Generator
 *
 * Selects the most interesting moments from analyzed segments
 * and generates video clips using VideoProcessor.
 *
 * Features:
 * - Top-N moment selection based on combined score
 * - Context expansion (adding time before/after peak moment)
 * - Parallel clip generation for performance
 * - Deduplication (avoid overlapping clips)
 */

import path from 'path';
import { randomUUID } from 'crypto';
import pino from 'pino';
import {
  AnalyzedSegment,
  AnalysisOptions,
  ClipDefinition,
  GeneratedClip,
  VideoAnalyzerError,
  VideoAnalyzerErrorCode
} from '../types/video-analysis';
import { VideoProcessor } from './VideoProcessor';

const logger = pino({ name: 'ClipGenerator' });

export class ClipGenerator {
  private videoProcessor: VideoProcessor;
  private outputDir: string;

  constructor(videoProcessor: VideoProcessor, outputDir: string) {
    this.videoProcessor = videoProcessor;
    this.outputDir = outputDir;

    logger.info({ outputDir }, 'ClipGenerator initialized');
  }

  /**
   * Generate clips from analyzed segments
   * @param videoPath Path to source video
   * @param segments Analyzed segments with scores
   * @param options Analysis options
   * @param jobId Job ID for file naming
   * @returns Array of generated clips
   */
  async generateClips(
    videoPath: string,
    segments: AnalyzedSegment[],
    options: AnalysisOptions,
    jobId: string
  ): Promise<GeneratedClip[]> {
    logger.info({
      jobId,
      totalSegments: segments.length,
      options
    }, 'Starting clip generation');

    // 1. Select top moments
    const clipDefinitions = await this.selectTopMoments(segments, options, videoPath);

    if (clipDefinitions.length === 0) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.INSUFFICIENT_SEGMENTS,
        'No segments met the minimum score threshold'
      );
    }

    logger.info({
      jobId,
      clipsToGenerate: clipDefinitions.length,
      topScore: clipDefinitions[0]?.score
    }, 'Top moments selected');

    // 2. Generate clips in batches (parallel processing)
    const maxConcurrent = parseInt(
      process.env.VIDEO_ANALYZER_MAX_CONCURRENT_CLIPS || '3',
      10
    );

    const clips: GeneratedClip[] = [];

    for (let i = 0; i < clipDefinitions.length; i += maxConcurrent) {
      const batch = clipDefinitions.slice(i, i + maxConcurrent);

      logger.debug({
        jobId,
        batchStart: i,
        batchSize: batch.length
      }, 'Processing clip batch');

      const batchClips = await Promise.all(
        batch.map((definition, batchIdx) =>
          this.createClip(
            videoPath,
            definition,
            i + batchIdx,
            jobId,
            options.orientation || 'portrait'
          )
        )
      );

      clips.push(...batchClips);

      logger.info({
        jobId,
        completedClips: clips.length,
        totalClips: clipDefinitions.length
      }, 'Batch complete');
    }

    logger.info({
      jobId,
      totalClips: clips.length
    }, 'All clips generated successfully');

    return clips;
  }

  /**
   * Select top moments from analyzed segments
   * @param segments Analyzed segments
   * @param options Analysis options
   * @param videoPath Video path for duration calculation
   * @returns Clip definitions
   */
  private async selectTopMoments(
    segments: AnalyzedSegment[],
    options: AnalysisOptions,
    videoPath: string
  ): Promise<ClipDefinition[]> {
    // 1. Filter by minimum score
    const filtered = segments.filter(s =>
      s.scores.combined >= options.minScore
    );

    logger.debug({
      total: segments.length,
      filtered: filtered.length,
      minScore: options.minScore
    }, 'Segments filtered by minScore');

    if (filtered.length === 0) {
      return [];
    }

    // 2. Sort by combined score (descending)
    const sorted = [...filtered].sort((a, b) =>
      b.scores.combined - a.scores.combined
    );

    // 3. Select top-N
    const topMoments = sorted.slice(0, options.clipCount);

    // 4. Get video duration for boundary checking
    const metadata = await this.videoProcessor.getVideoMetadata(videoPath);
    const videoDuration = metadata.duration;

    // 5. Expand moments to target duration and create definitions
    const definitions = topMoments.map((moment, idx) => {
      const { startTime, endTime } = this.expandMoment(
        moment,
        options.clipDuration || 60,
        videoDuration
      );

      return {
        clipId: `clip-${String(idx).padStart(3, '0')}`,
        startTime,
        endTime,
        duration: endTime - startTime,
        score: moment.scores.combined,
        text: moment.text
      };
    });

    // 6. Remove overlapping clips (keep higher scored ones)
    const deduplicated = this.deduplicateClips(definitions);

    logger.info({
      selected: topMoments.length,
      afterDeduplication: deduplicated.length
    }, 'Top moments selected and deduplicated');

    return deduplicated;
  }

  /**
   * Expand moment to target duration with context
   * @param moment Analyzed segment
   * @param targetDuration Target clip duration
   * @param videoDuration Total video duration (for boundary checking)
   * @returns Expanded start and end times
   */
  private expandMoment(
    moment: AnalyzedSegment,
    targetDuration: number,
    videoDuration: number
  ): { startTime: number; endTime: number } {
    const currentDuration = moment.end - moment.start;

    if (currentDuration >= targetDuration) {
      // Already long enough, trim to exact duration
      return {
        startTime: moment.start,
        endTime: moment.start + targetDuration
      };
    }

    // Calculate padding needed
    const totalPadding = targetDuration - currentDuration;
    const paddingBefore = totalPadding / 2;
    const paddingAfter = totalPadding / 2;

    // Apply padding with boundary checks
    let startTime = Math.max(0, moment.start - paddingBefore);
    let endTime = Math.min(videoDuration, moment.end + paddingAfter);

    // Adjust if we hit boundaries
    const actualDuration = endTime - startTime;
    if (actualDuration < targetDuration) {
      // Hit boundary, try to compensate on the other side
      if (startTime === 0) {
        endTime = Math.min(videoDuration, targetDuration);
      } else if (endTime === videoDuration) {
        startTime = Math.max(0, videoDuration - targetDuration);
      }
    }

    return { startTime, endTime };
  }

  /**
   * Remove overlapping clips (keep higher scored ones)
   * @param clips Clip definitions
   * @returns Deduplicated clips
   */
  private deduplicateClips(clips: ClipDefinition[]): ClipDefinition[] {
    const result: ClipDefinition[] = [];

    for (const clip of clips) {
      const hasOverlap = result.some(existing =>
        this.clipsOverlap(existing, clip)
      );

      if (!hasOverlap) {
        result.push(clip);
      } else {
        logger.debug({
          clipId: clip.clipId,
          score: clip.score
        }, 'Clip overlaps with higher-scored clip, skipping');
      }
    }

    return result;
  }

  /**
   * Check if two clips overlap
   * @param clip1 First clip
   * @param clip2 Second clip
   * @returns True if clips overlap
   */
  private clipsOverlap(clip1: ClipDefinition, clip2: ClipDefinition): boolean {
    return !(clip1.endTime <= clip2.startTime || clip2.endTime <= clip1.startTime);
  }

  /**
   * Create a single clip
   * @param videoPath Source video path
   * @param definition Clip definition
   * @param index Clip index
   * @param jobId Job ID
   * @param orientation Video orientation
   * @returns Generated clip metadata
   */
  private async createClip(
    videoPath: string,
    definition: ClipDefinition,
    index: number,
    jobId: string,
    orientation: 'portrait' | 'landscape'
  ): Promise<GeneratedClip> {
    const clipId = randomUUID();
    const filename = `${jobId}_${definition.clipId}_${clipId}.mp4`;
    const outputPath = path.join(this.outputDir, filename);

    logger.info({
      clipId,
      index,
      jobId,
      start: definition.startTime,
      end: definition.endTime,
      duration: definition.duration,
      score: definition.score
    }, 'Creating clip');

    try {
      // Generate clip using VideoProcessor
      if (orientation === 'portrait') {
        await this.videoProcessor.createVerticalClip(
          videoPath,
          outputPath,
          definition.startTime,
          definition.endTime
        );
      } else {
        await this.videoProcessor.createLandscapeClip(
          videoPath,
          outputPath,
          definition.startTime,
          definition.endTime
        );
      }

      // Get file size
      const fs = await import('fs/promises');
      const stats = await fs.stat(outputPath);
      const fileSize = stats.size;

      // Get video info
      const videoInfo = await this.videoProcessor.getVideoMetadata(outputPath);

      const clip: GeneratedClip = {
        clipId,
        jobId,
        filePath: outputPath,
        fileSize,
        startTime: definition.startTime,
        endTime: definition.endTime,
        duration: definition.duration,
        score: definition.score,
        text: definition.text, // Add required 'text' field
        transcript: definition.text,
        scores: {
          text: 0, // Will be filled by VideoAnalyzer
          audio: 0,
          visual: 0,
          combined: definition.score
        },
        downloadUrl: `/api/video-analyzer/jobs/${jobId}/clips/${clipId}`,
        createdAt: new Date(),
        videoInfo: {
          width: videoInfo.width,
          height: videoInfo.height,
          fps: videoInfo.fps,
          codec: videoInfo.codec || 'h264',
          bitrate: videoInfo.bitrate || 0
        }
      };

      logger.info({
        clipId,
        filePath: outputPath,
        fileSize: Math.round(fileSize / 1024) + 'KB'
      }, 'Clip created successfully');

      return clip;
    } catch (error: any) {
      logger.error({
        clipId,
        jobId,
        error: error.message
      }, 'Failed to create clip');

      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.CLIP_GENERATION_FAILED,
        `Failed to create clip: ${error.message}`,
        { originalError: error, clipDefinition: definition }
      );
    }
  }
}

/**
 * Factory function to create ClipGenerator
 */
export function createClipGenerator(
  videoProcessor: VideoProcessor,
  outputDir?: string
): ClipGenerator {
  const dir = outputDir || path.join(
    process.env.VIDEO_ANALYZER_STORAGE || './static/video-analyzer',
    'clips'
  );

  return new ClipGenerator(videoProcessor, dir);
}
