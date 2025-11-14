/**
 * YouTube Downloader using yt-dlp
 *
 * Downloads YouTube videos without requiring YouTube API keys.
 * Uses yt-dlp (via yt-dlp-wrap) which parses pages directly.
 *
 * Features:
 * - No API key required
 * - No quota limits
 * - Best quality automatic selection
 * - Supports 1000+ video platforms (not just YouTube)
 * - Optional cookies support for private videos
 */

import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import pino from 'pino';
import { VideoMetadata, VideoAnalyzerError, VideoAnalyzerErrorCode } from '../types/video-analysis';

const logger = pino({ name: 'YouTubeDownloader' });

export class YouTubeDownloader {
  private ytdlp: YTDlpWrap;
  private storageDir: string;
  private cookiesFile?: string;

  constructor(storageDir: string, cookiesFile?: string) {
    this.storageDir = storageDir;
    this.cookiesFile = cookiesFile;

    // Инициализация yt-dlp
    this.ytdlp = new YTDlpWrap();

    logger.info({
      storageDir,
      hasCookies: !!cookiesFile
    }, 'YouTubeDownloader initialized');
  }

  /**
   * Download video from YouTube or other supported platforms
   * @param url Video URL (YouTube, Vimeo, etc.)
   * @param jobId Unique job ID for file naming
   * @returns Path to downloaded video file
   */
  async download(url: string, jobId: string): Promise<string> {
    logger.info({ url, jobId }, 'Starting video download');

    // Validate URL
    if (!this.validateUrl(url)) {
      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.INVALID_INPUT,
        'Invalid video URL'
      );
    }

    // Ensure storage directory exists
    await this.ensureStorageDir();

    // Output path
    const outputTemplate = path.join(
      this.storageDir,
      'uploads',
      `${jobId}.%(ext)s`
    );

    try {
      // Build yt-dlp options
      const options = this.buildDownloadOptions(outputTemplate);

      // Add URL as last argument (yt-dlp syntax: yt-dlp [OPTIONS] URL)
      options.push(url);

      logger.debug({ options, url }, 'yt-dlp options');

      // Execute download
      const result = await this.ytdlp.execPromise(options);

      logger.debug({ result }, 'yt-dlp output');

      // Find the downloaded file
      const downloadedFile = await this.findDownloadedFile(jobId);

      if (!downloadedFile) {
        throw new VideoAnalyzerError(
          VideoAnalyzerErrorCode.DOWNLOAD_FAILED,
          'Downloaded file not found'
        );
      }

      logger.info({
        url,
        jobId,
        filePath: downloadedFile
      }, 'Video downloaded successfully');

      return downloadedFile;
    } catch (error: any) {
      logger.error({ url, jobId, error: error.message }, 'Video download failed');

      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.DOWNLOAD_FAILED,
        `Failed to download video: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get video metadata without downloading
   * @param url Video URL
   * @returns Video metadata
   */
  async getMetadata(url: string): Promise<VideoMetadata> {
    logger.info({ url }, 'Fetching video metadata');

    try {
      const options = [
        url,
        '--dump-json',
        '--no-playlist',
        '--skip-download'
      ];

      if (this.cookiesFile && existsSync(this.cookiesFile)) {
        options.push('--cookies', this.cookiesFile);
      }

      const result = await this.ytdlp.execPromise(options);
      const metadata = JSON.parse(result as string);

      logger.debug({ metadata }, 'Raw metadata');

      return {
        title: metadata.title,
        duration: metadata.duration,
        width: metadata.width || 1920,
        height: metadata.height || 1080,
        fps: metadata.fps || 30,
        filesize: metadata.filesize,
        format: metadata.ext,
        codec: metadata.vcodec,
        bitrate: metadata.tbr ? metadata.tbr * 1000 : undefined
      };
    } catch (error: any) {
      logger.error({ url, error: error.message }, 'Failed to fetch metadata');

      throw new VideoAnalyzerError(
        VideoAnalyzerErrorCode.DOWNLOAD_FAILED,
        `Failed to get video metadata: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Validate if URL is supported
   * @param url Video URL
   * @returns True if valid
   */
  validateUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // List of supported domains (not exhaustive, yt-dlp supports 1000+)
      const supportedDomains = [
        'youtube.com',
        'youtu.be',
        'vimeo.com',
        'dailymotion.com',
        'twitch.tv',
        'facebook.com',
        'instagram.com',
        'tiktok.com',
        'twitter.com',
        'x.com'
      ];

      const hostname = parsedUrl.hostname.replace('www.', '');

      return supportedDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is YouTube
   * @param url Video URL
   * @returns True if YouTube
   */
  isYouTubeUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.replace('www.', '');

      return hostname.includes('youtube.com') || hostname.includes('youtu.be');
    } catch {
      return false;
    }
  }

  /**
   * Build yt-dlp download options
   * @param outputTemplate Output file template
   * @returns Array of yt-dlp CLI options
   */
  private buildDownloadOptions(outputTemplate: string): string[] {
    const options = [
      // Format: best video + best audio (MP4 preferred)
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',

      // Output template
      '-o', outputTemplate,

      // Max file size (2GB)
      '--max-filesize', '2G',

      // Don't download playlists
      '--no-playlist',

      // Continue on download errors
      '--no-abort-on-error',

      // Retry on failures (helps with bot protection)
      '--extractor-retries', '3',
      '--retries', '5',

      // Limit download speed (optional, remove if not needed)
      // '--limit-rate', '10M',

      // Verbose logging
      '--progress',
      '--no-warnings'
    ];

    // Add cookies file if provided
    if (this.cookiesFile && existsSync(this.cookiesFile)) {
      options.push('--cookies', this.cookiesFile);
      logger.debug({ cookiesFile: this.cookiesFile }, 'Using cookies file');
    }

    return options;
  }

  /**
   * Find downloaded file by job ID
   * @param jobId Job ID
   * @returns Path to downloaded file or null
   */
  private async findDownloadedFile(jobId: string): Promise<string | null> {
    const uploadsDir = path.join(this.storageDir, 'uploads');

    try {
      const files = await fs.readdir(uploadsDir);

      const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv'];

      const matchingFile = files.find(file =>
        file.startsWith(jobId) && videoExtensions.some(ext => file.endsWith(ext))
      );

      if (matchingFile) {
        return path.join(uploadsDir, matchingFile);
      }

      return null;
    } catch (error) {
      logger.error({ jobId, error }, 'Error finding downloaded file');
      return null;
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    const uploadsDir = path.join(this.storageDir, 'uploads');

    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      logger.error({ uploadsDir, error }, 'Failed to create storage directory');
      throw error;
    }
  }

  /**
   * Cleanup downloaded file
   * @param filePath Path to file
   */
  async cleanup(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
        logger.info({ filePath }, 'Cleaned up downloaded file');
      }
    } catch (error) {
      logger.warn({ filePath, error }, 'Failed to cleanup file');
    }
  }
}

/**
 * Helper function to create YouTubeDownloader instance from env
 */
export function createYouTubeDownloader(): YouTubeDownloader {
  const storageDir = process.env.VIDEO_ANALYZER_STORAGE || './static/video-analyzer';
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE;

  return new YouTubeDownloader(storageDir, cookiesFile);
}
