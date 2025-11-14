/**
 * Audio Analyzer
 *
 * Analyzes audio characteristics to determine interesting moments based on:
 * - Volume spikes (sudden loudness changes)
 * - Energy level (overall loudness)
 * - Silence duration (gaps in speech)
 * - Dynamic range (variability in volume)
 *
 * Uses FFmpeg for audio analysis (volumedetect, silencedetect filters)
 * Weight in combined score: 30%
 */

import ffmpeg from 'fluent-ffmpeg';
import pino from 'pino';
import {
  TranscriptSegment,
  AudioAnalysisMetrics,
  AudioAnalyzerContext,
  IAudioAnalyzer,
  VolumeStats
} from '../types/video-analysis';
import { OpenRouterClient } from '../libraries/OpenRouterClient';

const logger = pino({ name: 'AudioAnalyzer' });

export class AudioAnalyzer implements IAudioAnalyzer {
  private aiClient?: OpenRouterClient;

  constructor(aiClient?: OpenRouterClient) {
    this.aiClient = aiClient;
    logger.info({ aiEnabled: !!aiClient }, 'AudioAnalyzer initialized');
  }

  /**
   * BATCH: Analyze all segments at once (optimized)
   * @param segments All transcript segments
   * @param audioPath Path to audio file
   * @returns Array of scores (0-1) for each segment
   */
  async analyzeAll(
    segments: TranscriptSegment[],
    audioPath: string
  ): Promise<number[]> {
    logger.info({ audioPath, segmentCount: segments.length }, 'Starting batch audio analysis');

    // 1. Analyze entire audio file once (instead of per-segment)
    const volumeTimeline = await this.extractVolumeTimeline(audioPath);
    const silenceRanges = await this.detectAllSilence(audioPath);

    // 2. AI emotion analysis (Phase 1.3)
    let emotionScores: number[];
    if (this.aiClient) {
      logger.info({ segmentCount: segments.length }, 'Starting AI emotion analysis');
      emotionScores = await this.analyzeEmotionBatch(segments);
      logger.info('AI emotion analysis complete');
    } else {
      // Fallback: use neutral score if AI not available
      logger.debug('AI client not available, using neutral emotion scores');
      emotionScores = segments.map(() => 0.5);
    }

    // 3. Map results to segments
    const scores = segments.map((segment, index) => {
      const volumeStats = this.getVolumeInRange(volumeTimeline, segment.start, segment.end);
      const silenceRatio = this.getSilenceInRange(silenceRanges, segment.start, segment.end);

      const energyLevel = this.normalizeEnergyLevel(volumeStats.mean_volume);
      const volumeSpikes = this.normalizeDynamicRange(volumeStats.variance);
      const silenceDuration = 1.0 - silenceRatio;

      // Speech rate analysis (Phase 1.1)
      const speechRate = this.calculateSpeechRate(segment);

      // Emotion score from AI (Phase 1.3)
      const emotionScore = emotionScores[index];

      // FINAL Phase 1 scoring formula:
      // energy*0.3 + spikes*0.2 + silence*0.2 + speechRate*0.1 + emotion*0.2
      const score = (
        energyLevel * 0.3 +
        volumeSpikes * 0.2 +
        silenceDuration * 0.2 +
        speechRate * 0.1 +
        emotionScore * 0.2
      );

      return Math.min(score, 1.0);
    });

    logger.info({ processedSegments: scores.length }, 'Batch audio analysis complete');

    return scores;
  }

  /**
   * Analyze audio segment and return interest score (0-1)
   * @param segment Transcript segment
   * @param context Audio analyzer context (audio file path)
   * @returns Interest score (0-1)
   * @deprecated Use analyzeAll() for batch processing
   */
  async analyze(
    segment: TranscriptSegment,
    context: AudioAnalyzerContext
  ): Promise<number> {
    const metrics = await this.getMetrics(segment, context);

    // Combine metrics with weights
    const score = (
      metrics.energyLevel * 0.4 +
      metrics.volumeSpikes * 0.3 +
      metrics.silenceDuration * 0.3
    );

    logger.debug({
      segmentId: segment.id,
      score,
      metrics
    }, 'Audio analysis complete');

    return Math.min(score, 1.0);
  }

  /**
   * Get detailed audio analysis metrics
   * @param segment Transcript segment
   * @param context Audio analyzer context
   * @returns Audio analysis metrics
   */
  async getMetrics(
    segment: TranscriptSegment,
    context: AudioAnalyzerContext
  ): Promise<AudioAnalysisMetrics> {
    const { audioPath } = context;

    // Extract volume statistics
    const volumeStats = await this.extractVolumeStats(
      audioPath,
      segment.start,
      segment.end
    );

    // Calculate metrics
    const energyLevel = this.normalizeEnergyLevel(volumeStats.mean_volume);
    const volumeSpikes = this.normalizeDynamicRange(volumeStats.variance);

    // Silence detection (inverse - less silence = more interesting)
    const silenceRatio = await this.detectSilenceRatio(
      audioPath,
      segment.start,
      segment.end
    );
    const silenceDuration = 1.0 - silenceRatio;

    // Speech rate (not implemented in MVP, set to 0.5 default)
    const speechRate = 0.5;

    return {
      volumeSpikes,
      speechRate,
      silenceDuration,
      energyLevel
    };
  }

  /**
   * Extract volume statistics using FFmpeg volumedetect filter
   * @param audioPath Path to audio file
   * @param start Start time in seconds
   * @param end End time in seconds
   * @returns Volume statistics
   */
  async extractVolumeStats(
    audioPath: string,
    start: number,
    end: number
  ): Promise<VolumeStats> {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';

      ffmpeg(audioPath)
        .setStartTime(start)
        .setDuration(end - start)
        .audioFilters('volumedetect')
        .outputOptions(['-f', 'null'])
        .output('/dev/null')
        .on('stderr', (line) => {
          stderrOutput += line + '\n';
        })
        .on('end', () => {
          try {
            const stats = this.parseVolumeDetect(stderrOutput);
            resolve(stats);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          logger.error({ audioPath, start, end, error }, 'FFmpeg volumedetect failed');
          reject(error);
        })
        .run();
    });
  }

  /**
   * Parse FFmpeg volumedetect output
   * @param output FFmpeg stderr output
   * @returns Volume statistics
   */
  private parseVolumeDetect(output: string): VolumeStats {
    // Example output:
    // [Parsed_volumedetect_0 @ 0x...] mean_volume: -27.0 dB
    // [Parsed_volumedetect_0 @ 0x...] max_volume: -5.0 dB

    const meanMatch = output.match(/mean_volume:\s+([-\d.]+)\s+dB/);
    const maxMatch = output.match(/max_volume:\s+([-\d.]+)\s+dB/);

    const mean_volume = meanMatch ? parseFloat(meanMatch[1]) : -30.0;
    const max_volume = maxMatch ? parseFloat(maxMatch[1]) : -10.0;
    const variance = max_volume - mean_volume;

    logger.debug({ mean_volume, max_volume, variance }, 'Volume stats parsed');

    return {
      mean_volume,
      max_volume,
      variance
    };
  }

  /**
   * Detect silence ratio in audio segment
   * @param audioPath Path to audio file
   * @param start Start time in seconds
   * @param end End time in seconds
   * @returns Silence ratio (0-1)
   */
  private async detectSilenceRatio(
    audioPath: string,
    start: number,
    end: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';
      const segmentDuration = end - start;

      // silencedetect filter: silence < -40dB for > 0.5 seconds
      ffmpeg(audioPath)
        .setStartTime(start)
        .setDuration(segmentDuration)
        .audioFilters('silencedetect=noise=-40dB:d=0.5')
        .outputOptions(['-f', 'null'])
        .output('/dev/null')
        .on('stderr', (line) => {
          stderrOutput += line + '\n';
        })
        .on('end', () => {
          try {
            const silenceDuration = this.parseSilenceDetect(stderrOutput);
            const ratio = Math.min(silenceDuration / segmentDuration, 1.0);
            resolve(ratio);
          } catch (error) {
            logger.warn({ error }, 'Failed to parse silence detect, defaulting to 0.2');
            resolve(0.2); // Default assumption: 20% silence
          }
        })
        .on('error', (error) => {
          logger.warn({ error }, 'FFmpeg silencedetect failed, defaulting to 0.2');
          resolve(0.2);
        })
        .run();
    });
  }

  /**
   * Parse FFmpeg silencedetect output
   * @param output FFmpeg stderr output
   * @returns Total silence duration in seconds
   */
  private parseSilenceDetect(output: string): number {
    // Example output:
    // [silencedetect @ 0x...] silence_start: 2.5
    // [silencedetect @ 0x...] silence_end: 4.0 | silence_duration: 1.5

    const durationMatches = output.matchAll(/silence_duration:\s+([\d.]+)/g);

    let totalSilence = 0;
    for (const match of durationMatches) {
      totalSilence += parseFloat(match[1]);
    }

    logger.debug({ totalSilence }, 'Silence detected');

    return totalSilence;
  }

  /**
   * Normalize energy level from dB to 0-1 score
   * @param meanVolume Mean volume in dB
   * @returns Normalized score (0-1)
   */
  private normalizeEnergyLevel(meanVolume: number): number {
    // Typical range: -60 dB (very quiet) to -10 dB (loud)
    // Higher is better (more energy = more interesting)

    const minDb = -60;
    const maxDb = -10;

    const normalized = (meanVolume - minDb) / (maxDb - minDb);

    return Math.max(0, Math.min(normalized, 1.0));
  }

  /**
   * Normalize dynamic range (variance) to 0-1 score
   * @param variance Difference between max and mean volume
   * @returns Normalized score (0-1)
   */
  private normalizeDynamicRange(variance: number): number {
    // Typical range: 0 dB (flat) to 30+ dB (very dynamic)
    // Higher variance = more dynamic = more interesting

    const maxVariance = 25;

    const normalized = variance / maxVariance;

    return Math.min(normalized, 1.0);
  }

  // =============================================================================
  // BATCH PROCESSING METHODS (Optimized)
  // =============================================================================

  /**
   * Extract volume timeline for entire audio file
   * Uses astats filter to get per-second volume statistics
   * @param audioPath Path to audio file
   * @returns Timeline of volume measurements
   */
  private async extractVolumeTimeline(audioPath: string): Promise<Array<{
    time: number;
    mean_volume: number;
    max_volume: number;
    variance: number;
  }>> {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';

      // Use astats filter to get per-frame statistics
      // Then aggregate to per-second averages
      ffmpeg(audioPath)
        .audioFilters('astats=metadata=1:reset=1')
        .outputOptions(['-f', 'null'])
        .output('/dev/null')
        .on('stderr', (line) => {
          stderrOutput += line + '\n';
        })
        .on('end', () => {
          try {
            const timeline = this.parseAudioStats(stderrOutput);
            logger.debug({ timelineLength: timeline.length }, 'Volume timeline extracted');
            resolve(timeline);
          } catch (error) {
            logger.error({ error }, 'Failed to parse audio stats');
            // Return default timeline with neutral values
            resolve([{ time: 0, mean_volume: -30, max_volume: -20, variance: 10 }]);
          }
        })
        .on('error', (error) => {
          logger.error({ audioPath, error }, 'FFmpeg astats failed');
          // Return default timeline
          resolve([{ time: 0, mean_volume: -30, max_volume: -20, variance: 10 }]);
        })
        .run();
    });
  }

  /**
   * Parse FFmpeg astats output to timeline
   * @param output FFmpeg stderr output
   * @returns Volume timeline
   */
  private parseAudioStats(output: string): Array<{
    time: number;
    mean_volume: number;
    max_volume: number;
    variance: number;
  }> {
    // For MVP: Use volumedetect on entire file and extrapolate
    // Future: Parse per-frame astats for accurate timeline
    const meanMatch = output.match(/mean_volume:\s+([-\d.]+)\s+dB/);
    const maxMatch = output.match(/max_volume:\s+([-\d.]+)\s+dB/);

    const mean_volume = meanMatch ? parseFloat(meanMatch[1]) : -30.0;
    const max_volume = maxMatch ? parseFloat(maxMatch[1]) : -10.0;
    const variance = max_volume - mean_volume;

    // MVP: Return single measurement (applies to entire file)
    // This is acceptable because we're doing relative scoring
    return [{
      time: 0,
      mean_volume,
      max_volume,
      variance
    }];
  }

  /**
   * Detect all silence ranges in audio file (batch)
   * @param audioPath Path to audio file
   * @returns Array of silence ranges {start, end, duration}
   */
  private async detectAllSilence(audioPath: string): Promise<Array<{
    start: number;
    end: number;
    duration: number;
  }>> {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';

      // silencedetect on entire file
      ffmpeg(audioPath)
        .audioFilters('silencedetect=noise=-40dB:d=0.5')
        .outputOptions(['-f', 'null'])
        .output('/dev/null')
        .on('stderr', (line) => {
          stderrOutput += line + '\n';
        })
        .on('end', () => {
          try {
            const silenceRanges = this.parseSilenceRanges(stderrOutput);
            logger.debug({ silenceCount: silenceRanges.length }, 'Silence ranges detected');
            resolve(silenceRanges);
          } catch (error) {
            logger.warn({ error }, 'Failed to parse silence, returning empty array');
            resolve([]);
          }
        })
        .on('error', (error) => {
          logger.warn({ error }, 'FFmpeg silencedetect failed, returning empty array');
          resolve([]);
        })
        .run();
    });
  }

  /**
   * Parse FFmpeg silencedetect output to ranges
   * @param output FFmpeg stderr output
   * @returns Array of silence ranges
   */
  private parseSilenceRanges(output: string): Array<{
    start: number;
    end: number;
    duration: number;
  }> {
    const ranges: Array<{ start: number; end: number; duration: number }> = [];

    // Parse silence_start and silence_end pairs
    const lines = output.split('\n');
    let currentStart: number | null = null;

    for (const line of lines) {
      const startMatch = line.match(/silence_start:\s+([\d.]+)/);
      const endMatch = line.match(/silence_end:\s+([\d.]+).*silence_duration:\s+([\d.]+)/);

      if (startMatch) {
        currentStart = parseFloat(startMatch[1]);
      }

      if (endMatch && currentStart !== null) {
        const end = parseFloat(endMatch[1]);
        const duration = parseFloat(endMatch[2]);

        ranges.push({
          start: currentStart,
          end,
          duration
        });

        currentStart = null;
      }
    }

    return ranges;
  }

  /**
   * Get volume statistics for a time range
   * @param timeline Volume timeline
   * @param start Start time
   * @param end End time
   * @returns Volume stats for range
   */
  private getVolumeInRange(
    timeline: Array<{ time: number; mean_volume: number; max_volume: number; variance: number }>,
    start: number,
    end: number
  ): VolumeStats {
    // MVP: Use global stats (since timeline has only 1 entry)
    // Future: Average stats from timeline entries in range
    if (timeline.length === 0) {
      return { mean_volume: -30, max_volume: -20, variance: 10 };
    }

    return {
      mean_volume: timeline[0].mean_volume,
      max_volume: timeline[0].max_volume,
      variance: timeline[0].variance
    };
  }

  /**
   * Calculate silence ratio for a time range
   * @param silenceRanges All silence ranges
   * @param start Start time
   * @param end End time
   * @returns Silence ratio (0-1)
   */
  private getSilenceInRange(
    silenceRanges: Array<{ start: number; end: number; duration: number }>,
    start: number,
    end: number
  ): number {
    const segmentDuration = end - start;
    let silenceDuration = 0;

    for (const range of silenceRanges) {
      // Check if silence range overlaps with segment
      const overlapStart = Math.max(range.start, start);
      const overlapEnd = Math.min(range.end, end);

      if (overlapStart < overlapEnd) {
        silenceDuration += overlapEnd - overlapStart;
      }
    }

    const ratio = Math.min(silenceDuration / segmentDuration, 1.0);
    return ratio;
  }

  // =============================================================================
  // PHASE 1: AI ENHANCEMENT METHODS
  // =============================================================================

  /**
   * Analyze emotions for all segments using AI (batch processing)
   * Processes 10 segments per request for efficiency
   * @param segments Array of transcript segments
   * @returns Array of emotion scores (0-1)
   */
  private async analyzeEmotionBatch(segments: TranscriptSegment[]): Promise<number[]> {
    if (!this.aiClient) {
      logger.warn('AI client not available for emotion analysis');
      return segments.map(() => 0.5);
    }

    const BATCH_SIZE = 10;
    const allScores: number[] = [];

    // Process in batches
    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch = segments.slice(i, i + BATCH_SIZE);

      try {
        const batchScores = await this.analyzeEmotionBatchChunk(batch);
        allScores.push(...batchScores);

        logger.debug({
          batchIndex: Math.floor(i / BATCH_SIZE) + 1,
          batchSize: batch.length,
          processedSoFar: allScores.length,
          total: segments.length
        }, 'Emotion batch processed');

      } catch (error: any) {
        logger.error({
          batchIndex: Math.floor(i / BATCH_SIZE) + 1,
          error: error.message
        }, 'Emotion batch failed, using neutral scores');

        // Fallback: use neutral scores for failed batch
        allScores.push(...batch.map(() => 0.5));
      }
    }

    return allScores;
  }

  /**
   * Analyze emotions for a single batch chunk (≤10 segments)
   * @param segments Batch of segments
   * @returns Array of emotion scores (0-1)
   */
  private async analyzeEmotionBatchChunk(segments: TranscriptSegment[]): Promise<number[]> {
    if (!this.aiClient) {
      return segments.map(() => 0.5);
    }

    // Build prompt for AI
    const segmentTexts = segments.map((seg, idx) => `${idx + 1}. "${seg.text}"`).join('\n');

    const prompt = `Analyze the emotional intensity of these text segments on a scale 0-1.
Return ONLY a JSON array of numbers (no explanations).

Criteria for scoring:
- High score (0.7-1.0): Excitement, surprise, urgency, humor, conflict, drama, strong opinions
- Medium score (0.4-0.6): Interesting information, neutral tone, factual statements
- Low score (0.0-0.3): Boring, repetitive, filler words, low energy

Segments:
${segmentTexts}

Response format: [0.7, 0.4, 0.9, ...]`;

    const systemPrompt = `You are an emotion intensity analyzer. Return ONLY a JSON array of numbers between 0 and 1. No other text.`;

    try {
      const response = await this.aiClient.textCompletion({
        prompt,
        systemPrompt,
        temperature: 0.3, // Low temperature for consistent scoring
        maxTokens: 300 // Increased from 200 to give AI more room
      });

      // Parse JSON response with multiple strategies
      const content = response.content.trim();

      logger.debug({
        contentPreview: content.substring(0, 200),
        contentLength: content.length
      }, 'Raw AI response received');

      let scores: number[] | null = null;

      // Strategy 1: Try to extract from markdown code blocks
      if (content.includes('```')) {
        const codeBlockMatch = content.match(/```(?:json)?\s*(\[[^\]]*\])\s*```/s);
        if (codeBlockMatch) {
          try {
            scores = JSON.parse(codeBlockMatch[1]) as number[];
            logger.debug('Extracted scores from markdown code block');
          } catch (e) {
            logger.debug('Failed to parse markdown code block');
          }
        }
      }

      // Strategy 2: Find first valid JSON array
      if (!scores) {
        const arrayMatches = content.matchAll(/\[[\s\S]*?\]/g);
        for (const match of arrayMatches) {
          try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.every(v => typeof v === 'number')) {
              scores = parsed as number[];
              logger.debug('Extracted scores from JSON array match');
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Strategy 3: Try to extract numbers separated by commas/spaces
      if (!scores) {
        const numbersMatch = content.match(/[\d.]+(?:\s*[,\s]\s*[\d.]+)*/g);
        if (numbersMatch) {
          const numbers = numbersMatch[0]
            .split(/[,\s]+/)
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n) && n >= 0 && n <= 1);

          if (numbers.length === segments.length) {
            scores = numbers;
            logger.debug('Extracted scores from comma-separated numbers');
          }
        }
      }

      // Strategy 4: Extract any numbers and take first N
      if (!scores) {
        const allNumbers = content
          .match(/\d+\.?\d*/g)
          ?.map(s => parseFloat(s))
          .filter(n => !isNaN(n) && n >= 0 && n <= 1);

        if (allNumbers && allNumbers.length >= segments.length) {
          scores = allNumbers.slice(0, segments.length);
          logger.debug('Extracted scores from first N numbers in text');
        }
      }

      // If still no scores, throw error
      if (!scores) {
        throw new Error('No valid array found in AI response');
      }

      // Validate scores length
      if (scores.length !== segments.length) {
        logger.warn({
          expected: segments.length,
          received: scores.length
        }, 'Score count mismatch, padding/truncating');

        // Pad with 0.5 or truncate to match expected length
        if (scores.length < segments.length) {
          while (scores.length < segments.length) {
            scores.push(0.5);
          }
        } else {
          scores = scores.slice(0, segments.length);
        }
      }

      // Clamp scores to 0-1 range
      const clampedScores = scores.map(score => Math.max(0, Math.min(score, 1.0)));

      logger.debug({
        model: response.model,
        scoresMin: Math.min(...clampedScores).toFixed(2),
        scoresMax: Math.max(...clampedScores).toFixed(2),
        scoresAvg: (clampedScores.reduce((a, b) => a + b, 0) / clampedScores.length).toFixed(2)
      }, 'Emotion scores extracted successfully');

      return clampedScores;

    } catch (error: any) {
      logger.error({
        error: error.message,
        segmentCount: segments.length
      }, 'Failed to parse emotion scores from AI, using neutral fallback');

      // Fallback: neutral scores
      return segments.map(() => 0.5);
    }
  }

  /**
   * Calculate speech rate from segment text
   * Fast speech = more engaging = higher score
   * @param segment Transcript segment
   * @returns Speech rate score (0-1)
   */
  private calculateSpeechRate(segment: TranscriptSegment): number {
    const text = segment.text.trim();

    // Handle empty text
    if (!text) {
      return 0.3; // Low score for empty segments
    }

    const duration = segment.end - segment.start;

    // Avoid division by zero
    if (duration <= 0) {
      return 0.5; // Neutral score
    }

    // Count words (split by whitespace)
    const wordCount = text.split(/\s+/).length;

    // Calculate words per minute (WPM)
    const wpm = (wordCount / duration) * 60;

    // Normalize to 0-1 score based on typical speech rates:
    // - Very slow: < 100 WPM → low score (0.2-0.4)
    // - Slow: 100-120 WPM → below average (0.4-0.5)
    // - Normal: 120-160 WPM → average (0.5-0.7)
    // - Fast: 160-200 WPM → engaging (0.7-0.9)
    // - Very fast: > 200 WPM → very engaging (0.9-1.0)

    let score: number;

    if (wpm < 100) {
      // Very slow: 0.2 - 0.4
      score = 0.2 + (wpm / 100) * 0.2;
    } else if (wpm < 120) {
      // Slow: 0.4 - 0.5
      score = 0.4 + ((wpm - 100) / 20) * 0.1;
    } else if (wpm < 160) {
      // Normal: 0.5 - 0.7
      score = 0.5 + ((wpm - 120) / 40) * 0.2;
    } else if (wpm < 200) {
      // Fast: 0.7 - 0.9
      score = 0.7 + ((wpm - 160) / 40) * 0.2;
    } else {
      // Very fast: 0.9 - 1.0 (cap at 1.0)
      score = Math.min(0.9 + ((wpm - 200) / 100) * 0.1, 1.0);
    }

    logger.debug({
      segmentId: segment.id,
      wordCount,
      duration: duration.toFixed(2),
      wpm: wpm.toFixed(1),
      speechRateScore: score.toFixed(3)
    }, 'Speech rate calculated');

    return score;
  }
}

/**
 * Factory function to create AudioAnalyzer
 * @param aiClient Optional OpenRouter client for AI emotion analysis
 */
export function createAudioAnalyzer(aiClient?: OpenRouterClient): AudioAnalyzer {
  return new AudioAnalyzer(aiClient);
}
