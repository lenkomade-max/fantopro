/**
 * Visual Content Analyzer
 *
 * Analyzes video frames using Vision AI to understand what's happening
 * Uses FREE models from OpenRouter (Qwen 2 VL, Llama 3.2 Vision, Gemini)
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import pino from 'pino';
import {
  VisualAnalysis,
  VisualAnalysisOptions,
  SceneAnalysis,
  EnhancementError,
  EnhancementErrorCode
} from '../types/narrative-enhancement';
import { OpenRouterClient } from './OpenRouterClient';
import { ModelSelector, PromptBuilder } from './ModelSelector';

const logger = pino({ name: 'VisualContentAnalyzer' });

export class VisualContentAnalyzer {
  constructor(
    private openRouter: OpenRouterClient,
    private modelSelector: ModelSelector,
    private tempDir: string = './static/video-analyzer/temp'
  ) {}

  /**
   * Analyze video clip visually
   */
  async analyzeClip(
    clipPath: string,
    options: VisualAnalysisOptions
  ): Promise<VisualAnalysis> {
    logger.info({ clipPath, options }, 'Starting visual analysis');

    try {
      // 1. Extract keyframes
      const frames = await this.extractKeyframes(
        clipPath,
        options.frameCount || 5
      );

      logger.info({ frameCount: frames.length }, 'Extracted keyframes');

      // 2. Select model
      const modelSelection = this.modelSelector.selectVisionModel({
        complexity: options.detailLevel === 'comprehensive' ? 'complex' : 'medium',
        needsReasoning: options.detailLevel === 'comprehensive'
      });

      logger.info({
        model: modelSelection.model,
        reasoning: modelSelection.reasoning,
        cost: modelSelection.estimatedCost
      }, 'Selected vision model');

      // 3. Build prompt
      const prompt = PromptBuilder.buildVisionPrompt(
        frames.length,
        options.detailLevel || 'detailed'
      );

      // 4. Send to Vision AI
      const analysis = await this.analyzeFrames(
        frames,
        prompt,
        modelSelection.model,
        modelSelection.fallbacks
      );

      // 5. Cleanup temp files
      await this.cleanupFrames(frames);

      logger.info({
        sceneCount: analysis.scenes.length,
        provider: modelSelection.model
      }, 'Visual analysis completed');

      return {
        ...analysis,
        analyzedAt: new Date(),
        provider: options.provider || 'gpt4v',
        framesAnalyzed: frames.length
      };

    } catch (error: any) {
      logger.error({ error: error.message, clipPath }, 'Visual analysis failed');

      throw new EnhancementError(
        EnhancementErrorCode.VISION_API_ERROR,
        `Failed to analyze video: ${error.message}`,
        { clipPath, options }
      );
    }
  }

  /**
   * Extract keyframes from video
   */
  private async extractKeyframes(
    videoPath: string,
    count: number
  ): Promise<string[]> {
    if (!existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    // Get video duration
    const duration = await this.getVideoDuration(videoPath);

    // Calculate frame timestamps (evenly distributed)
    const timestamps: number[] = [];
    for (let i = 0; i < count; i++) {
      const time = (duration / (count + 1)) * (i + 1);
      timestamps.push(time);
    }

    // Extract frames
    const framePaths: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const framePath = path.join(
        this.tempDir,
        `frame_${Date.now()}_${i}.jpg`
      );

      await this.extractFrame(videoPath, timestamps[i], framePath);
      framePaths.push(framePath);
    }

    return framePaths;
  }

  /**
   * Get video duration
   */
  private getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
  }

  /**
   * Extract single frame at timestamp
   */
  private extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Analyze frames with Vision AI
   */
  private async analyzeFrames(
    framePaths: string[],
    prompt: string,
    primaryModel: string,
    fallbackModels: string[]
  ): Promise<Omit<VisualAnalysis, 'analyzedAt' | 'provider' | 'framesAnalyzed'>> {
    // Convert frames to base64
    const frameData = await Promise.all(
      framePaths.map(async (path, index) => {
        const buffer = await fs.readFile(path);
        const base64 = buffer.toString('base64');
        return {
          timestamp: index,
          dataUrl: `data:image/jpeg;base64,${base64}`
        };
      })
    );

    // Build messages for Vision API
    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: prompt },
          ...frameData.map(frame => ({
            type: 'image_url' as const,
            image_url: { url: frame.dataUrl }
          }))
        ]
      }
    ];

    // Call OpenRouter with fallback
    const { response, modelUsed } = await this.openRouter.chatWithFallback(
      primaryModel,
      fallbackModels,
      {
        messages,
        max_tokens: 2000,
        temperature: 0.3,  // Lower temperature for factual analysis
        response_format: { type: 'json_object' }
      }
    );

    logger.info({
      model: modelUsed,
      tokens: response.usage.total_tokens
    }, 'Vision AI response received');

    // Parse JSON response
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Transform to our format
    return this.transformVisionResponse(parsed);
  }

  /**
   * Transform Vision API response to our format
   */
  private transformVisionResponse(response: any): Omit<VisualAnalysis, 'analyzedAt' | 'provider' | 'framesAnalyzed'> {
    // Handle different response formats
    const scenes: SceneAnalysis[] = [];

    if (response.scenes && Array.isArray(response.scenes)) {
      for (const scene of response.scenes) {
        scenes.push({
          timestamp: scene.timestamp || 0,
          description: scene.description || '',
          objects: scene.objects || scene.key_objects || [],
          mood: scene.mood || response.overall?.mood || '',
          actions: scene.actions || [],
          faces: scene.faces
        });
      }
    } else {
      // Single scene response (basic analysis)
      scenes.push({
        timestamp: 0,
        description: response.summary || response.description || '',
        objects: response.key_objects || response.objects || [],
        mood: response.mood || '',
        actions: response.actions || []
      });
    }

    return {
      scenes,
      overall: {
        setting: response.overall?.setting || response.setting || 'unknown',
        timeOfDay: response.overall?.timeOfDay || response.time_of_day || 'unknown',
        genre: response.overall?.genre || response.genre || 'unknown',
        summary: response.overall?.summary || response.summary || scenes[0]?.description || ''
      }
    };
  }

  /**
   * Cleanup temporary frame files
   */
  private async cleanupFrames(framePaths: string[]): Promise<void> {
    await Promise.all(
      framePaths.map(async (path) => {
        try {
          if (existsSync(path)) {
            await fs.unlink(path);
          }
        } catch (error) {
          logger.warn({ path, error }, 'Failed to cleanup frame');
        }
      })
    );
  }
}
