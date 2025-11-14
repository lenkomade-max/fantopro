/**
 * Text Analyzer
 *
 * Analyzes transcript text to determine interesting moments based on:
 * - Emotional intensity (exclamations, questions)
 * - Keyword density (attention-grabbing words)
 * - Information density (unique words ratio)
 * - Action words (verbs that indicate activity)
 *
 * Weight in combined score: 40%
 */

import pino from 'pino';
import {
  TranscriptSegment,
  TextAnalysisMetrics,
  ITextAnalyzer
} from '../types/video-analysis';

const logger = pino({ name: 'TextAnalyzer' });

export class TextAnalyzer implements ITextAnalyzer {
  private keywords: string[];
  private actionVerbs: string[];

  constructor(customKeywords?: string[]) {
    // Default attention-grabbing keywords (Russian)
    this.keywords = customKeywords || [
      'смотри', 'смотрите', 'внимание', 'важно', 'обязательно',
      'невероятно', 'удивительно', 'шок', 'секрет', 'узнай',
      'узнайте', 'представьте', 'вау', 'офигеть', 'круто',
      'супер', 'топ', 'лучший', 'первый', 'новый'
    ];

    // Action verbs indicating dynamic content
    this.actionVerbs = [
      'делай', 'делайте', 'пойдем', 'пошли', 'начни',
      'начинай', 'попробуй', 'попробуйте', 'используй',
      'используйте', 'создай', 'создайте', 'получи', 'получите'
    ];

    logger.info({
      keywordsCount: this.keywords.length,
      actionVerbsCount: this.actionVerbs.length
    }, 'TextAnalyzer initialized');
  }

  /**
   * Analyze text segment and return interest score (0-1)
   * @param segment Transcript segment
   * @returns Interest score (0-1)
   */
  async analyze(segment: TranscriptSegment): Promise<number> {
    const metrics = await this.getMetrics(segment);

    // Combine metrics with weights
    const score = (
      metrics.emotionalIntensity * 0.25 +
      metrics.keywordDensity * 0.35 +
      metrics.informationDensity * 0.20 +
      metrics.questionScore * 0.10 +
      metrics.actionWords * 0.10
    );

    logger.debug({
      segmentId: segment.id,
      score,
      metrics
    }, 'Text analysis complete');

    return Math.min(score, 1.0);
  }

  /**
   * Get detailed text analysis metrics
   * @param segment Transcript segment
   * @returns Text analysis metrics
   */
  async getMetrics(segment: TranscriptSegment): Promise<TextAnalysisMetrics> {
    const text = segment.text.toLowerCase().trim();

    if (!text || text.length === 0) {
      return {
        emotionalIntensity: 0,
        keywordDensity: 0,
        informationDensity: 0,
        questionScore: 0,
        actionWords: 0
      };
    }

    return {
      emotionalIntensity: this.calculateEmotionalIntensity(text),
      keywordDensity: this.calculateKeywordDensity(text),
      informationDensity: this.calculateInformationDensity(text),
      questionScore: this.calculateQuestionScore(text),
      actionWords: this.calculateActionWords(text)
    };
  }

  /**
   * Calculate emotional intensity based on punctuation and emotional words
   * @param text Text to analyze
   * @returns Score 0-1
   */
  private calculateEmotionalIntensity(text: string): number {
    // Count exclamations and questions
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;

    // Emotional words (additional to keywords)
    const emotionalWords = [
      'ого', 'ух', 'ах', 'эх', 'ой', 'боже', 'класс',
      'блин', 'черт', 'капец', 'жесть', 'мощно'
    ];

    const emotionalWordCount = emotionalWords.filter(word =>
      text.includes(word)
    ).length;

    // Words in ALL CAPS (indicating shouting)
    const words = text.split(/\s+/);
    const capsWords = words.filter(word =>
      word.length > 2 && word === word.toUpperCase()
    ).length;

    // Combine signals
    const punctuationScore = Math.min((exclamations + questions) / 3, 1.0);
    const emotionalWordsScore = Math.min(emotionalWordCount / 2, 1.0);
    const capsScore = Math.min(capsWords / 3, 1.0);

    return (punctuationScore * 0.5 + emotionalWordsScore * 0.3 + capsScore * 0.2);
  }

  /**
   * Calculate keyword density
   * @param text Text to analyze
   * @returns Score 0-1
   */
  private calculateKeywordDensity(text: string): number {
    const keywordCount = this.keywords.filter(keyword =>
      text.includes(keyword)
    ).length;

    // Normalize by total keywords
    return Math.min(keywordCount / 3, 1.0);
  }

  /**
   * Calculate information density (unique words ratio)
   * @param text Text to analyze
   * @returns Score 0-1
   */
  private calculateInformationDensity(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      return 0;
    }

    // Remove stop words (common words with low information value)
    const stopWords = new Set([
      'и', 'в', 'на', 'с', 'по', 'для', 'к', 'от', 'из', 'о',
      'у', 'за', 'так', 'это', 'как', 'что', 'все', 'еще', 'уже',
      'вот', 'же', 'бы', 'а', 'но', 'да', 'нет', 'он', 'она', 'оно',
      'они', 'мы', 'вы', 'я', 'ты', 'этот', 'эта', 'эти', 'тот',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are'
    ]);

    const meaningfulWords = words.filter(word =>
      word.length > 2 && !stopWords.has(word)
    );

    if (meaningfulWords.length === 0) {
      return 0;
    }

    const uniqueWords = new Set(meaningfulWords).size;

    // Higher ratio = more information density
    const density = uniqueWords / meaningfulWords.length;

    // Normalize (typical density is 0.6-0.9)
    return Math.min(density / 0.7, 1.0);
  }

  /**
   * Calculate question score (questions are engaging)
   * @param text Text to analyze
   * @returns Score 0-1
   */
  private calculateQuestionScore(text: string): number {
    const questions = (text.match(/\?/g) || []).length;

    // Question words
    const questionWords = [
      'как', 'что', 'где', 'когда', 'почему', 'зачем',
      'кто', 'куда', 'откуда', 'сколько', 'какой', 'чей'
    ];

    const questionWordCount = questionWords.filter(word =>
      text.includes(word)
    ).length;

    // Normalize
    return Math.min((questions + questionWordCount / 2) / 2, 1.0);
  }

  /**
   * Calculate action words score (verbs indicating activity)
   * @param text Text to analyze
   * @returns Score 0-1
   */
  private calculateActionWords(text: string): number {
    const actionWordCount = this.actionVerbs.filter(verb =>
      text.includes(verb)
    ).length;

    // Normalize
    return Math.min(actionWordCount / 2, 1.0);
  }

  /**
   * Set custom keywords
   * @param keywords Array of keywords
   */
  setKeywords(keywords: string[]): void {
    this.keywords = keywords.map(k => k.toLowerCase());
    logger.info({ count: keywords.length }, 'Keywords updated');
  }

  /**
   * Get current keywords
   * @returns Array of keywords
   */
  getKeywords(): string[] {
    return [...this.keywords];
  }

  /**
   * Add keywords to existing list
   * @param keywords Keywords to add
   */
  addKeywords(keywords: string[]): void {
    const newKeywords = keywords.map(k => k.toLowerCase());
    this.keywords = [...new Set([...this.keywords, ...newKeywords])];
    logger.info({ added: keywords.length, total: this.keywords.length }, 'Keywords added');
  }

  /**
   * Set custom action verbs
   * @param verbs Array of action verbs
   */
  setActionVerbs(verbs: string[]): void {
    this.actionVerbs = verbs.map(v => v.toLowerCase());
    logger.info({ count: verbs.length }, 'Action verbs updated');
  }

  /**
   * Get current action verbs
   * @returns Array of action verbs
   */
  getActionVerbs(): string[] {
    return [...this.actionVerbs];
  }
}

/**
 * Factory function to create TextAnalyzer
 */
export function createTextAnalyzer(customKeywords?: string[]): TextAnalyzer {
  return new TextAnalyzer(customKeywords);
}
