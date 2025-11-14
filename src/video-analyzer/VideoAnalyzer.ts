/**
 * Video Analyzer - Main Orchestrator
 *
 * Coordinates the entire video analysis and clip generation pipeline:
 * 1. Video acquisition (YouTube/URL/Upload)
 * 2. Audio extraction
 * 3. Transcription (Whisper)
 * 4. Multi-modal analysis (Text + Audio + Visual)
 * 5. Clip selection and generation
 * 6. State management and cleanup
 *
 * Uses queue-based processing (one video at a time).
 */

import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import pino from 'pino';

// Types
import {
  VideoAnalysisInput,
  VideoAnalysisInputSchema,
  AnalysisJob,
  JobStatus,
  AnalyzedSegment,
  GeneratedClip,
  VideoAnalyzerConfig,
  DEFAULT_ANALYZER_CONFIG,
  VideoAnalyzerError,
  VideoAnalyzerErrorCode,
  TranscriptResult
} from './types/video-analysis';

// External dependencies (existing FantaProjekt modules)
import { Whisper } from '../short-creator/libraries/Whisper';

// Video Analyzer modules
import { YouTubeDownloader } from './youtube/YouTubeDownloader';
import { TextAnalyzer } from './analyzers/TextAnalyzer';
import { AudioAnalyzer } from './analyzers/AudioAnalyzer';
import { VisualAnalyzer } from './analyzers/VisualAnalyzer';
import { VideoProcessor } from './processors/VideoProcessor';
import { ClipGenerator } from './processors/ClipGenerator';

const logger = pino({ name: 'VideoAnalyzer' });

export class VideoAnalyzer {
  private config: VideoAnalyzerConfig;
  private jobs: Map<string, AnalysisJob>;
  private queue: string[];
  private isProcessing: boolean;

  // Dependencies
  private whisper: Whisper;
  private youtubeDownloader: YouTubeDownloader;
  private textAnalyzer: TextAnalyzer;
  private audioAnalyzer: AudioAnalyzer;
  private visualAnalyzer: VisualAnalyzer;
  private videoProcessor: VideoProcessor;
  private clipGenerator: ClipGenerator;

  constructor(
    whisper: Whisper,
    youtubeDownloader: YouTubeDownloader,
    textAnalyzer: TextAnalyzer,
    audioAnalyzer: AudioAnalyzer,
    visualAnalyzer: VisualAnalyzer,
    videoProcessor: VideoProcessor,
    clipGenerator: ClipGenerator,
    config?: Partial<VideoAnalyzerConfig>
  ) {
    this.config = { ...DEFAULT_ANALYZER_CONFIG, ...config };
    this.jobs = new Map();
    this.queue = [];
    this.isProcessing = false;

    this.whisper = whisper;
    this.youtubeDownloader = youtubeDownloader;
    this.textAnalyzer = textAnalyzer;
    this.audioAnalyzer = audioAnalyzer;
    this.visualAnalyzer = visualAnalyzer;
    this.videoProcessor = videoProcessor;
    this.clipGenerator = clipGenerator;

    logger.info({
      config: this.config
    }, 'VideoAnalyzer initialized');

    // Start cleanup task (runs every 24 hours)
    this.startCleanupTask();
  }

  /**
   * Submit video for analysis
   * @param input Video analysis input
   * @returns Analysis job
   */
  async analyzeVideo(input: VideoAnalysisInput): Promise<AnalysisJob> {
    // Validate input
    const validated = VideoAnalysisInputSchema.parse(input);

    // Check if module is enabled
    if (!this.config.enabled) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.INVALID_INPUT,
        'Video analyzer module is disabled'
      );
    }

    // Create job
    const job = this.createJob(validated);
    this.jobs.set(job.jobId, job);
    this.queue.push(job.jobId);

    logger.info({
      jobId: job.jobId,
      source: input.source.type,
      queueLength: this.queue.length
    }, 'Job created and queued');

    // Start processing queue
    this.processQueue();

    return job;
  }

  /**
   * Get job status
   * @param jobId Job ID
   * @returns Job status or null if not found
   */
  getJobStatus(jobId: string): AnalysisJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get generated clips for a job
   * @param jobId Job ID
   * @returns Array of clips or null if job not found
   */
  getClips(jobId: string): GeneratedClip[] | null {
    const job = this.jobs.get(jobId);

    if (!job) {
      return null;
    }

    return job.clips || [];
  }

  /**
   * Get a specific clip
   * @param jobId Job ID
   * @param clipId Clip ID
   * @returns Clip or null if not found
   */
  getClip(jobId: string, clipId: string): GeneratedClip | null {
    const clips = this.getClips(jobId);

    if (!clips) {
      return null;
    }

    return clips.find(c => c.clipId === clipId) || null;
  }

  /**
   * Delete job and all associated files
   * @param jobId Job ID
   * @returns Deletion result
   */
  async deleteJob(jobId: string): Promise<{
    deletedClips: number;
    freedSpace: number;
  } | null> {
    const job = this.jobs.get(jobId);

    if (!job) {
      return null;
    }

    logger.info({ jobId }, 'Deleting job');

    let deletedClips = 0;
    let freedSpace = 0;

    // Delete clip files
    if (job.clips) {
      for (const clip of job.clips) {
        try {
          if (existsSync(clip.filePath)) {
            const stats = await fs.stat(clip.filePath);
            freedSpace += stats.size;

            await fs.unlink(clip.filePath);
            deletedClips++;

            logger.debug({
              clipId: clip.clipId,
              filePath: clip.filePath
            }, 'Clip file deleted');
          }
        } catch (error) {
          logger.warn({
            clipId: clip.clipId,
            error
          }, 'Failed to delete clip file');
        }
      }
    }

    // Remove from jobs map
    this.jobs.delete(jobId);

    logger.info({ jobId, deletedClips, freedSpace }, 'Job deleted');

    return { deletedClips, freedSpace };
  }

  /**
   * Get all jobs (with optional filtering)
   * @param status Filter by status (optional)
   * @returns Array of jobs
   */
  getAllJobs(status?: JobStatus): AnalysisJob[] {
    const jobs = Array.from(this.jobs.values());

    if (status) {
      return jobs.filter(j => j.status === status);
    }

    return jobs;
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Create a new analysis job
   * @param input Validated input
   * @returns Analysis job
   */
  private createJob(input: VideoAnalysisInput): AnalysisJob {
    const jobId = randomUUID();

    const job: AnalysisJob = {
      jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      input,
      metadata: {
        sourceType: input.source.type,
        sourceUrl: input.source.type !== 'upload' ? input.source.url : undefined
      }
    };

    return job;
  }

  /**
   * Process job queue (one at a time)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const jobId = this.queue.shift()!;

    try {
      await this.processJob(jobId);
    } catch (error: any) {
      this.handleJobError(jobId, error);
    } finally {
      this.isProcessing = false;

      // Process next job
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Process a single job
   * @param jobId Job ID
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)!;

    logger.info({ jobId, source: job.input.source.type }, 'Processing job');

    try {
      // 1. Acquire video
      this.updateJob(jobId, { status: 'downloading', progress: 10 });
      const videoPath = await this.acquireVideo(job.input.source, jobId);

      // 2. Validate video
      const metadata = await this.videoProcessor.validateVideo(
        videoPath,
        this.config.maxDuration,
        this.config.maxFileSize
      );

      job.metadata.duration = metadata.duration;
      job.metadata.fileSize = metadata.filesize;

      // 3. Extract audio
      this.updateJob(jobId, { status: 'transcribing', progress: 20 });
      const audioPath = await this.extractAudio(videoPath, jobId);

      // 4. Transcribe with Whisper
      const transcript = await this.transcribeAudio(audioPath);

      logger.info({
        jobId,
        segments: transcript.segments.length,
        duration: transcript.duration
      }, 'Transcription complete');

      // 5. Analyze segments
      this.updateJob(jobId, { status: 'analyzing', progress: 50 });
      const analyzedSegments = await this.analyzeSegments(
        transcript.segments,
        audioPath,
        videoPath,
        jobId
      );

      logger.info({
        jobId,
        analyzedSegments: analyzedSegments.length,
        topScore: analyzedSegments[0]?.scores.combined
      }, 'Analysis complete');

      job.metadata.topScore = analyzedSegments[0]?.scores.combined;

      // 6. Generate clips
      this.updateJob(jobId, { status: 'generating', progress: 75 });
      const clips = await this.clipGenerator.generateClips(
        videoPath,
        analyzedSegments,
        {
          clipDuration: job.input.options?.clipDuration || 60,
          clipCount: job.input.options?.clipCount || 5,
          minScore: job.input.options?.minScore || 0.6,
          orientation: job.input.options?.orientation || 'portrait'
        },
        jobId
      );

      logger.info({
        jobId,
        clipsGenerated: clips.length
      }, 'Clips generated');

      job.metadata.clipsGenerated = clips.length;

      // 7. Complete job
      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        clips
      });

      // 8. Cleanup temporary files
      await this.cleanupTempFiles(videoPath, audioPath);

      logger.info({ jobId }, 'Job completed successfully');
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Acquire video from source
   * @param source Video source
   * @param jobId Job ID
   * @returns Path to video file
   */
  private async acquireVideo(
    source: VideoAnalysisInput['source'],
    jobId: string
  ): Promise<string> {
    switch (source.type) {
      case 'youtube':
      case 'url':
        return await this.youtubeDownloader.download(source.url, jobId);

      case 'upload':
        // File already uploaded, move to processing dir
        const uploadedFile = source.file as any;
        const targetPath = path.join(
          this.config.storageDir,
          'uploads',
          `${jobId}.mp4`
        );

        await fs.copyFile(uploadedFile.path, targetPath);
        return targetPath;

      default:
        throw new VideoAnalyzerError(
          VideoAnalyzerErrorCode.INVALID_INPUT,
          'Invalid video source type'
        );
    }
  }

  /**
   * Extract audio from video
   * @param videoPath Video path
   * @param jobId Job ID
   * @returns Audio path
   */
  private async extractAudio(videoPath: string, jobId: string): Promise<string> {
    const audioPath = path.join(
      this.config.storageDir,
      'processing',
      `${jobId}.wav`
    );

    // Ensure processing directory exists
    await fs.mkdir(path.dirname(audioPath), { recursive: true });

    return await this.videoProcessor.extractAudio(videoPath, audioPath);
  }

  /**
   * Transcribe audio with Whisper
   * @param audioPath Audio path
   * @returns Transcript result
   */
  private async transcribeAudio(audioPath: string): Promise<TranscriptResult> {
    // Use Whisper.CreateCaption method from FantaProjekt
    // Convert to absolute path (Whisper requires absolute paths)
    const absoluteAudioPath = path.resolve(audioPath);
    const captions = await this.whisper.CreateCaption(absoluteAudioPath);

    // Convert Caption[] to TranscriptResult
    const fullText = captions.map(c => c.text).join('');
    const duration = captions.length > 0 ? captions[captions.length - 1].endMs / 1000 : 0;

    // Convert captions to segments
    const segments = captions.map((caption, index) => ({
      id: index,
      text: caption.text,
      start: caption.startMs / 1000,
      end: caption.endMs / 1000
    }));

    return {
      text: fullText,
      language: 'ru', // Whisper doesn't return language in Caption format
      duration,
      segments
    };
  }

  /**
   * Analyze all segments (BATCH OPTIMIZED)
   * @param segments Transcript segments
   * @param audioPath Audio path
   * @param videoPath Video path
   * @param jobId Job ID for progress tracking
   * @returns Analyzed segments
   */
  private async analyzeSegments(
    segments: any[],
    audioPath: string,
    videoPath: string,
    jobId: string
  ): Promise<AnalyzedSegment[]> {
    const totalSegments = segments.length;
    logger.info({ jobId, totalSegments }, 'Starting BATCH segment analysis');

    // Update progress: starting analysis
    this.updateJob(jobId, { progress: 52 });

    // BATCH: Analyze all segments at once (parallel + batch FFmpeg)
    const [textScores, audioScores, visualScores] = await Promise.all([
      // Text analysis (fast - no I/O)
      Promise.all(segments.map(s => this.textAnalyzer.analyze(s))),

      // Audio analysis (BATCH - 2 FFmpeg calls total instead of 2800)
      this.audioAnalyzer.analyzeAll(segments, audioPath),

      // Visual analysis (BATCH - 1 FFmpeg call instead of 1400)
      this.visualAnalyzer.analyzeAll(segments, videoPath)
    ]);

    // Update progress: analysis complete, combining scores
    this.updateJob(jobId, { progress: 70 });

    // Combine scores
    const analyzed: AnalyzedSegment[] = segments.map((segment, i) => {
      const textScore = textScores[i];
      const audioScore = audioScores[i];
      const visualScore = visualScores[i];

      const combinedScore = (
        textScore * this.config.analyzerWeights.text +
        audioScore * this.config.analyzerWeights.audio +
        visualScore * this.config.analyzerWeights.visual
      );

      return {
        ...segment,
        scores: {
          text: textScore,
          audio: audioScore,
          visual: visualScore,
          combined: combinedScore
        }
      };
    });

    logger.info({
      jobId,
      analyzedSegments: analyzed.length,
      topScore: analyzed[0]?.scores.combined
    }, 'BATCH segment analysis complete');

    // Sort by combined score (best first)
    return analyzed.sort((a, b) => b.scores.combined - a.scores.combined);
  }

  /**
   * Update job state
   * @param jobId Job ID
   * @param updates Partial updates
   */
  private updateJob(jobId: string, updates: Partial<AnalysisJob>): void {
    const job = this.jobs.get(jobId);

    if (!job) {
      return;
    }

    Object.assign(job, updates, { updatedAt: new Date() });

    this.jobs.set(jobId, job);

    logger.debug({ jobId, updates }, 'Job updated');
  }

  /**
   * Handle job error
   * @param jobId Job ID
   * @param error Error
   */
  private handleJobError(jobId: string, error: any): void {
    logger.error({ jobId, error: error.message, stack: error.stack }, 'Job failed');

    this.updateJob(jobId, {
      status: 'failed',
      error: error.message || 'Unknown error'
    });
  }

  /**
   * Cleanup temporary files
   * @param videoPath Video path
   * @param audioPath Audio path
   */
  private async cleanupTempFiles(videoPath: string, audioPath: string): Promise<void> {
    try {
      if (existsSync(videoPath)) {
        await fs.unlink(videoPath);
      }

      if (existsSync(audioPath)) {
        await fs.unlink(audioPath);
      }

      logger.debug({ videoPath, audioPath }, 'Temporary files cleaned up');
    } catch (error) {
      logger.warn({ error }, 'Failed to cleanup temp files');
    }
  }

  /**
   * Start automatic cleanup task
   */
  private startCleanupTask(): void {
    const interval = 24 * 60 * 60 * 1000; // 24 hours

    setInterval(async () => {
      await this.cleanupOldJobs();
    }, interval);

    logger.info({ intervalHours: 24 }, 'Cleanup task started');
  }

  /**
   * Cleanup jobs older than retention period
   */
  private async cleanupOldJobs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    logger.info({ cutoffDate }, 'Running cleanup task');

    let deletedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffDate) {
        await this.deleteJob(jobId);
        deletedCount++;
      }
    }

    logger.info({ deletedCount }, 'Cleanup task complete');
  }
}
