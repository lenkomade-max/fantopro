/**
 * Video Analyzer Type Definitions and Zod Schemas
 *
 * This file contains all TypeScript types and Zod validation schemas
 * for the video-analyzer module.
 */

import { z } from 'zod';

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

/**
 * Video source types
 */
export const VideoSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('youtube'),
    url: z.string().url('Invalid YouTube URL')
  }),
  z.object({
    type: z.literal('url'),
    url: z.string().url('Invalid video URL')
  }),
  z.object({
    type: z.literal('upload'),
    file: z.any() // Express.Multer.File or Buffer
  })
]);

export type VideoSource = z.infer<typeof VideoSourceSchema>;

/**
 * Analysis configuration options
 */
export const AnalysisOptionsSchema = z.object({
  clipDuration: z.number().min(30).max(180).default(60)
    .describe('Target duration for each clip in seconds'),
  clipCount: z.number().min(1).max(20).default(5)
    .describe('Number of clips to generate'),
  minScore: z.number().min(0).max(1).default(0.6)
    .describe('Minimum interest score threshold (0-1)'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait')
    .describe('Video orientation for output clips')
});

export type AnalysisOptions = z.infer<typeof AnalysisOptionsSchema>;

/**
 * Complete video analysis input
 */
export const VideoAnalysisInputSchema = z.object({
  source: VideoSourceSchema,
  options: AnalysisOptionsSchema.partial().optional()
});

export type VideoAnalysisInput = z.infer<typeof VideoAnalysisInputSchema>;

// =============================================================================
// JOB STATUS & TRACKING
// =============================================================================

/**
 * Job processing status
 */
export type JobStatus =
  | 'pending'        // In queue, not started
  | 'downloading'    // Downloading/acquiring video
  | 'transcribing'   // Transcribing audio with Whisper
  | 'analyzing'      // Analyzing segments for interest
  | 'generating'     // Generating clips
  | 'completed'      // Successfully completed
  | 'failed';        // Failed with error

export const JobStatusSchema = z.enum([
  'pending',
  'downloading',
  'transcribing',
  'analyzing',
  'generating',
  'completed',
  'failed'
]);

/**
 * Job metadata
 */
export interface JobMetadata {
  sourceType: 'youtube' | 'url' | 'upload';
  sourceUrl?: string;
  filename?: string;
  duration?: number;
  fileSize?: number;
  clipsGenerated?: number;
  topScore?: number;
}

/**
 * Analysis job
 */
export interface AnalysisJob {
  jobId: string;
  status: JobStatus;
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  input: VideoAnalysisInput;
  metadata: JobMetadata;
  clips?: GeneratedClip[];
}

// =============================================================================
// TRANSCRIPT & SEGMENTS
// =============================================================================

/**
 * Transcript segment from Whisper
 */
export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

/**
 * Transcript result from Whisper
 */
export interface TranscriptResult {
  text: string;
  language: string;
  duration: number;
  segments: TranscriptSegment[];
}

// =============================================================================
// ANALYSIS SCORES
// =============================================================================

/**
 * Text analysis metrics
 */
export interface TextAnalysisMetrics {
  emotionalIntensity: number;  // 0-1
  keywordDensity: number;       // 0-1
  informationDensity: number;   // 0-1
  questionScore: number;        // 0-1
  actionWords: number;          // 0-1
}

/**
 * Audio analysis metrics
 */
export interface AudioAnalysisMetrics {
  volumeSpikes: number;     // 0-1
  speechRate: number;       // 0-1
  silenceDuration: number;  // 0-1
  energyLevel: number;      // 0-1
}

/**
 * Visual analysis metrics
 */
export interface VisualAnalysisMetrics {
  motionIntensity: number;   // 0-1
  sceneChanges: number;      // 0-1
  faceDetection?: number;    // 0-1 (optional, Phase 2)
  colorVariance: number;     // 0-1
}

/**
 * Combined analysis scores
 */
export interface AnalysisScores {
  text: number;      // 0-1
  audio: number;     // 0-1
  visual: number;    // 0-1
  combined: number;  // 0-1 weighted combination
}

/**
 * Analyzed segment with scores
 */
export interface AnalyzedSegment extends TranscriptSegment {
  scores: AnalysisScores;
  metrics?: {
    text?: TextAnalysisMetrics;
    audio?: AudioAnalysisMetrics;
    visual?: VisualAnalysisMetrics;
  };
}

// =============================================================================
// CLIP GENERATION
// =============================================================================

/**
 * Clip definition (before generation)
 */
export interface ClipDefinition {
  clipId: string;
  startTime: number;
  endTime: number;
  duration: number;
  score: number;
  text: string;
}

/**
 * Generated clip (after generation)
 */
export interface GeneratedClip extends ClipDefinition {
  jobId: string;
  filePath: string;
  fileSize?: number;
  transcript: string;
  scores: AnalysisScores;
  downloadUrl?: string;
  createdAt: Date;
  videoInfo?: {
    width: number;
    height: number;
    fps: number;
    codec: string;
    bitrate: number;
  };
}

// =============================================================================
// VIDEO METADATA
// =============================================================================

/**
 * Video metadata (from yt-dlp or FFprobe)
 */
export interface VideoMetadata {
  title?: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  filesize?: number;
  format?: string;
  codec?: string;
  bitrate?: number;
}

// =============================================================================
// FFmpeg PROCESSING
// =============================================================================

/**
 * Volume statistics from FFmpeg volumedetect
 */
export interface VolumeStats {
  mean_volume: number;  // in dB
  max_volume: number;   // in dB
  variance: number;     // max - mean
}

/**
 * FFmpeg processing options for clip generation
 */
export interface ClipProcessingOptions {
  width: number;
  height: number;
  codec: string;
  preset: string;
  crf: number;
  audioBitrate: string;
}

// =============================================================================
// API RESPONSES
// =============================================================================

/**
 * Job status response
 */
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  currentStage?: string;
  metadata: JobMetadata;
}

/**
 * Clips list response
 */
export interface ClipsListResponse {
  jobId: string;
  totalClips: number;
  clips: GeneratedClip[];
}

/**
 * Job deletion response
 */
export interface JobDeleteResponse {
  message: string;
  jobId: string;
  deletedClips: number;
  freedSpace: number;
}

/**
 * Service info response
 */
export interface ServiceInfoResponse {
  version: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  limits: {
    maxVideoDuration: number;
    maxFileSize: number;
    maxClipsPerJob: number;
    retentionDays: number;
  };
  supportedFormats: string[];
  supportedSources: string[];
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Video analyzer error codes
 */
export enum VideoAnalyzerErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  VIDEO_TOO_LONG = 'VIDEO_TOO_LONG',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  CLIP_GENERATION_FAILED = 'CLIP_GENERATION_FAILED',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  CLIP_NOT_FOUND = 'CLIP_NOT_FOUND',
  INSUFFICIENT_SEGMENTS = 'INSUFFICIENT_SEGMENTS'
}

/**
 * Video analyzer error
 */
export class VideoAnalyzerError extends Error {
  constructor(
    public code: VideoAnalyzerErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VideoAnalyzerError';
  }
}

// =============================================================================
// ANALYZER INTERFACES
// =============================================================================

/**
 * Generic analyzer interface
 */
export interface IAnalyzer<TContext = any, TMetrics = any> {
  analyze(segment: TranscriptSegment, context: TContext): Promise<number>;
  getMetrics?(segment: TranscriptSegment, context: TContext): Promise<TMetrics>;
}

/**
 * Text analyzer interface
 */
export interface ITextAnalyzer extends IAnalyzer<void, TextAnalysisMetrics> {
  setKeywords(keywords: string[]): void;
  getKeywords(): string[];
}

/**
 * Audio analyzer context
 */
export interface AudioAnalyzerContext {
  audioPath: string;
}

/**
 * Audio analyzer interface
 */
export interface IAudioAnalyzer extends IAnalyzer<AudioAnalyzerContext, AudioAnalysisMetrics> {
  extractVolumeStats(audioPath: string, start: number, end: number): Promise<VolumeStats>;
}

/**
 * Visual analyzer context
 */
export interface VisualAnalyzerContext {
  videoPath: string;
}

/**
 * Visual analyzer interface
 */
export interface IVisualAnalyzer extends IAnalyzer<VisualAnalyzerContext, VisualAnalysisMetrics> {
  detectSceneChanges(videoPath: string, start: number, end: number): Promise<number>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Video analyzer configuration
 */
export interface VideoAnalyzerConfig {
  enabled: boolean;
  maxDuration: number;
  maxFileSize: number;
  storageDir: string;
  retentionDays: number;
  youtubeeCookiesFile?: string;

  // Analyzer weights (must sum to 1.0)
  analyzerWeights: {
    text: number;
    audio: number;
    visual: number;
  };

  // Processing options
  processing: {
    maxConcurrentClips: number;
    ffmpegPreset: string;
    outputCrf: number;
    audioBitrate: string;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_ANALYZER_CONFIG: VideoAnalyzerConfig = {
  enabled: true,
  maxDuration: 7200, // 2 hours
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
  storageDir: './static/video-analyzer',
  retentionDays: 7,

  analyzerWeights: {
    text: 0.4,
    audio: 0.3,
    visual: 0.3
  },

  processing: {
    maxConcurrentClips: 3,
    ffmpegPreset: 'medium',
    outputCrf: 23,
    audioBitrate: '128k'
  }
};

// =============================================================================
// Note: All types and schemas are already exported inline above
// =============================================================================
