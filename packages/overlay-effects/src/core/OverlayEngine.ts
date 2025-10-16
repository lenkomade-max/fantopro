import { SceneInput, PrepareResult, PreparedAsset, OverlayEngine as IOverlayEngine } from '../types';
import { OverlayTrack } from './OverlayTrack';
import { OverlayEffect } from './OverlayEffect';
import { AssetFetcher } from '../io/AssetFetcher';
import { CacheStore } from '../io/CacheStore';
import { ensureCacheDirectories } from '../utils/paths';
import { generateAssetId } from '../utils/hash';

export class OverlayEngine implements IOverlayEngine {
  private fetcher: AssetFetcher;
  private cache: CacheStore;

  constructor() {
    this.fetcher = new AssetFetcher();
    this.cache = new CacheStore();
  }

  async prepare(scene: SceneInput): Promise<PrepareResult> {
    await ensureCacheDirectories();
    const track = OverlayTrack.fromScene(scene);
    const preparedAssets: PreparedAsset[] = [];
    const processPromises: Promise<PreparedAsset | null>[] = [];
    for (const effect of track.getAllEffects()) {
      processPromises.push(this.processEffect(effect, scene));
    }
    const results = await Promise.allSettled(processPromises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        preparedAssets.push(result.value);
      }
    }
    // Update track with prepared assets
    for (const asset of preparedAssets) {
      const effect = track.getEffectById(asset.id);
      if (effect) {
        track.updateEffect(asset.id, effect.withPreparedAsset(asset));
      }
    }
    return { assets: preparedAssets };
  }

  private async processEffect(effect: OverlayEffect, scene: SceneInput): Promise<PreparedAsset | null> {
    try {
      const { source } = effect;
      const assetId = generateAssetId(source.src, source.kind as any);
      if (await this.cache.has(assetId)) {
        const cached = this.cache.get(assetId)!;
        return { id: effect.id, kind: source.kind as any, staticPath: cached.staticPath };
      }
      const fetchResult = await this.fetcher.fetch(source.src);
      if (!this.fetcher.validateAsset(fetchResult.mimeType, source.kind as any)) {
        throw new Error(`Invalid asset type: expected ${source.kind}, got ${fetchResult.mimeType}`);
      }
      let finalPath = fetchResult.localPath;
      const cacheEntry = await this.cache.store(finalPath, source.kind as any, source.src);
      return { id: effect.id, kind: source.kind as any, staticPath: cacheEntry.staticPath };
    } catch (error) {
      console.error(`Failed to process effect ${effect.id}:`, error);
      return null;
    }
  }
}

export const overlayEngine = new OverlayEngine();


