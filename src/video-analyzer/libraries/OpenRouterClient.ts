/**
 * OpenRouter API Client
 *
 * Unified client for accessing FREE AI models via OpenRouter API.
 *
 * Features:
 * - Rate limiting (1 request/second for free tier)
 * - Automatic fallback to backup models
 * - Retry logic with exponential backoff
 * - Batch processing support
 * - Text and vision completions
 *
 * Primary model: tngtech/deepseek-r1t2-chimera:free
 * Backup model: z-ai/glm-4.5-air:free
 * Vision model: qwen/qwen-2-vl-7b-instruct:free
 */

import pino from 'pino';

const logger = pino({ name: 'OpenRouterClient' });

// =============================================================================
// TYPES
// =============================================================================

export interface OpenRouterConfig {
  apiKey: string;
  primaryModel?: string;
  backupModel?: string;
  visionModel?: string;
  rateLimit?: number; // Requests per second
  maxRetries?: number;
  retryDelay?: number; // Base delay in ms
  timeout?: number; // Request timeout in ms
}

export interface TextCompletionRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string; // Override default model
}

export interface VisionCompletionRequest {
  prompt: string;
  imageUrl: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string; // Override default vision model
}

export interface CompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// =============================================================================
// OPENROUTER CLIENT
// =============================================================================

export class OpenRouterClient {
  private config: Required<OpenRouterConfig>;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  private lastRequestTime: number = 0;

  constructor(config: OpenRouterConfig) {
    this.config = {
      apiKey: config.apiKey,
      primaryModel: config.primaryModel || 'tngtech/deepseek-r1t2-chimera:free',
      backupModel: config.backupModel || 'z-ai/glm-4.5-air:free',
      visionModel: config.visionModel || 'qwen/qwen-2-vl-7b-instruct:free',
      rateLimit: config.rateLimit || 1.0, // 1 request per second
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second base delay
      timeout: config.timeout || 60000 // 60 seconds
    };

    logger.info({
      primaryModel: this.config.primaryModel,
      backupModel: this.config.backupModel,
      visionModel: this.config.visionModel,
      rateLimit: this.config.rateLimit
    }, 'OpenRouterClient initialized');
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Send text completion request
   * @param request Text completion request
   * @returns Completion response
   */
  async textCompletion(request: TextCompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.config.primaryModel;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    logger.debug({ model, promptLength: request.prompt.length }, 'Text completion request');

    return this.queueRequest(() =>
      this.completionWithFallback(model, messages, {
        temperature: request.temperature,
        maxTokens: request.maxTokens
      })
    );
  }

  /**
   * Send vision completion request (with image)
   * @param request Vision completion request
   * @returns Completion response
   */
  async visionCompletion(request: VisionCompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.config.visionModel;

    const messages: Array<{ role: string; content: any }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    // Vision message with image
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: request.prompt },
        { type: 'image_url', image_url: { url: request.imageUrl } }
      ]
    });

    logger.debug({ model, imageUrl: request.imageUrl }, 'Vision completion request');

    return this.queueRequest(() =>
      this.completionWithFallback(model, messages, {
        temperature: request.temperature,
        maxTokens: request.maxTokens
      })
    );
  }

  /**
   * Batch text completions (rate-limited)
   * @param requests Array of text completion requests
   * @returns Array of completion responses
   */
  async batchTextCompletions(
    requests: TextCompletionRequest[]
  ): Promise<CompletionResponse[]> {
    logger.info({ batchSize: requests.length }, 'Starting batch text completions');

    // Process all requests through the queue (rate-limited)
    const results = await Promise.all(
      requests.map(req => this.textCompletion(req))
    );

    logger.info({ completedCount: results.length }, 'Batch text completions complete');

    return results;
  }

  /**
   * Batch vision completions (rate-limited)
   * @param requests Array of vision completion requests
   * @returns Array of completion responses
   */
  async batchVisionCompletions(
    requests: VisionCompletionRequest[]
  ): Promise<CompletionResponse[]> {
    logger.info({ batchSize: requests.length }, 'Starting batch vision completions');

    const results = await Promise.all(
      requests.map(req => this.visionCompletion(req))
    );

    logger.info({ completedCount: results.length }, 'Batch vision completions complete');

    return results;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Add request to rate-limited queue
   * @param execute Request executor function
   * @returns Promise that resolves with request result
   */
  private queueRequest<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ execute, resolve, reject });

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) break;

      try {
        // Enforce rate limit
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 1000 / this.config.rateLimit;

        if (timeSinceLastRequest < minInterval) {
          const delay = minInterval - timeSinceLastRequest;
          logger.debug({ delay }, 'Rate limit delay');
          await this.sleep(delay);
        }

        this.lastRequestTime = Date.now();

        // Execute request
        const result = await request.execute();
        request.resolve(result);

      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send completion with automatic fallback to backup model
   * @param model Model to use
   * @param messages Chat messages
   * @param options Additional options
   * @returns Completion response
   */
  private async completionWithFallback(
    model: string,
    messages: any[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<CompletionResponse> {
    try {
      // Try primary model
      return await this.sendCompletion(model, messages, options);

    } catch (error: any) {
      logger.warn({ model, error: error.message }, 'Primary model failed, trying backup');

      // Fallback to backup model
      const backupModel = this.config.backupModel;

      try {
        return await this.sendCompletion(backupModel, messages, options);
      } catch (backupError: any) {
        logger.error({
          primaryModel: model,
          backupModel,
          error: backupError.message
        }, 'Both primary and backup models failed');
        throw new Error(`All models failed: ${error.message}, ${backupError.message}`);
      }
    }
  }

  /**
   * Send completion request to OpenRouter API with retry logic
   * @param model Model to use
   * @param messages Chat messages
   * @param options Additional options
   * @returns Completion response
   */
  private async sendCompletion(
    model: string,
    messages: any[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<CompletionResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(model, messages, options);
        return response;

      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          logger.warn({
            model,
            attempt,
            maxRetries: this.config.maxRetries,
            delay,
            error: error.message
          }, 'Request failed, retrying');
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Make HTTP request to OpenRouter API
   * @param model Model to use
   * @param messages Chat messages
   * @param options Additional options
   * @returns Completion response
   */
  private async makeRequest(
    model: string,
    messages: any[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<CompletionResponse> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const payload = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000
    };

    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fantaprojekt.com', // Optional: for rankings
      'X-Title': 'FantaProjekt Video Analyzer' // Optional: for rankings
    };

    logger.debug({
      model,
      messageCount: messages.length,
      temperature: payload.temperature,
      maxTokens: payload.max_tokens
    }, 'Sending OpenRouter API request');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as any;

      // Parse response
      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error('No choices in response');
      }

      const content = choice.message?.content || '';
      const finishReason = choice.finish_reason;

      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0
      } : undefined;

      logger.debug({
        model: data.model,
        contentLength: content.length,
        finishReason,
        usage
      }, 'OpenRouter API response received');

      return {
        content,
        model: data.model || model,
        usage,
        finishReason
      };

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Sleep utility
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get queue statistics
   * @returns Queue stats
   */
  getQueueStats(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create OpenRouter client from environment
 * @returns OpenRouter client instance
 */
export function createOpenRouterClient(): OpenRouterClient {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  return new OpenRouterClient({
    apiKey,
    primaryModel: 'tngtech/deepseek-r1t2-chimera:free',
    backupModel: 'z-ai/glm-4.5-air:free',
    visionModel: 'qwen/qwen-2-vl-7b-instruct:free',
    rateLimit: 1.0, // 1 request per second for free tier
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 60000
  });
}
