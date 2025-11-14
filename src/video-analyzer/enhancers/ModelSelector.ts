/**
 * Smart Model Selector
 *
 * Intelligently selects the best model for each task:
 * - FREE models for simple/medium complexity
 * - PREMIUM models only for narrative generation (critical quality)
 */

import { NarrativeStyle, NarrativeTone, VisionProvider } from '../types/narrative-enhancement';
import { FREE_MODELS, PREMIUM_MODELS } from './OpenRouterClient';
import pino from 'pino';

const logger = pino({ name: 'ModelSelector' });

// =============================================================================
// COST STRATEGIES
// =============================================================================

export type CostStrategy = 'free' | 'budget' | 'premium';

export interface ModelSelectionResult {
  model: string;
  fallbacks: string[];
  reasoning: string;
  estimatedCost: number;
}

// =============================================================================
// MODEL SELECTOR
// =============================================================================

export class ModelSelector {
  private costStrategy: CostStrategy;

  constructor(costStrategy: CostStrategy = 'budget') {
    this.costStrategy = costStrategy;
    logger.info({ costStrategy }, 'ModelSelector initialized');
  }

  /**
   * Select vision model for visual analysis
   *
   * ALWAYS uses FREE models (no need for premium here)
   */
  selectVisionModel(options: {
    complexity?: 'simple' | 'medium' | 'complex';
    needsReasoning?: boolean;
  } = {}): ModelSelectionResult {
    const { complexity = 'medium', needsReasoning = false } = options;

    // Если нужен reasoning - используем Gemini Thinking (FREE!)
    if (needsReasoning) {
      return {
        model: FREE_MODELS.reasoning.primary,
        fallbacks: FREE_MODELS.reasoning.alternatives,
        reasoning: 'Complex scene requires reasoning - using Gemini Thinking (FREE)',
        estimatedCost: 0
      };
    }

    // Для vision анализа ВСЕГДА бесплатные модели
    // Qwen 2 VL 72B отлично справляется
    return {
      model: FREE_MODELS.vision.primary,
      fallbacks: FREE_MODELS.vision.alternatives,
      reasoning: `Visual analysis with complexity=${complexity} - using FREE vision model`,
      estimatedCost: 0
    };
  }

  /**
   * Select model for narrative generation
   *
   * THIS IS THE CRITICAL PART - uses PREMIUM for quality
   */
  selectNarrativeModel(options: {
    style: NarrativeStyle;
    tone: NarrativeTone;
    language: 'ru' | 'en';
  }): ModelSelectionResult {
    const { style, tone, language } = options;

    // ВАЖНО: Для генерации сценария нарратора используем PREMIUM
    // Claude 3.7 Sonnet или GPT-4 - это критическая задача для качества

    logger.info({
      style,
      tone,
      language,
      strategy: this.costStrategy
    }, 'Selecting PREMIUM model for narrative');

    // Выбираем лучшую premium модель
    const primaryModel = PREMIUM_MODELS.narrative.primary;
    const fallbacks = PREMIUM_MODELS.narrative.alternatives;

    // Оцениваем стоимость
    // Claude 3.7 Sonnet: $3 per 1M input, $15 per 1M output
    // Типичный narrative: ~500 input + ~150 output = ~$0.004
    const estimatedCost = 0.004;

    return {
      model: primaryModel,
      fallbacks,
      reasoning: `PREMIUM narrative generation: ${style} style with ${tone} tone in ${language}. Using ${primaryModel} for maximum quality.`,
      estimatedCost
    };
  }

  /**
   * Select model for simple text tasks (title, description, hashtags)
   *
   * Uses FREE models - good enough for these tasks
   */
  selectUtilityModel(task: 'title' | 'description' | 'hashtags'): ModelSelectionResult {
    // Для простых задач - бесплатные модели отлично справляются
    return {
      model: FREE_MODELS.text.primary,
      fallbacks: FREE_MODELS.text.alternatives,
      reasoning: `Utility task (${task}) - using FREE text model (Llama 3.3 70B)`,
      estimatedCost: 0
    };
  }

  /**
   * Select model for content analysis/classification
   */
  selectAnalysisModel(options: {
    complexity: 'simple' | 'complex';
  }): ModelSelectionResult {
    const { complexity } = options;

    if (complexity === 'complex') {
      // Сложный анализ - reasoning model (но всё ещё FREE!)
      return {
        model: FREE_MODELS.reasoning.primary,
        fallbacks: FREE_MODELS.reasoning.alternatives,
        reasoning: 'Complex analysis - using FREE reasoning model',
        estimatedCost: 0
      };
    }

    // Простой анализ - обычные text models
    return {
      model: FREE_MODELS.text.primary,
      fallbacks: FREE_MODELS.text.alternatives,
      reasoning: 'Simple analysis - using FREE text model',
      estimatedCost: 0
    };
  }

  /**
   * Get model recommendation summary
   */
  getRecommendations(): {
    vision: string;
    narrative: string;
    utility: string;
    totalEstimatedCost: number;
  } {
    const visionSelection = this.selectVisionModel();
    const narrativeSelection = this.selectNarrativeModel({
      style: 'recap',
      tone: 'excited',
      language: 'ru'
    });
    const utilitySelection = this.selectUtilityModel('title');

    // Для 10 клипов:
    const totalEstimatedCost =
      (visionSelection.estimatedCost * 10) +  // Vision: $0
      (narrativeSelection.estimatedCost * 10) +  // Narrative: $0.04
      (utilitySelection.estimatedCost * 30);  // 3 utility tasks per clip: $0

    return {
      vision: visionSelection.model,
      narrative: narrativeSelection.model,
      utility: utilitySelection.model,
      totalEstimatedCost
    };
  }

  /**
   * Update cost strategy
   */
  setCostStrategy(strategy: CostStrategy): void {
    this.costStrategy = strategy;
    logger.info({ strategy }, 'Cost strategy updated');
  }
}

// =============================================================================
// SMART PROMPTS
// =============================================================================

export class PromptBuilder {
  /**
   * Build vision analysis prompt (SHORT for cost efficiency)
   */
  static buildVisionPrompt(frameCount: number, detailLevel: 'basic' | 'detailed' | 'comprehensive'): string {
    if (detailLevel === 'basic') {
      return `Analyze these ${frameCount} video frames in 2-3 sentences.

Output JSON:
{
  "summary": "Brief description of what's happening",
  "mood": "overall emotional tone",
  "key_objects": ["object1", "object2", ...],
  "actions": ["action1", "action2", ...]
}`;
    }

    if (detailLevel === 'detailed') {
      return `Analyze these ${frameCount} video frames from a video clip.

Output JSON:
{
  "scenes": [
    {
      "timestamp": 0,
      "description": "What's happening in this frame",
      "mood": "emotional tone",
      "objects": ["visible objects"],
      "actions": ["what people are doing"]
    }
  ],
  "overall": {
    "setting": "where does this take place",
    "genre": "genre/style of content",
    "summary": "brief 1-sentence summary"
  }
}`;
    }

    // Comprehensive
    return `Perform detailed analysis of these ${frameCount} video frames.

Output JSON:
{
  "scenes": [
    {
      "timestamp": 0,
      "description": "detailed description",
      "objects": ["all visible objects"],
      "mood": "emotional tone",
      "actions": ["character actions"],
      "faces": [{"emotion": "emotion", "count": 1}]
    }
  ],
  "overall": {
    "setting": "detailed setting description",
    "timeOfDay": "time of day if visible",
    "genre": "content genre",
    "summary": "comprehensive summary"
  }
}`;
  }

  /**
   * Build narrative generation prompt (OPTIMIZED for quality)
   */
  static buildNarrativePrompt(options: {
    visualSummary: string;
    originalTranscript?: string;
    style: NarrativeStyle;
    tone: NarrativeTone;
    language: 'ru' | 'en';
    maxWords: number;
  }): { system: string; user: string } {
    const { visualSummary, originalTranscript, style, tone, language, maxWords } = options;

    const styleGuides = {
      recap: 'Создай краткий пересказ момента. Фокус на событиях и сюжете.',
      reaction: 'Создай реакцию-комментарий. Используй эмоции и восклицания.',
      analysis: 'Создай аналитический комментарий. Обрати внимание на детали.',
      humor: 'Создай юмористический комментарий. Найди смешные или неожиданные моменты.',
      educational: 'Создай образовательный комментарий. Объясни что важного происходит.',
      suspense: 'Создай интригующий комментарий. Заставь хотеть смотреть дальше.'
    };

    const toneGuides = {
      excited: 'Энергично! Много восклицаний! Заразительный энтузиазм!',
      calm: 'Спокойно и размеренно. Уверенный тон.',
      dramatic: 'Драматично. Подчеркивай важность и напряжение.',
      humorous: 'С юмором. Легко и весело.'
    };

    const systemPrompt = language === 'ru'
      ? `Ты - вирусный контент-креатор для TikTok, Reels и Shorts.

ТВОЯ ЗАДАЧА: Создавать короткие (${maxWords} слов макс) интересные тексты для видео,
которые МАКСИМИЗИРУЮТ досмотры и вовлечение.

ПРАВИЛА:
1. ${styleGuides[style]}
2. Тон: ${toneGuides[tone]}
3. Используй прямое обращение ("Смотрите!", "Обратите внимание!")
4. Создавай интригу и suspense
5. Никаких клише и банальностей
6. Текст должен ЦЕПЛЯТЬ с первой секунды

ФОРМАТ: Только текст нарратива, без дополнительных комментариев.`
      : `You are a viral content creator for TikTok, Reels and Shorts.

YOUR TASK: Create short (max ${maxWords} words) engaging narrations that
MAXIMIZE watch time and engagement.

RULES:
1. ${styleGuides[style]}
2. Tone: ${toneGuides[tone]}
3. Use direct address ("Look!", "Check this out!")
4. Create intrigue and suspense
5. No clichés
6. Hook viewers from the first second

FORMAT: Only the narration text, no additional commentary.`;

    const userPrompt = language === 'ru'
      ? `Создай вирусный нарратив для этого момента:

Визуальный контент: ${visualSummary}
${originalTranscript ? `Оригинальная речь: ${originalTranscript}` : ''}

Нарратив (${maxWords} слов, стиль: ${style}, тон: ${tone}):`
      : `Create viral narration for this moment:

Visual content: ${visualSummary}
${originalTranscript ? `Original speech: ${originalTranscript}` : ''}

Narration (${maxWords} words, style: ${style}, tone: ${tone}):`;

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * Build utility prompts (title, description, hashtags)
   */
  static buildUtilityPrompt(
    task: 'title' | 'description' | 'hashtags',
    context: { narrative: string; visualSummary: string }
  ): string {
    const { narrative, visualSummary } = context;

    if (task === 'title') {
      return `Create a catchy TikTok/Reels title (max 100 chars) for this video:

Narration: ${narrative}
Visual: ${visualSummary}

Title (without quotes):`;
    }

    if (task === 'description') {
      return `Create an engaging description (max 200 chars) for this video:

Narration: ${narrative}
Visual: ${visualSummary}

Description:`;
    }

    // hashtags
    return `Generate 5-8 relevant hashtags for this video:

Narration: ${narrative}
Visual: ${visualSummary}

Hashtags (comma-separated, with #):`;
  }
}
