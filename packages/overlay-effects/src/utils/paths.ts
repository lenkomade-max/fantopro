import path from 'path';
import fs from 'fs-extra';

const CACHE_BASE_DIR = path.join(process.cwd(), '.overlay-cache');
const EFFECTS_DIR = path.join(CACHE_BASE_DIR, 'effects');

export async function ensureCacheDirectories(): Promise<void> {
  await fs.ensureDir(EFFECTS_DIR);
}

export function getCachePath(hash: string, extension: string): string {
  return path.join(EFFECTS_DIR, `${hash}.${extension}`);
}

export function getStaticPath(hash: string, extension: string): string {
  return `effects/${hash}.${extension}`;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}



