/**
 * Narrative Generator
 *
 * Generates engaging viral narratives using PREMIUM AI models
 * Uses Claude 3.7 Sonnet or GPT-4 for maximum quality
 */

import pino from 'pino';
import {
  GeneratedNarrative,
  NarrativeGenerationInput,
  NarrativeStyle,
  NarrativeTone,
  EnhancementError,
  EnhancementErrorCode
} from '../types/narrative-enhancement';
import { OpenRouterClient } from './OpenRouterClient';
import { ModelSelector, PromptBuilder } from './ModelSelector';

const logger = pino({ name: 'NarrativeGenerator' });

export class NarrativeGenerator {
  constructor(
    private openRouter: OpenRouterClient,
    private modelSelector: ModelSelector
  ) {}

  /**
   * Generate narrative from visual analysis
   *
   * THIS IS THE CRITICAL TASK - uses PREMIUM models
   */
  async generateNarrative(
    input: NarrativeGenerationInput
  ): Promise<GeneratedNarrative> {
    const { visualAnalysis, originalTranscript, clipContext, options } = input;

    logger.info({
      style: options.style,
      tone: options.tone,
      language: options.language,
      maxWords: options.maxWords
    }, 'Generating narrative');

    try {
      // 1. Select PREMIUM model for narrative
      const modelSelection = this.modelSelector.selectNarrativeModel({
        style: options.style,
        tone: options.tone,
        language: options.language
      });

      logger.info({
        model: modelSelection.model,
        estimatedCost: modelSelection.estimatedCost,
        reasoning: modelSelection.reasoning
      }, 'Using PREMIUM model for narrative');

      // 2. Build optimized prompt
      const visualSummary = this.buildVisualSummary(visualAnalysis);
      const { system, user } = PromptBuilder.buildNarrativePrompt({
        visualSummary,
        originalTranscript,
        style: options.style,
        tone: options.tone,
        language: options.language,
        maxWords: options.maxWords || 50
      });

      // 3. Generate narrative with premium model
      const { response, modelUsed } = await this.openRouter.chatWithFallback(
        modelSelection.model,
        modelSelection.fallbacks,
        {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          max_tokens: 500,  // Short response
          temperature: 0.9,  // High creativity for engaging content
          top_p: 0.95
        }
      );

      const narrativeText = response.choices[0].message.content.trim();

      logger.info({
        model: modelUsed,
        length: narrativeText.length,
        tokens: response.usage.total_tokens,
        cost: this.openRouter.estimateCost(modelUsed, response.usage.total_tokens)
      }, 'Narrative generated');

      // 4. Extract keywords and estimate duration
      const keywords = this.extractKeywords(narrativeText, options.language);
      const wordCount = narrativeText.split(/\s+/).length;
      const estimatedDuration = this.estimateSpeechDuration(wordCount, options.language);

      return {
        text: narrativeText,
        style: options.style,
        tone: options.tone,
        language: options.language,
        estimatedDuration,
        keywords,
        wordCount,
        generatedAt: new Date(),
        provider: options.provider || 'gpt4'
      };

    } catch (error: any) {
      logger.error({
        error: error.message,
        style: options.style
      }, 'Narrative generation failed');

      throw new EnhancementError(
        EnhancementErrorCode.NARRATIVE_API_ERROR,
        `Failed to generate narrative: ${error.message}`,
        { options }
      );
    }
  }

  /**
   * Generate title for social media
   */
  async generateTitle(context: {
    narrative: string;
    visualSummary: string;
    language: 'ru' | 'en';
  }): Promise<string> {
    const { narrative, visualSummary, language } = context;

    logger.info({ language }, 'Generating title');

    // Use FREE model for title (good enough)
    const modelSelection = this.modelSelector.selectUtilityModel('title');

    const prompt = PromptBuilder.buildUtilityPrompt('title', {
      narrative,
      visualSummary
    });

    const { response } = await this.openRouter.chatWithFallback(
      modelSelection.model,
      modelSelection.fallbacks,
      {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.8
      }
    );

    return response.choices[0].message.content.trim();
  }

  /**
   * Generate description for social media
   */
  async generateDescription(context: {
    narrative: string;
    visualSummary: string;
    language: 'ru' | 'en';
  }): Promise<string> {
    const { narrative, visualSummary, language } = context;

    logger.info({ language }, 'Generating description');

    // Use FREE model for description
    const modelSelection = this.modelSelector.selectUtilityModel('description');

    const prompt = PromptBuilder.buildUtilityPrompt('description', {
      narrative,
      visualSummary
    });

    const { response } = await this.openRouter.chatWithFallback(
      modelSelection.model,
      modelSelection.fallbacks,
      {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      }
    );

    return response.choices[0].message.content.trim();
  }

  /**
   * Generate hashtags for social media
   */
  async generateHashtags(context: {
    narrative: string;
    visualSummary: string;
    language: 'ru' | 'en';
  }): Promise<string[]> {
    const { narrative, visualSummary, language } = context;

    logger.info({ language }, 'Generating hashtags');

    // Use FREE model for hashtags
    const modelSelection = this.modelSelector.selectUtilityModel('hashtags');

    const prompt = PromptBuilder.buildUtilityPrompt('hashtags', {
      narrative,
      visualSummary
    });

    const { response } = await this.openRouter.chatWithFallback(
      modelSelection.model,
      modelSelection.fallbacks,
      {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.6
      }
    );

    const hashtagsText = response.choices[0].message.content.trim();

    // Parse hashtags
    return hashtagsText
      .split(/[,\s]+/)
      .filter(tag => tag.startsWith('#'))
      .map(tag => tag.trim())
      .slice(0, 8);  // Max 8 hashtags
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Build concise visual summary for prompt
   */
  private buildVisualSummary(visualAnalysis: any): string {
    const { overall, scenes } = visualAnalysis;

    // Overall summary
    let summary = overall.summary || '';

    // Add key scene details
    if (scenes && scenes.length > 0) {
      const keyScenes = scenes
        .slice(0, 3)  // Top 3 scenes
        .map((scene: any) => scene.description)
        .filter((desc: string) => desc && desc.length > 0);

      if (keyScenes.length > 0) {
        summary += '. ' + keyScenes.join('. ');
      }
    }

    return summary;
  }

  /**
   * Extract keywords from narrative
   */
  private extractKeywords(text: string, language: 'ru' | 'en'): string[] {
    // Simple keyword extraction (can be improved with NLP)
    const words = text
      .toLowerCase()
      .replace(/[.,!?;:()]/g, '')
      .split(/\s+/);

    // Common stop words
    const stopWords = language === 'ru'
      ? ['и', 'в', 'не', 'на', 'с', 'что', 'как', 'это', 'для', 'от', 'до', 'из', 'по']
      : ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];

    // Filter and count
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      if (word.length < 3 || stopWords.includes(word)) continue;

      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    // Sort by frequency and return top 5
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Estimate speech duration in seconds
   */
  private estimateSpeechDuration(wordCount: number, language: 'ru' | 'en'): number {
    // Average speaking rate
    // Russian: ~180 words/minute = 3 words/second
    // English: ~150 words/minute = 2.5 words/second

    const wordsPerSecond = language === 'ru' ? 3 : 2.5;

    return wordCount / wordsPerSecond;
  }
}
