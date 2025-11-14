/**
 * Unit tests for TextAnalyzer
 *
 * Tests the text analysis scoring system for transcript segments.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextAnalyzer } from './TextAnalyzer';
import { TranscriptSegment } from '../types/video-analysis';

describe('TextAnalyzer', () => {
  let analyzer: TextAnalyzer;

  beforeEach(() => {
    analyzer = new TextAnalyzer();
  });

  describe('analyze()', () => {
    it('should return high score for emotional text with keywords', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Смотрите! Это невероятно важно! Вы должны это узнать!',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // Should score high due to:
      // - Emotional words (невероятно)
      // - Keywords (Смотрите, важно, узнать)
      // - Exclamation marks
      expect(score).toBeGreaterThan(0.6);
    });

    it('should return low score for plain informational text', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'В этом видео я расскажу о настройках программы.',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // Should score low - no emotional content or keywords
      expect(score).toBeLessThan(0.4);
    });

    it('should return higher score for text with questions', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Знаете ли вы, что происходит дальше? Это очень важно!',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // Should score higher due to question + emotional content
      expect(score).toBeGreaterThan(0.5);
    });

    it('should handle empty text gracefully', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 1,
        text: '',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // Should return minimal score for empty text
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(0.2);
    });

    it('should detect action words correctly', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Слушайте внимательно! Смотрите на экран! Запомните это!',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // High score due to action words (Слушайте, Смотрите, Запомните)
      expect(score).toBeGreaterThan(0.6);
    });

    it('should score English content', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Look at this amazing discovery! You must see this!',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // Should work with English keywords (Look, amazing, must, see)
      expect(score).toBeGreaterThan(0.5);
    });

    it('should normalize scores between 0 and 1', async () => {
      const segments: TranscriptSegment[] = [
        { id: 0, start: 0, end: 5, text: 'Невероятно! Обязательно смотрите! Это шок!', words: [] },
        { id: 1, start: 5, end: 10, text: 'Простой текст без эмоций.', words: [] },
        { id: 2, start: 10, end: 15, text: '', words: [] }
      ];

      for (const segment of segments) {
        const score = await analyzer.analyze(segment);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getMetrics()', () => {
    it('should calculate emotional intensity from punctuation', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Это невероятно!!! Просто шок!!!',
        words: []
      };

      const metrics = await (analyzer as any).getMetrics(segment);

      expect(metrics.emotionalIntensity).toBeGreaterThan(0);
    });

    it('should calculate keyword density', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Смотрите, это важно, вы должны это узнать',
        words: []
      };

      const metrics = await (analyzer as any).getMetrics(segment);

      // Contains keywords: смотрите, важно, узнать
      expect(metrics.keywordDensity).toBeGreaterThan(0);
    });

    it('should calculate information density from word count', async () => {
      const longSegment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 10,
        text: 'Это длинный текст с большим количеством слов которые содержат много информации о различных вещах',
        words: []
      };

      const shortSegment: TranscriptSegment = {
        id: 1,
        start: 0,
        end: 10,
        text: 'Короткий текст',
        words: []
      };

      const longMetrics = await (analyzer as any).getMetrics(longSegment);
      const shortMetrics = await (analyzer as any).getMetrics(shortSegment);

      // Longer segment should have higher information density per second
      expect(longMetrics.informationDensity).toBeGreaterThan(shortMetrics.informationDensity);
    });

    it('should detect questions', async () => {
      const questionSegment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Что это? Почему так происходит?',
        words: []
      };

      const statementSegment: TranscriptSegment = {
        id: 1,
        start: 0,
        end: 5,
        text: 'Это простое утверждение.',
        words: []
      };

      const questionMetrics = await (analyzer as any).getMetrics(questionSegment);
      const statementMetrics = await (analyzer as any).getMetrics(statementSegment);

      expect(questionMetrics.questionScore).toBeGreaterThan(statementMetrics.questionScore);
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', async () => {
      const veryLongText = 'слово '.repeat(1000); // 1000 words
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 100,
        text: veryLongText,
        words: []
      };

      const score = await analyzer.analyze(segment);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle special characters', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: '!@#$%^&*()_+-=[]{}|;:",.<>?/~`',
        words: []
      };

      const score = await analyzer.analyze(segment);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle mixed language text', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Look at this невероятное discovery! Это amazing!',
        words: []
      };

      const score = await analyzer.analyze(segment);

      // Should detect keywords in both languages
      expect(score).toBeGreaterThan(0.4);
    });
  });
});
