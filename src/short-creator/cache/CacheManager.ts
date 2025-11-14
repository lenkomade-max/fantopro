/**
 * Cache Manager
 * 
 * Simple file-based caching system for Pexels videos and TTS audio
 */

import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import { logger } from "../../logger";
import { Config } from "../../config";

export class CacheManager {
  private cacheDir: string;

  constructor(private config: Config) {
    this.cacheDir = config.cacheDirPath;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirpSync(this.cacheDir);
      logger.debug({ cacheDir: this.cacheDir }, "Created cache directory");
    }
  }

  /**
   * Generate cache key from data
   */
  private getCacheKey(namespace: string, data: any): string {
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(data));
    return `${namespace}_${hash.digest("hex")}`;
  }

  /**
   * Check if cache entry exists
   */
  async has(namespace: string, key: any): Promise<boolean> {
    const cacheKey = this.getCacheKey(namespace, key);
    const cachePath = path.join(this.cacheDir, cacheKey);
    return fs.existsSync(cachePath);
  }

  /**
   * Get cached data
   */
  async get<T>(namespace: string, key: any): Promise<T | null> {
    const cacheKey = this.getCacheKey(namespace, key);
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      if (await this.has(namespace, key)) {
        const data = await fs.readJSON(cachePath);
        logger.debug({ namespace, cacheKey }, "Cache hit");
        return data;
      }
    } catch (error) {
      logger.warn({ namespace, cacheKey, error }, "Failed to read cache");
    }

    logger.debug({ namespace, cacheKey }, "Cache miss");
    return null;
  }

  /**
   * Set cache data
   */
  async set(namespace: string, key: any, value: any): Promise<void> {
    const cacheKey = this.getCacheKey(namespace, key);
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      await fs.writeJSON(cachePath, value);
      logger.debug({ namespace, cacheKey }, "Cached data");
    } catch (error) {
      logger.warn({ namespace, cacheKey, error }, "Failed to write cache");
    }
  }

  /**
   * Get cached file path
   */
  async getFile(namespace: string, key: any): Promise<string | null> {
    const cacheKey = this.getCacheKey(namespace, key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.file`);

    if (fs.existsSync(cachePath)) {
      logger.debug({ namespace, cacheKey }, "File cache hit");
      return cachePath;
    }

    logger.debug({ namespace, cacheKey }, "File cache miss");
    return null;
  }

  /**
   * Cache a file
   */
  async setFile(namespace: string, key: any, sourcePath: string): Promise<string> {
    const cacheKey = this.getCacheKey(namespace, key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.file`);

    try {
      await fs.copy(sourcePath, cachePath);
      logger.debug({ namespace, cacheKey, cachePath }, "Cached file");
      return cachePath;
    } catch (error) {
      logger.warn({ namespace, cacheKey, error }, "Failed to cache file");
      throw error;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await fs.emptyDir(this.cacheDir);
      logger.info("Cleared all cache");
    } catch (error) {
      logger.error({ error }, "Failed to clear cache");
    }
  }

  /**
   * Get cache size in bytes
   */
  async getSize(): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    } catch (error) {
      logger.warn({ error }, "Failed to calculate cache size");
    }

    return totalSize;
  }
}

