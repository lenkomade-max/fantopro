/**
 * OpenRouter API Client
 *
 * Provides access to 200+ AI models through OpenRouter.ai
 * Supports smart model selection with free/budget/premium tiers
 */

import axios, { AxiosInstance } from 'axios';
import pino from 'pino';

const logger = pino({ name: 'OpenRouterClient' });

// =============================================================================
// BEST FREE MODELS (январь 2025)
// =============================================================================

export const FREE_MODELS = {
  // Vision Models (для анализа видео)
  vision: {
    // Лучший бесплатный vision model
    primary: 'qwen/qwen2.5-vl-72b-instruct:free',
    // Fallbacks
    alternatives: [
      'qwen/qwen2.5-vl-32b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-4-maverick:free'
    ]
  },

  // Text Generation (для простых задач)
  text: {
    // Лучшие бесплатные text models
    primary: 'nvidia/nemotron-nano-9b-v2:free',
    alternatives: [
      'google/gemini-2.0-flash-exp:free',
      'mistralai/mistral-small-3.2-24b-instruct:free',
      'meta-llama/llama-4-scout:free'
    ]
  },

  // Reasoning (для сложного анализа)
  reasoning: {
    primary: 'google/gemini-2.0-flash-thinking-exp:free',
    alternatives: [
      'deepseek/deepseek-r1:free',
      'qwen/qwq-32b-preview:free'
    ]
  }
};

// =============================================================================
// PREMIUM MODELS (для critical tasks)
// =============================================================================

export const PREMIUM_MODELS = {
  // Для генерации сценария нарратора
  narrative: {
    primary: 'anthropic/claude-3.5-sonnet',  // Claude 3.5 Sonnet
    alternatives: [
      'anthropic/claude-haiku-4.5',  // Более дешевый fallback
      'openai/gpt-4o-mini'
    ]
  }
};

// =============================================================================
// MODEL CAPABILITIES
// =============================================================================

export interface ModelCapabilities {
  supportsVision: boolean;
  supportsReasoning: boolean;
  contextWindow: number;
  costPer1MTokens: number;
  recommended: boolean;
}

export const MODEL_INFO: Record<string, ModelCapabilities> = {
  // Free Vision Models
  'qwen/qwen-2-vl-72b:free': {
    supportsVision: true,
    supportsReasoning: false,
    contextWindow: 32768,
    costPer1MTokens: 0,
    recommended: true
  },
  'meta-llama/llama-3.2-90b-vision-instruct:free': {
    supportsVision: true,
    supportsReasoning: false,
    contextWindow: 131072,
    costPer1MTokens: 0,
    recommended: true
  },
  'google/gemini-2.0-flash-exp:free': {
    supportsVision: true,
    supportsReasoning: false,
    contextWindow: 1048576,  // 1M context!
    costPer1MTokens: 0,
    recommended: true
  },
  'google/gemini-2.0-flash-thinking-exp:free': {
    supportsVision: true,
    supportsReasoning: true,
    contextWindow: 65536,
    costPer1MTokens: 0,
    recommended: true
  },

  // Free Text Models
  'meta-llama/llama-3.3-70b-instruct:free': {
    supportsVision: false,
    supportsReasoning: false,
    contextWindow: 131072,
    costPer1MTokens: 0,
    recommended: true
  },
  'qwen/qwen-2.5-72b-instruct:free': {
    supportsVision: false,
    supportsReasoning: false,
    contextWindow: 32768,
    costPer1MTokens: 0,
    recommended: true
  },
  'meta-llama/llama-3.1-405b-instruct:free': {
    supportsVision: false,
    supportsReasoning: false,
    contextWindow: 131072,
    costPer1MTokens: 0,
    recommended: true
  },

  // Premium Models
  'anthropic/claude-3.7-sonnet': {
    supportsVision: true,
    supportsReasoning: true,
    contextWindow: 200000,
    costPer1MTokens: 3.0,  // Input
    recommended: true
  },
  'anthropic/claude-3.5-sonnet': {
    supportsVision: true,
    supportsReasoning: true,
    contextWindow: 200000,
    costPer1MTokens: 3.0,
    recommended: true
  },
  'openai/gpt-4o': {
    supportsVision: true,
    supportsReasoning: false,
    contextWindow: 128000,
    costPer1MTokens: 2.5,
    recommended: true
  }
};

// =============================================================================
// OPENROUTER CLIENT
// =============================================================================

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatOptions {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  response_format?: { type: 'json_object' | 'text' };
  timeout?: number;
}

export class OpenRouterClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private retryAttempts = 3;
  private retryDelay = 1000;  // ms

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://fantaprojekt.com',
        'X-Title': 'FantaProjekt VideoAnalyzer',
        'Content-Type': 'application/json'
      },
      timeout: 120000  // 2 minutes
    });
  }

  /**
   * Chat completion with automatic retries and fallbacks
   */
  async chat(options: ChatOptions): Promise<OpenRouterResponse> {
    const {
      model,
      messages,
      max_tokens = 4000,
      temperature = 0.7,
      top_p = 0.9,
      response_format,
      timeout
    } = options;

    logger.info({
      model,
      messageCount: messages.length,
      maxTokens: max_tokens
    }, 'OpenRouter chat request');

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.post<OpenRouterResponse>(
          '/chat/completions',
          {
            model,
            messages,
            max_tokens,
            temperature,
            top_p,
            ...(response_format && { response_format })
          },
          {
            timeout: timeout || 120000
          }
        );

        logger.info({
          model,
          usage: response.data.usage,
          finishReason: response.data.choices[0]?.finish_reason
        }, 'OpenRouter chat success');

        return response.data;

      } catch (error: any) {
        const isLastAttempt = attempt === this.retryAttempts;

        // Rate limit error - wait and retry
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);

          if (!isLastAttempt) {
            logger.warn({
              attempt,
              retryAfter,
              model
            }, 'Rate limited, retrying after delay');
            await this.delay(retryAfter * 1000);
            continue;
          }
        }

        // Server error - retry with exponential backoff
        if (error.response?.status >= 500 && !isLastAttempt) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn({
            attempt,
            delay,
            status: error.response.status
          }, 'Server error, retrying');
          await this.delay(delay);
          continue;
        }

        // Other errors - throw immediately
        logger.error({
          model,
          attempt,
          error: error.response?.data || error.message
        }, 'OpenRouter chat failed');

        throw new Error(
          `OpenRouter API error: ${error.response?.data?.error?.message || error.message}`
        );
      }
    }

    throw new Error(`Failed after ${this.retryAttempts} attempts`);
  }

  /**
   * Chat with automatic model fallback
   * If primary model fails, tries alternatives
   */
  async chatWithFallback(
    primaryModel: string,
    fallbackModels: string[],
    options: Omit<ChatOptions, 'model'>
  ): Promise<{ response: OpenRouterResponse; modelUsed: string }> {
    const modelsToTry = [primaryModel, ...fallbackModels];

    for (const model of modelsToTry) {
      try {
        logger.info({ model }, 'Trying model');

        const response = await this.chat({
          ...options,
          model
        });

        return { response, modelUsed: model };

      } catch (error: any) {
        logger.warn({
          failedModel: model,
          error: error.message
        }, 'Model failed, trying fallback');

        // If this was the last model, throw
        if (model === modelsToTry[modelsToTry.length - 1]) {
          throw error;
        }

        // Otherwise continue to next fallback
        continue;
      }
    }

    throw new Error('All models failed');
  }

  /**
   * Get model info
   */
  getModelInfo(model: string): ModelCapabilities | undefined {
    return MODEL_INFO[model];
  }

  /**
   * Check if model supports vision
   */
  supportsVision(model: string): boolean {
    return MODEL_INFO[model]?.supportsVision || false;
  }

  /**
   * Calculate estimated cost
   */
  estimateCost(model: string, tokens: number): number {
    const info = MODEL_INFO[model];
    if (!info) return 0;

    return (tokens / 1_000_000) * info.costPer1MTokens;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
