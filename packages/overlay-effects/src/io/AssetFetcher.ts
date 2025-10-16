import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { pipeline } from 'stream/promises';

export interface FetchResult {
  localPath: string;
  mimeType: string;
  size: number;
}

export class AssetFetcher {
  private readonly maxSizeBytes = 500 * 1024 * 1024; // 500MB
  private readonly tempDir = path.join(process.cwd(), '.overlay-cache', 'temp');

  constructor() {
    fs.ensureDirSync(this.tempDir);
  }

  async fetch(source: string): Promise<FetchResult> {
    if (this.isLocalFile(source)) {
      return this.fetchLocal(source);
    } else if (this.isHttpUrl(source)) {
      return this.fetchRemote(source);
    } else {
      throw new Error(`Invalid source: ${source}`);
    }
  }

  private isLocalFile(source: string): boolean {
    return !source.startsWith('http://') && !source.startsWith('https://');
  }

  private isHttpUrl(source: string): boolean {
    return source.startsWith('http://') || source.startsWith('https://');
  }

  private async fetchLocal(source: string): Promise<FetchResult> {
    const resolvedPath = path.resolve(source);
    if (!await fs.pathExists(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }
    const stats = await fs.stat(resolvedPath);
    if (stats.size > this.maxSizeBytes) {
      throw new Error(`File too large: ${stats.size} bytes`);
    }
    const mimeType = this.getMimeTypeFromExtension(resolvedPath);
    return { localPath: resolvedPath, mimeType, size: stats.size };
  }

  private async fetchRemote(url: string): Promise<FetchResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > this.maxSizeBytes) {
      throw new Error(`File too large: ${contentLength} bytes`);
    }
    const filename = this.generateTempFilename(url, contentType);
    const tempPath = path.join(this.tempDir, filename);
    await pipeline(response.body as any, fs.createWriteStream(tempPath));
    const stats = await fs.stat(tempPath);
    return { localPath: tempPath, mimeType: contentType, size: stats.size };
  }

  private getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private generateTempFilename(url: string, mimeType: string): string {
    const timestamp = Date.now();
    const hash = require('crypto').createHash('md5').update(url).digest('hex').substring(0, 8);
    const ext = this.getExtensionFromMimeType(mimeType);
    return `temp_${timestamp}_${hash}${ext}`;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp'
    };
    return extensions[mimeType] || '.bin';
  }

  validateAsset(mimeType: string, kind: 'image' | 'video'): boolean {
    if (kind === 'image') {
      return mimeType.startsWith('image/');
    }
    return mimeType.startsWith('video/');
  }
}


