/**
 * Types for Narrative Enhancement
 *
 * AI-powered video content analysis and narrative generation
 * for creating unique viral shorts from original videos.
 */

import { z } from 'zod';

// =============================================================================
// NARRATIVE STYLES
// =============================================================================

export const NarrativeStyleEnum = z.enum([
  'recap',        // Пересказ ("В этом моменте герой обнаруживает...")
  'reaction',     // Реакция ("Вау! Посмотрите на это!")
  'analysis',     // Анализ ("Обратите внимание на деталь...")
  'humor',        // Юмор ("Он думал что это сработает, но...")
  'educational',  // Обучение ("Это отличный пример того как...")
  'suspense'      // Интрига ("Но что же произойдет дальше?...")
]);

export type NarrativeStyle = z.infer<typeof NarrativeStyleEnum>;

export const NarrativeToneEnum = z.enum([
  'excited',   // Возбужденный/энергичный
  'calm',      // Спокойный
  'dramatic',  // Драматичный
  'humorous'   // Юмористический
]);

export type NarrativeTone = z.infer<typeof NarrativeToneEnum>;

// =============================================================================
// VISUAL ANALYSIS
// =============================================================================

export const VisionProviderEnum = z.enum([
  'gpt4v',    // GPT-4 Vision (recommended)
  'claude',   // Claude 3.5 Sonnet Vision
  'gemini',   // Gemini Vision Pro
  'local'     // Local models (LLaVA, BLIP-2)
]);

export type VisionProvider = z.infer<typeof VisionProviderEnum>;

export const SceneAnalysisSchema = z.object({
  timestamp: z.number(),
  description: z.string(),
  objects: z.array(z.string()),
  mood: z.string(),
  actions: z.array(z.string()),
  faces: z.array(z.object({
    emotion: z.string(),
    count: z.number()
  })).optional()
});

export type SceneAnalysis = z.infer<typeof SceneAnalysisSchema>;

export const VisualAnalysisSchema = z.object({
  scenes: z.array(SceneAnalysisSchema),
  overall: z.object({
    setting: z.string(),
    timeOfDay: z.string(),
    genre: z.string(),
    summary: z.string()
  }),
  analyzedAt: z.date(),
  provider: VisionProviderEnum,
  framesAnalyzed: z.number()
});

export type VisualAnalysis = z.infer<typeof VisualAnalysisSchema>;

// =============================================================================
// NARRATIVE GENERATION
// =============================================================================

export const NarrativeProviderEnum = z.enum([
  'gpt4',     // GPT-4 / GPT-4 Turbo
  'claude',   // Claude 3.5 Sonnet
  'gemini',   // Gemini Pro
  'local'     // Local LLM (Llama 3, Mixtral)
]);

export type NarrativeProvider = z.infer<typeof NarrativeProviderEnum>;

export const GeneratedNarrativeSchema = z.object({
  text: z.string(),
  style: NarrativeStyleEnum,
  tone: NarrativeToneEnum,
  language: z.enum(['ru', 'en']),
  estimatedDuration: z.number(),
  keywords: z.array(z.string()),
  wordCount: z.number(),
  generatedAt: z.date(),
  provider: NarrativeProviderEnum
});

export type GeneratedNarrative = z.infer<typeof GeneratedNarrativeSchema>;

// =============================================================================
// ENHANCEMENT OPTIONS
// =============================================================================

export const VisualAnalysisOptionsSchema = z.object({
  enabled: z.boolean().default(true),
  frameCount: z.number().min(1).max(20).default(5),
  provider: VisionProviderEnum.default('gpt4v'),
  detailLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed')
});

export type VisualAnalysisOptions = z.infer<typeof VisualAnalysisOptionsSchema>;

export const NarrativeOptionsSchema = z.object({
  style: NarrativeStyleEnum.default('recap'),
  tone: NarrativeToneEnum.default('excited'),
  language: z.enum(['ru', 'en']).default('ru'),
  maxWords: z.number().min(20).max(100).default(50),
  provider: NarrativeProviderEnum.default('gpt4')
});

export type NarrativeOptions = z.infer<typeof NarrativeOptionsSchema>;

export const VideoEnhancementOptionsSchema = z.object({
  voice: z.string().optional(),  // Kokoro voice ID
  addSubtitles: z.boolean().default(true),
  keepOriginalAudio: z.boolean().default(false),
  originalAudioVolume: z.number().min(0).max(1).default(0.2),
  textOverlays: z.array(z.any()).optional(),  // TextOverlay from shorts.ts
  effects: z.array(z.any()).optional()        // Effect from shorts.ts
});

export type VideoEnhancementOptions = z.infer<typeof VideoEnhancementOptionsSchema>;

export const EnhancementOptionsSchema = z.object({
  enabled: z.boolean().default(false),
  visualAnalysis: VisualAnalysisOptionsSchema.optional(),
  narrative: NarrativeOptionsSchema.optional(),
  video: VideoEnhancementOptionsSchema.optional()
});

export type EnhancementOptions = z.infer<typeof EnhancementOptionsSchema>;

// =============================================================================
// ENHANCED CLIP
// =============================================================================

export const EnhancedClipSchema = z.object({
  // Base clip info (from GeneratedClip)
  clipId: z.string(),
  originalPath: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  score: z.number(),
  originalTranscript: z.string(),
  orientation: z.enum(['portrait', 'landscape']),
  createdAt: z.date(),

  // Enhanced version
  enhancedPath: z.string(),
  enhancedUrl: z.string().optional(),

  // AI Analysis
  visualAnalysis: VisualAnalysisSchema,

  // Generated Narrative
  narrative: GeneratedNarrativeSchema.extend({
    audioPath: z.string(),
    audioDuration: z.number()
  }),

  // Enhancement metadata
  enhancedAt: z.date(),
  enhancementDuration: z.number(),  // Time taken to enhance (ms)

  // Video info
  videoInfo: z.object({
    width: z.number(),
    height: z.number(),
    fps: z.number(),
    codec: z.string(),
    fileSize: z.number()
  })
});

export type EnhancedClip = z.infer<typeof EnhancedClipSchema>;

// =============================================================================
// API CONFIGURATION
// =============================================================================

export interface EnhancementConfig {
  // Vision API
  visionProvider: VisionProvider;
  visionApiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
  };

  // Narrative LLM
  narrativeProvider: NarrativeProvider;
  narrativeModel?: string;

  // Performance
  maxConcurrentEnhancements: number;
  enhancementTimeout: number;  // ms

  // Content moderation
  moderationEnabled: boolean;
}

export const DEFAULT_ENHANCEMENT_CONFIG: EnhancementConfig = {
  visionProvider: 'gpt4v',
  visionApiKeys: {},
  narrativeProvider: 'gpt4',
  narrativeModel: 'gpt-4-turbo-preview',
  maxConcurrentEnhancements: 3,
  enhancementTimeout: 180000,  // 3 minutes
  moderationEnabled: true
};

// =============================================================================
// ERROR HANDLING
// =============================================================================

export enum EnhancementErrorCode {
  VISION_API_ERROR = 'VISION_API_ERROR',
  NARRATIVE_API_ERROR = 'NARRATIVE_API_ERROR',
  TTS_ERROR = 'TTS_ERROR',
  VIDEO_CREATION_ERROR = 'VIDEO_CREATION_ERROR',
  CONTENT_MODERATION_FAILED = 'CONTENT_MODERATION_FAILED',
  ENHANCEMENT_TIMEOUT = 'ENHANCEMENT_TIMEOUT',
  INSUFFICIENT_VISUAL_DATA = 'INSUFFICIENT_VISUAL_DATA'
}

export class EnhancementError extends Error {
  constructor(
    public code: EnhancementErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'EnhancementError';
  }
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface NarrativeGenerationInput {
  visualAnalysis: VisualAnalysis;
  originalTranscript?: string;
  clipContext?: string;
  options: NarrativeOptions;
}

export interface VideoEnhancementInput {
  originalClipPath: string;
  narrative: GeneratedNarrative;
  options: VideoEnhancementOptions;
  orientation: 'portrait' | 'landscape';
}

export interface EnhancementProgress {
  clipId: string;
  stage: 'visual_analysis' | 'narrative_generation' | 'tts' | 'video_creation' | 'completed' | 'failed';
  progress: number;  // 0-100
  message: string;
  error?: string;
}
