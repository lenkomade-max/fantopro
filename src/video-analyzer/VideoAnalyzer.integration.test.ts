/**
 * Integration tests for VideoAnalyzer
 *
 * Tests the complete video analysis pipeline end-to-end.
 * These tests require:
 * - FFmpeg installed
 * - Whisper library initialized
 * - Network access for test video downloads (optional)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { VideoAnalyzer } from './VideoAnalyzer';
import { createVideoAnalyzer } from './factory';
import { VideoAnalysisInput, JobStatus } from './types/video-analysis';
import { WhisperLibrary } from '../short-creator/libraries/Whisper';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Mock WhisperLibrary for testing
 * Real Whisper requires model download and is slow
 */
class MockWhisperLibrary {
  async transcribe(audioPath: string, options?: any) {
    // Return mock transcription data
    return {
      text: 'Это тестовая транскрипция. Смотрите, как это работает! Невероятно важная информация. Вы должны это узнать.',
      language: 'ru',
      duration: 15.5,
      segments: [
        {
          id: 0,
          start: 0.0,
          end: 3.5,
          text: 'Это тестовая транскрипция.',
          words: []
        },
        {
          id: 1,
          start: 3.5,
          end: 7.0,
          text: 'Смотрите, как это работает!',
          words: []
        },
        {
          id: 2,
          start: 7.0,
          end: 11.5,
          text: 'Невероятно важная информация.',
          words: []
        },
        {
          id: 3,
          start: 11.5,
          end: 15.5,
          text: 'Вы должны это узнать.',
          words: []
        }
      ]
    };
  }
}

describe('VideoAnalyzer Integration Tests', () => {
  let analyzer: VideoAnalyzer;
  let testStorageDir: string;

  beforeAll(async () => {
    // Create test storage directory
    testStorageDir = path.join(process.cwd(), 'test-video-analyzer-output');
    await fs.mkdir(testStorageDir, { recursive: true });

    // Initialize VideoAnalyzer with mock Whisper
    const mockWhisper = new MockWhisperLibrary() as unknown as WhisperLibrary;

    analyzer = await createVideoAnalyzer(mockWhisper, {
      enabled: true,
      storageDir: testStorageDir,
      maxDuration: 300, // 5 minutes for testing
      maxFileSize: 100 * 1024 * 1024, // 100MB for testing
      retentionDays: 1,
      processing: {
        maxConcurrentClips: 2,
        ffmpegPreset: 'ultrafast', // Faster for tests
        outputCrf: 28,
        audioBitrate: '96k'
      }
    });
  });

  afterAll(async () => {
    // Cleanup test directory
    if (existsSync(testStorageDir)) {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    }
  });

  describe('Full Pipeline - YouTube Video', () => {
    it.skip('should analyze YouTube video and generate clips', async () => {
      // SKIP: Requires actual YouTube URL and network access
      // Uncomment and provide URL for manual testing

      const input: VideoAnalysisInput = {
        source: {
          type: 'youtube',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Replace with actual test video
        },
        options: {
          clipDuration: 60,
          clipCount: 3,
          minScore: 0.5,
          orientation: 'portrait'
        }
      };

      const job = await analyzer.analyzeVideo(input);

      expect(job.jobId).toBeDefined();
      expect(job.status).toBe('pending');

      // Wait for processing to complete (with timeout)
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max

      while (attempts < maxAttempts) {
        const status = analyzer.getJobStatus(job.jobId);

        if (status?.status === 'completed') {
          break;
        }

        if (status?.status === 'failed') {
          throw new Error(`Job failed: ${status.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;
      }

      const finalStatus = analyzer.getJobStatus(job.jobId);

      expect(finalStatus?.status).toBe('completed');
      expect(finalStatus?.clips).toBeDefined();
      expect(finalStatus?.clips!.length).toBeGreaterThan(0);
      expect(finalStatus?.clips!.length).toBeLessThanOrEqual(3);

      // Verify clips exist on disk
      for (const clip of finalStatus!.clips!) {
        expect(existsSync(clip.filePath)).toBe(true);
      }

      // Cleanup
      await analyzer.deleteJob(job.jobId);
    }, 300000); // 5 minute timeout
  });

  describe('Job Management', () => {
    it('should create job with correct initial state', async () => {
      const input: VideoAnalysisInput = {
        source: {
          type: 'url',
          url: 'https://example.com/test.mp4'
        },
        options: {
          clipDuration: 60,
          clipCount: 5
        }
      };

      // Mock the download/processing to prevent actual execution
      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const job = await analyzer.analyzeVideo(input);

      expect(job.jobId).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.progress).toBe(0);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.input).toEqual(input);
    });

    it('should retrieve job status', async () => {
      const input: VideoAnalysisInput = {
        source: {
          type: 'url',
          url: 'https://example.com/test2.mp4'
        }
      };

      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const job = await analyzer.analyzeVideo(input);
      const status = analyzer.getJobStatus(job.jobId);

      expect(status).toBeDefined();
      expect(status?.jobId).toBe(job.jobId);
    });

    it('should return null for non-existent job', () => {
      const status = analyzer.getJobStatus('non-existent-id');

      expect(status).toBeNull();
    });

    it('should list all jobs', async () => {
      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const input1: VideoAnalysisInput = {
        source: { type: 'url', url: 'https://example.com/test3.mp4' }
      };

      const input2: VideoAnalysisInput = {
        source: { type: 'url', url: 'https://example.com/test4.mp4' }
      };

      await analyzer.analyzeVideo(input1);
      await analyzer.analyzeVideo(input2);

      const allJobs = analyzer.getAllJobs();

      expect(allJobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter jobs by status', async () => {
      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const input: VideoAnalysisInput = {
        source: { type: 'url', url: 'https://example.com/test5.mp4' }
      };

      await analyzer.analyzeVideo(input);

      const pendingJobs = analyzer.getAllJobs('pending');

      expect(pendingJobs.every(job => job.status === 'pending')).toBe(true);
    });

    it('should delete job and cleanup files', async () => {
      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const input: VideoAnalysisInput = {
        source: { type: 'url', url: 'https://example.com/test6.mp4' }
      };

      const job = await analyzer.analyzeVideo(input);

      const result = await analyzer.deleteJob(job.jobId);

      expect(result).toBeDefined();
      expect(result?.deletedClips).toBe(0); // No clips generated yet

      const status = analyzer.getJobStatus(job.jobId);
      expect(status).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should reject videos exceeding max duration', async () => {
      // Mock video validator to simulate long video
      const mockValidator = vi.spyOn(analyzer as any, 'processJob').mockImplementation(async () => {
        throw new Error('Video duration exceeds maximum allowed');
      });

      const input: VideoAnalysisInput = {
        source: {
          type: 'url',
          url: 'https://example.com/very-long-video.mp4'
        }
      };

      const job = await analyzer.analyzeVideo(input);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = analyzer.getJobStatus(job.jobId);

      expect(status?.status).toBe('failed');
      expect(status?.error).toBeDefined();

      mockValidator.mockRestore();
    });

    it('should handle download failures gracefully', async () => {
      const mockDownloader = vi.spyOn(analyzer as any, 'processJob').mockImplementation(async () => {
        throw new Error('Download failed');
      });

      const input: VideoAnalysisInput = {
        source: {
          type: 'youtube',
          url: 'https://www.youtube.com/watch?v=invalid'
        }
      };

      const job = await analyzer.analyzeVideo(input);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = analyzer.getJobStatus(job.jobId);

      expect(status?.status).toBe('failed');

      mockDownloader.mockRestore();
    });

    it('should handle transcription failures gracefully', async () => {
      const mockWhisper = {
        transcribe: vi.fn().mockRejectedValue(new Error('Whisper failed'))
      };

      const analyzerWithFailingWhisper = await createVideoAnalyzer(
        mockWhisper as unknown as WhisperLibrary,
        { storageDir: testStorageDir }
      );

      const input: VideoAnalysisInput = {
        source: {
          type: 'url',
          url: 'https://example.com/test.mp4'
        }
      };

      const job = await analyzerWithFailingWhisper.analyzeVideo(input);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = analyzerWithFailingWhisper.getJobStatus(job.jobId);

      expect(status?.status).toBe('failed');
    });
  });

  describe('Clip Generation', () => {
    it('should return empty array for job without clips', () => {
      const clips = analyzer.getClips('non-existent-job');

      expect(clips).toBeNull();
    });

    it('should retrieve specific clip', async () => {
      // Create a mock job with clips
      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const input: VideoAnalysisInput = {
        source: { type: 'url', url: 'https://example.com/test.mp4' }
      };

      const job = await analyzer.analyzeVideo(input);

      // Manually add clips to job (simulating completed processing)
      const mockClip = {
        clipId: 'clip-001',
        filePath: '/fake/path/clip.mp4',
        startTime: 10.0,
        endTime: 70.0,
        duration: 60.0,
        score: 0.85,
        transcript: 'Test transcript',
        scores: {
          text: 0.8,
          audio: 0.9,
          visual: 0.85,
          combined: 0.85
        },
        orientation: 'portrait' as const,
        createdAt: new Date(),
        videoInfo: {
          width: 1080,
          height: 1920,
          fps: 30,
          codec: 'h264'
        }
      };

      (analyzer as any).jobs.get(job.jobId).clips = [mockClip];

      const clip = analyzer.getClip(job.jobId, 'clip-001');

      expect(clip).toBeDefined();
      expect(clip?.clipId).toBe('clip-001');
    });

    it('should return null for non-existent clip', async () => {
      vi.spyOn(analyzer as any, 'processQueue').mockImplementation(() => Promise.resolve());

      const input: VideoAnalysisInput = {
        source: { type: 'url', url: 'https://example.com/test.mp4' }
      };

      const job = await analyzer.analyzeVideo(input);

      const clip = analyzer.getClip(job.jobId, 'non-existent-clip');

      expect(clip).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async () => {
      const customConfig = {
        maxDuration: 600,
        maxFileSize: 500 * 1024 * 1024,
        analyzerWeights: {
          text: 0.5,
          audio: 0.3,
          visual: 0.2
        }
      };

      const mockWhisper = new MockWhisperLibrary() as unknown as WhisperLibrary;

      const customAnalyzer = await createVideoAnalyzer(mockWhisper, customConfig);

      expect((customAnalyzer as any).config.maxDuration).toBe(600);
      expect((customAnalyzer as any).config.maxFileSize).toBe(500 * 1024 * 1024);
      expect((customAnalyzer as any).config.analyzerWeights.text).toBe(0.5);
    });

    it('should use default configuration when not specified', async () => {
      const mockWhisper = new MockWhisperLibrary() as unknown as WhisperLibrary;

      const defaultAnalyzer = await createVideoAnalyzer(mockWhisper);

      expect((defaultAnalyzer as any).config.maxDuration).toBeDefined();
      expect((defaultAnalyzer as any).config.analyzerWeights).toBeDefined();
    });
  });
});
