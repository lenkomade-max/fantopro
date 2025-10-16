import crypto from 'crypto';
import fs from 'fs-extra';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

export async function hashFile(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16);
}

export function generateAssetId(source: string, kind: 'image' | 'video'): string {
  return `${kind}_${hashString(source)}`;
}



