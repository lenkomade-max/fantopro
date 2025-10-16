import type { Config } from "../../../src/config";

export interface PreparedEffect {
  staticEffectPath: string;
  blendMode: string;
  opacity: number;
  isVideo: boolean;
  duration?: "full" | { start: number; end: number };
}

export async function prepareAssets(config: Config, effects: any[]): Promise<PreparedEffect[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OverlayCache } = require("../../../src/short-creator/effects/OverlayCache");
  const fs = require("fs-extra");
  const path = require("path");

  const cache = new OverlayCache(config as any);
  const prepared: PreparedEffect[] = [];

  for (const e of effects || []) {
    if (e.overlayUrl?.startsWith("file://")) {
      const filePath = e.overlayUrl.replace("file://", "");
      const tempName = `prep_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const ext = path.extname(filePath) || ".mp4";
      const tmp = path.join(config.tempDirPath, `${tempName}${ext}`);
      await fs.copy(filePath, tmp);
      const { staticEffectPath } = await cache.put(tmp);
      prepared.push({
        staticEffectPath,
        blendMode: e.blendMode ?? "normal",
        opacity: e.opacity ?? 1,
        isVideo: [".mp4", ".webm", ".mov", ".avi"].includes(ext.toLowerCase()),
        duration: e.duration,
      });
    }
  }

  return prepared;
}




