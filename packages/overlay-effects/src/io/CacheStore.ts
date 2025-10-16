import fs from 'fs-extra';
import path from 'path';
import { hashFile, generateAssetId } from '../utils/hash';
import { getCachePath, getStaticPath, fileExists } from '../utils/paths';

export interface CacheEntry {
  id: string;
  sourcePath: string;
  cachedPath: string;
  staticPath: string;
  hash: string;
  kind: 'image' | 'video';
}

export class CacheStore {
  private cache: Map<string, CacheEntry> = new Map();

  async has(id: string): Promise<boolean> {
    if (this.cache.has(id)) {
      const entry = this.cache.get(id)!;
      return await fileExists(entry.cachedPath);
    }
    return false;
  }

  async store(
    sourcePath: string,
    kind: 'image' | 'video',
    sourceId: string
  ): Promise<CacheEntry> {
    const hash = await hashFile(sourcePath);
    const extension = path.extname(sourcePath).substring(1) || (kind === 'video' ? 'mp4' : 'jpg');
    const cachedPath = getCachePath(hash, extension);
    const staticPath = getStaticPath(hash, extension);
    const id = generateAssetId(sourceId, kind);

    if (!await fileExists(cachedPath)) {
      await fs.copy(sourcePath, cachedPath);
    }

    const entry: CacheEntry = { id, sourcePath, cachedPath, staticPath, hash, kind };
    this.cache.set(id, entry);
    return entry;
  }

  get(id: string): CacheEntry | undefined {
    return this.cache.get(id);
  }
}



