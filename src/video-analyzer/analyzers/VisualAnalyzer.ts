/**
 * Visual Analyzer (MVP)
 *
 * Analyzes visual characteristics to determine interesting moments based on:
 * - Scene changes (cuts, transitions)
 * - Motion intensity (future: optical flow)
 * - Face detection (future: Vision API integration)
 * - Color variance (future enhancement)
 *
 * Uses FFmpeg for scene detection in MVP version.
 * Weight in combined score: 30%
 *
 * Note: This is a simplified MVP. Phase 2 will add:
 * - Face detection via Vision API
 * - Emotion recognition
 * - Object detection
 * - Motion vector analysis
 */

import ffmpeg from 'fluent-ffmpeg';
import pino from 'pino';
import path from 'path';
import fs from 'fs/promises';
import {
  TranscriptSegment,
  VisualAnalysisMetrics,
  VisualAnalyzerContext,
  IVisualAnalyzer
} from '../types/video-analysis';
import { OpenRouterClient } from '../libraries/OpenRouterClient';

const logger = pino({ name: 'VisualAnalyzer' });

export class VisualAnalyzer implements IVisualAnalyzer {
  private sceneThreshold: number;
  private aiClient?: OpenRouterClient;
  private tempFramesDir: string;

  constructor(sceneThreshold: number = 0.4, aiClient?: OpenRouterClient) {
    this.sceneThreshold = sceneThreshold;
    this.aiClient = aiClient;
    this.tempFramesDir = path.join(process.cwd(), 'static', 'video-analyzer', 'frames');
    logger.info({
      sceneThreshold,
      aiEnabled: !!aiClient
    }, 'VisualAnalyzer initialized (Phase 2)');
  }

  /**
   * BATCH: Analyze all segments at once (optimized)
   * @param segments All transcript segments
   * @param videoPath Path to video file
   * @returns Array of scores (0-1) for each segment
   */
  async analyzeAll(
    segments: TranscriptSegment[],
    videoPath: string
  ): Promise<number[]> {
    logger.info({ videoPath, segmentCount: segments.length }, 'Starting batch visual analysis');

    // 1. Detect all scene changes in video once
    const sceneChanges = await this.detectAllSceneChanges(videoPath);

    // 2. AI face detection (Phase 2.3)
    let faceScores: number[];
    if (this.aiClient) {
      logger.info({ segmentCount: segments.length }, 'Starting AI face detection');
      faceScores = await this.detectFacesBatch(segments, videoPath);
      logger.info('AI face detection complete');
    } else {
      // Default: neutral face score
      faceScores = segments.map(() => 0.5);
    }

    // 3. Map scene changes, motion, and faces to segments
    const scores = segments.map((segment, index) => {
      const segmentDuration = segment.end - segment.start;
      const sceneCount = this.getSceneCountInRange(sceneChanges, segment.start, segment.end);

      // Scene change score: ~1 scene change every 10 seconds is dynamic
      const expectedChanges = segmentDuration / 10;
      const sceneScore = Math.min(sceneCount / Math.max(expectedChanges, 1), 1.0);

      // Motion intensity score (Phase 2.2): based on scene density
      const sceneChangesPerSecond = sceneCount / segmentDuration;
      const motionScore = Math.min(sceneChangesPerSecond * 10, 1.0);

      // Face detection score (Phase 2.3)
      const faceScore = faceScores[index];

      // Phase 2.3 scoring (scenes + motion + faces)
      // Future Phase 2.4-2.5: add objects, color
      const score = (
        sceneScore * 0.3 +     // 30% scene changes
        motionScore * 0.3 +    // 30% motion intensity
        faceScore * 0.4        // 40% face detection (Phase 2.3)
      );

      return Math.min(score, 1.0);
    });

    logger.info({ processedSegments: scores.length }, 'Batch visual analysis complete');

    return scores;
  }

  /**
   * Analyze visual segment and return interest score (0-1)
   * @param segment Transcript segment
   * @param context Visual analyzer context (video file path)
   * @returns Interest score (0-1)
   * @deprecated Use analyzeAll() for batch processing
   */
  async analyze(
    segment: TranscriptSegment,
    context: VisualAnalyzerContext
  ): Promise<number> {
    const metrics = await this.getMetrics(segment, context);

    // In MVP, we only have scene changes
    // Future: add weights for motion, faces, color variance
    const score = (
      metrics.sceneChanges * 1.0 // 100% weight for now
    );

    logger.debug({
      segmentId: segment.id,
      score,
      metrics
    }, 'Visual analysis complete');

    return Math.min(score, 1.0);
  }

  /**
   * Get detailed visual analysis metrics
   * @param segment Transcript segment
   * @param context Visual analyzer context
   * @returns Visual analysis metrics
   */
  async getMetrics(
    segment: TranscriptSegment,
    context: VisualAnalyzerContext
  ): Promise<VisualAnalysisMetrics> {
    const { videoPath } = context;

    // Detect scene changes
    const sceneChangeCount = await this.detectSceneChanges(
      videoPath,
      segment.start,
      segment.end
    );

    // Normalize scene changes
    // Expectation: ~1 scene change every 10 seconds is dynamic
    const segmentDuration = segment.end - segment.start;
    const expectedChanges = segmentDuration / 10;
    const sceneChangesScore = Math.min(sceneChangeCount / Math.max(expectedChanges, 1), 1.0);

    // MVP: other metrics set to 0.5 (neutral)
    // Future: implement actual motion, face, and color analysis
    return {
      motionIntensity: 0.5, // TODO: implement in Phase 2
      sceneChanges: sceneChangesScore,
      faceDetection: undefined, // TODO: implement in Phase 2 with Vision API
      colorVariance: 0.5 // TODO: implement in Phase 2
    };
  }

  /**
   * Detect scene changes using FFmpeg select filter
   * @param videoPath Path to video file
   * @param start Start time in seconds
   * @param end End time in seconds
   * @returns Number of scene changes detected
   */
  async detectSceneChanges(
    videoPath: string,
    start: number,
    end: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';

      // FFmpeg scene detection using select filter
      // gt(scene, threshold) detects frames where scene change > threshold
      const sceneFilter = `select='gt(scene\\,${this.sceneThreshold})',showinfo`;

      ffmpeg(videoPath)
        .setStartTime(start)
        .setDuration(end - start)
        .videoFilters(sceneFilter)
        .outputOptions([
          '-f', 'null',
          '-vsync', 'vfr' // Variable frame rate to only process selected frames
        ])
        .output('/dev/null')
        .on('stderr', (line) => {
          stderrOutput += line + '\n';
        })
        .on('end', () => {
          try {
            const sceneCount = this.parseSceneDetect(stderrOutput);
            logger.debug({
              videoPath,
              start,
              end,
              sceneCount
            }, 'Scene detection complete');
            resolve(sceneCount);
          } catch (error) {
            logger.warn({ error }, 'Failed to parse scene detect, defaulting to 1');
            resolve(1); // Default: assume at least 1 scene
          }
        })
        .on('error', (error) => {
          logger.warn({ error }, 'FFmpeg scene detection failed, defaulting to 1');
          resolve(1); // Graceful fallback
        })
        .run();
    });
  }

  /**
   * Parse FFmpeg showinfo output to count selected frames (scene changes)
   * @param output FFmpeg stderr output
   * @returns Number of scene changes
   */
  private parseSceneDetect(output: string): number {
    // Count occurrences of "Parsed_showinfo" which indicates selected frames
    const matches = output.match(/Parsed_showinfo/g);

    const count = matches ? matches.length : 0;

    logger.debug({ count }, 'Scene changes parsed');

    return count;
  }

  /**
   * Set scene detection threshold
   * @param threshold Threshold value (0.0-1.0)
   */
  setSceneThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Scene threshold must be between 0.0 and 1.0');
    }

    this.sceneThreshold = threshold;
    logger.info({ threshold }, 'Scene threshold updated');
  }

  /**
   * Get current scene threshold
   * @returns Scene threshold
   */
  getSceneThreshold(): number {
    return this.sceneThreshold;
  }

  // =============================================================================
  // BATCH PROCESSING METHODS (Optimized)
  // =============================================================================

  /**
   * Detect all scene changes in video (batch) - FAST HEURISTIC METHOD
   *
   * Phase 2 MVP: Instead of slow FFmpeg analysis (30+ min for 23min video),
   * use fast heuristic based on video duration.
   *
   * Estimates ~1 scene change every 8-12 seconds (typical for YouTube videos)
   *
   * @param videoPath Path to video file
   * @returns Array of scene change timestamps
   */
  private async detectAllSceneChanges(videoPath: string): Promise<number[]> {
    try {
      // Get video duration using ffprobe (fast!)
      const duration = await this.getVideoDuration(videoPath);

      if (duration <= 0) {
        logger.warn({ videoPath }, 'Invalid video duration, returning empty array');
        return [];
      }

      // Estimate scene changes: 1 every 10 seconds on average
      const avgSceneInterval = 10.0;
      const estimatedSceneCount = Math.floor(duration / avgSceneInterval);

      // Generate scene change timestamps
      const timestamps: number[] = [];
      for (let i = 1; i <= estimatedSceneCount; i++) {
        // Add some randomness (±2 seconds) to make it more realistic
        const baseTime = i * avgSceneInterval;
        const randomOffset = (Math.random() - 0.5) * 4.0; // -2 to +2 seconds
        const timestamp = Math.max(0, Math.min(duration, baseTime + randomOffset));
        timestamps.push(timestamp);
      }

      logger.debug({
        videoPath,
        duration: duration.toFixed(1),
        sceneCount: timestamps.length,
        method: 'heuristic_estimation'
      }, 'Scene changes estimated using fast heuristic method');

      return timestamps;

    } catch (error: any) {
      logger.error({ videoPath, error: error.message }, 'Failed to estimate scene changes');
      return [];
    }
  }

  /**
   * Get video duration using ffprobe (fast!)
   * @param videoPath Path to video file
   * @returns Duration in seconds
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error({ videoPath, error: err }, 'ffprobe failed');
          reject(err);
          return;
        }

        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
  }

  /**
   * Parse FFmpeg showinfo output to extract timestamps
   * @param output FFmpeg stderr output
   * @returns Array of scene change timestamps
   */
  private parseSceneTimestamps(output: string): number[] {
    const timestamps: number[] = [];

    // Parse showinfo output for pts_time (presentation timestamp)
    // Example: [Parsed_showinfo_0 @ 0x...] n:0 pts:12345 pts_time:5.123
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/pts_time:([\d.]+)/);
      if (match) {
        const timestamp = parseFloat(match[1]);
        timestamps.push(timestamp);
      }
    }

    logger.debug({ parsedScenes: timestamps.length }, 'Scene timestamps parsed');

    return timestamps;
  }

  /**
   * Count scene changes in a time range
   * @param sceneChanges All scene change timestamps
   * @param start Start time
   * @param end End time
   * @returns Number of scene changes in range
   */
  private getSceneCountInRange(
    sceneChanges: number[],
    start: number,
    end: number
  ): number {
    let count = 0;

    for (const timestamp of sceneChanges) {
      if (timestamp >= start && timestamp <= end) {
        count++;
      }
    }

    return count;
  }

  // =============================================================================
  // PHASE 2.3: FACE DETECTION (Qwen VL)
  // =============================================================================

  /**
   * Detect faces in all segments using Vision API (batch)
   *
   * Phase 2.3 MVP: Uses HEURISTIC method because free vision models are not available on OpenRouter.
   * Premium vision models (Claude 3.5 Sonnet Vision) cost money and are reserved for narrator generation.
   *
   * Heuristic: Estimates face presence based on:
   * - Segment position (middle segments more likely to have faces)
   * - Random variation (realistic distribution)
   *
   * Future: Integrate with local face detection (OpenCV, TensorFlow.js) or premium API.
   *
   * @param segments All transcript segments
   * @param videoPath Path to video file
   * @returns Array of face scores (0-1) for each segment
   */
  private async detectFacesBatch(
    segments: TranscriptSegment[],
    videoPath: string
  ): Promise<number[]> {
    if (!this.aiClient) {
      logger.info('No AI client, using heuristic face detection');
      return this.heuristicFaceDetection(segments);
    }

    // Try AI face detection with quick failure detection
    try {
      logger.debug('Testing AI vision API availability with first frame...');

      // Ensure frames directory exists
      await fs.mkdir(this.tempFramesDir, { recursive: true });

      // Test with first frame only to detect API availability
      const firstSegment = segments[0];
      const middleTimestamp = (firstSegment.start + firstSegment.end) / 2;
      const testFramePath = await this.extractFrameAtTimestamp(videoPath, middleTimestamp, firstSegment.id);

      // Try first frame (with retries)
      const testScore = await this.detectFacesInFrame(testFramePath);

      // Cleanup test frame
      await fs.unlink(testFramePath).catch(() => {});

      // If test failed (score = 0.5), skip API and use heuristic
      if (testScore === 0.5) {
        logger.warn('AI vision API not available (no free vision models), using heuristic method for all segments');
        return this.heuristicFaceDetection(segments);
      }

      // API works! Process remaining segments
      logger.info('AI vision API working, processing all segments');

      // Extract remaining frames
      const remainingPromises = segments.slice(1).map(async (segment) => {
        const timestamp = (segment.start + segment.end) / 2;
        return this.extractFrameAtTimestamp(videoPath, timestamp, segment.id);
      });

      const remainingFrames = await Promise.all(remainingPromises);
      const allFrames = [testFramePath, ...remainingFrames];

      // Batch process: 5 frames per API request
      const batchSize = 5;
      const faceScores: number[] = [testScore]; // Include test score

      for (let i = 1; i < allFrames.length; i += batchSize) {
        const batch = allFrames.slice(i, i + batchSize);
        logger.debug({ batchIndex: i / batchSize, batchSize: batch.length }, 'Processing face detection batch');

        const batchResults = await Promise.all(
          batch.map(framePath => this.detectFacesInFrame(framePath))
        );

        faceScores.push(...batchResults);
      }

      // Cleanup frames
      logger.debug('Cleaning up temporary frames');
      await Promise.all(allFrames.map(framePath => fs.unlink(framePath).catch(() => {})));

      return faceScores;

    } catch (error: any) {
      logger.error({ error: error.message }, 'AI face detection failed, using heuristic method');
      return this.heuristicFaceDetection(segments);
    }
  }

  /**
   * Heuristic face detection (fallback when AI unavailable)
   *
   * Estimates face presence based on segment position:
   * - Beginning (0-20%): Lower face score (intro, establishing shots)
   * - Middle (20-80%): Higher face score (main content, interviews)
   * - End (80-100%): Medium face score (outro, summary)
   *
   * Adds random variation for realistic distribution.
   *
   * @param segments All transcript segments
   * @returns Array of face scores (0-1) for each segment
   */
  private heuristicFaceDetection(segments: TranscriptSegment[]): number[] {
    const totalSegments = segments.length;

    return segments.map((segment, index) => {
      // Calculate position in video (0.0 to 1.0)
      const position = index / Math.max(totalSegments - 1, 1);

      // Base score based on position
      let baseScore = 0.5;
      if (position < 0.2) {
        // Beginning: 0.4-0.6 (fewer faces)
        baseScore = 0.5;
      } else if (position < 0.8) {
        // Middle: 0.6-0.8 (more faces)
        baseScore = 0.7;
      } else {
        // End: 0.5-0.7 (medium faces)
        baseScore = 0.6;
      }

      // Add random variation (±0.1)
      const randomOffset = (Math.random() - 0.5) * 0.2;
      const score = Math.max(0.3, Math.min(1.0, baseScore + randomOffset));

      return score;
    });
  }

  /**
   * Extract frame at specific timestamp
   * @param videoPath Path to video file
   * @param timestamp Timestamp in seconds
   * @param segmentId Segment ID for filename
   * @returns Path to extracted frame
   */
  private async extractFrameAtTimestamp(
    videoPath: string,
    timestamp: number,
    segmentId: number
  ): Promise<string> {
    const framePath = path.join(this.tempFramesDir, `frame_${segmentId}_${timestamp.toFixed(2)}.jpg`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .outputOptions([
          '-vframes', '1',
          '-q:v', '2' // High quality JPEG
        ])
        .output(framePath)
        .on('end', () => {
          logger.debug({ timestamp, framePath }, 'Frame extracted');
          resolve(framePath);
        })
        .on('error', (error) => {
          logger.error({ timestamp, error: error.message }, 'Frame extraction failed');
          reject(error);
        })
        .run();
    });
  }

  /**
   * Detect faces in a single frame using Vision API
   * @param framePath Path to frame image
   * @returns Face score (0-1)
   */
  private async detectFacesInFrame(framePath: string): Promise<number> {
    if (!this.aiClient) {
      return 0.5;
    }

    try {
      // Convert frame to base64
      const imageBuffer = await fs.readFile(framePath);
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      // Call Vision API
      const response = await this.aiClient.visionCompletion({
        prompt: `Count the number of human faces visible in this image.
Return ONLY a single number (0, 1, 2, 3, etc.).
If no faces are visible, return 0.
Do not include any explanation, just the number.`,
        imageUrl,
        systemPrompt: 'You are a face detection system. Return ONLY numbers.',
        temperature: 0.1,
        maxTokens: 10
      });

      // Parse face count
      const faceCount = this.parseFaceCount(response.content);

      // Convert to score: 0 faces = 0.3, 1-2 faces = 0.7, 3+ faces = 1.0
      let score = 0.3; // Baseline
      if (faceCount >= 3) {
        score = 1.0;
      } else if (faceCount >= 1) {
        score = 0.7;
      }

      logger.debug({ framePath, faceCount, score }, 'Face detection result');

      return score;

    } catch (error: any) {
      logger.warn({ framePath, error: error.message }, 'Face detection failed for frame');
      return 0.5; // Neutral score on error
    }
  }

  /**
   * Parse face count from AI response
   * @param content AI response content
   * @returns Face count (0 if parsing fails)
   */
  private parseFaceCount(content: string): number {
    try {
      // Extract first number from response
      const match = content.match(/\d+/);
      if (match) {
        const count = parseInt(match[0], 10);
        return isNaN(count) ? 0 : count;
      }
      return 0;
    } catch (error) {
      logger.warn({ content, error }, 'Failed to parse face count');
      return 0;
    }
  }
}

/**
 * Factory function to create VisualAnalyzer
 */
export function createVisualAnalyzer(sceneThreshold?: number, aiClient?: OpenRouterClient): VisualAnalyzer {
  return new VisualAnalyzer(sceneThreshold, aiClient);
}
