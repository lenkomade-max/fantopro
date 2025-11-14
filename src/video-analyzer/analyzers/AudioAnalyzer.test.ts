/**
 * Unit tests for AudioAnalyzer
 *
 * Tests the audio analysis scoring system using FFmpeg.
 * These are integration tests that require FFmpeg to be installed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioAnalyzer } from './AudioAnalyzer';
import { TranscriptSegment } from '../types/video-analysis';
import path from 'path';
import { existsSync } from 'fs';

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  describe('analyze()', () => {
    it('should return score between 0 and 1', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Test segment',
        words: []
      };

      // Mock FFmpeg calls for this test
      const mockVolumeStats = {
        meanVolume: -20,
        maxVolume: -10,
        histogram: {}
      };

      const mockSilenceDuration = 0.5;

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(mockVolumeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(mockSilenceDuration);

      const score = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return higher score for loud segments', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Loud segment',
        words: []
      };

      // Mock loud audio
      const loudVolumeStats = {
        meanVolume: -10, // Very loud
        maxVolume: -5,
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(loudVolumeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(0.1);

      const loudScore = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Mock quiet audio
      const quietVolumeStats = {
        meanVolume: -40, // Very quiet
        maxVolume: -30,
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(quietVolumeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(0.1);

      const quietScore = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Louder segments should score higher
      expect(loudScore).toBeGreaterThan(quietScore);
    });

    it('should return lower score for segments with silence', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 10,
        text: 'Segment with silence',
        words: []
      };

      const volumeStats = {
        meanVolume: -20,
        maxVolume: -10,
        histogram: {}
      };

      // Mock segment with lots of silence
      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(volumeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(5.0); // 5 seconds of silence

      const silentScore = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Mock segment with no silence
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(0.1);

      const activeScore = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Segments with less silence should score higher
      expect(activeScore).toBeGreaterThan(silentScore);
    });

    it('should return 0 for missing audio path', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Test segment',
        words: []
      };

      const score = await analyzer.analyze(segment, {});

      expect(score).toBe(0);
    });

    it('should handle FFmpeg errors gracefully', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Test segment',
        words: []
      };

      // Mock FFmpeg error
      vi.spyOn(analyzer as any, 'extractVolumeStats').mockRejectedValue(new Error('FFmpeg failed'));

      const score = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Should return low score on error
      expect(score).toBeLessThan(0.3);
    });
  });

  describe('extractVolumeStats()', () => {
    it('should parse volumedetect output correctly', async () => {
      const mockOutput = `
        [Parsed_volumedetect_0 @ 0x123] n_samples: 220500
        [Parsed_volumedetect_0 @ 0x123] mean_volume: -20.5 dB
        [Parsed_volumedetect_0 @ 0x123] max_volume: -10.2 dB
        [Parsed_volumedetect_0 @ 0x123] histogram_10db: 1234
      `;

      // We'll test the parsing logic directly
      const stats = (analyzer as any).parseVolumeDetect(mockOutput);

      expect(stats.meanVolume).toBe(-20.5);
      expect(stats.maxVolume).toBe(-10.2);
      expect(stats.histogram['10db']).toBe(1234);
    });

    it('should handle invalid volumedetect output', () => {
      const invalidOutput = 'Invalid FFmpeg output';

      const stats = (analyzer as any).parseVolumeDetect(invalidOutput);

      // Should return default values
      expect(stats.meanVolume).toBe(-100);
      expect(stats.maxVolume).toBe(-100);
      expect(Object.keys(stats.histogram).length).toBe(0);
    });
  });

  describe('detectSilence()', () => {
    it('should parse silencedetect output correctly', () => {
      const mockOutput = `
        [silencedetect @ 0x123] silence_start: 1.5
        [silencedetect @ 0x123] silence_end: 3.2 | silence_duration: 1.7
        [silencedetect @ 0x123] silence_start: 5.0
        [silencedetect @ 0x123] silence_end: 6.5 | silence_duration: 1.5
      `;

      const totalSilence = (analyzer as any).parseSilenceDetect(mockOutput);

      // Should sum up all silence durations
      expect(totalSilence).toBeCloseTo(1.7 + 1.5, 1);
    });

    it('should handle no silence in output', () => {
      const noSilenceOutput = 'No silence detected';

      const totalSilence = (analyzer as any).parseSilenceDetect(noSilenceOutput);

      expect(totalSilence).toBe(0);
    });
  });

  describe('scoring calculation', () => {
    it('should weight volume spike score correctly', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Test',
        words: []
      };

      // High volume spike (large difference between max and mean)
      const highSpikeStats = {
        meanVolume: -30,
        maxVolume: -10, // 20 dB spike
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(highSpikeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(0);

      const highSpikeScore = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Low volume spike
      const lowSpikeStats = {
        meanVolume: -30,
        maxVolume: -25, // 5 dB spike
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(lowSpikeStats);

      const lowSpikeScore = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Higher spike should result in higher score
      expect(highSpikeScore).toBeGreaterThan(lowSpikeScore);
    });

    it('should normalize scores to 0-1 range', async () => {
      const segment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 5,
        text: 'Test',
        words: []
      };

      // Extreme values
      const extremeStats = {
        meanVolume: 0, // Impossible loud
        maxVolume: 10,
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(extremeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(0);

      const score = await analyzer.analyze(segment, { audioPath: '/fake/path.mp3' });

      // Even with extreme values, score should be normalized
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very short segments', async () => {
      const shortSegment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 0.5, // 500ms
        text: 'Short',
        words: []
      };

      const volumeStats = {
        meanVolume: -20,
        maxVolume: -10,
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(volumeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(0);

      const score = await analyzer.analyze(shortSegment, { audioPath: '/fake/path.mp3' });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle segments longer than 60 seconds', async () => {
      const longSegment: TranscriptSegment = {
        id: 0,
        start: 0,
        end: 120, // 2 minutes
        text: 'Long segment',
        words: []
      };

      const volumeStats = {
        meanVolume: -20,
        maxVolume: -10,
        histogram: {}
      };

      vi.spyOn(analyzer as any, 'extractVolumeStats').mockResolvedValue(volumeStats);
      vi.spyOn(analyzer as any, 'detectSilence').mockResolvedValue(10);

      const score = await analyzer.analyze(longSegment, { audioPath: '/fake/path.mp3' });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
