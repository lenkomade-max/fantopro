import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import { Config } from "../../config";
import { logger } from "../../logger";

/**
 * OverlayCache
 * — сохраняет переданные оверлеи в стабильный путь внутри static/effects
 * — возвращает стабильный публичный URL вида /static/effects/<hash>.<ext>
 *
 * Ничего не переписывает в существующей логике — только добавляет кэш-слой.
 */
export class OverlayCache {
  private effectsDir: string;

  constructor(private config: Config) {
    // staticDirPath указывает на <packageRoot>/static
    // складываем эффекты в <static>/effects
    // @ts-ignore - свойство есть в рантайме (config.ts)
    const staticDirPath: string = (this.config as any).staticDirPath;
    this.effectsDir = path.join(staticDirPath, "effects");
    fs.ensureDirSync(this.effectsDir);
  }

  /**
   * Кладёт файл в кэш по контент-хэшу; возвращает абсолютный путь и public URL
   */
  public async put(tempPath: string): Promise<{ localPath: string; publicUrl: string; staticEffectPath: string }> {
    const buffer = await fs.readFile(tempPath);
    const hash = crypto.createHash("sha1").update(buffer).digest("hex");
    const ext = path.extname(tempPath) || ".mp4";
    const cachedName = `${hash}${ext}`;
    const cachedPath = path.join(this.effectsDir, cachedName);

    if (!(await fs.pathExists(cachedPath))) {
      await fs.copy(tempPath, cachedPath);
      logger.debug({ cachedPath }, "Overlay cached to static/effects");
    }

    const publicUrl = `/static/effects/${cachedName}`;
    const staticEffectPath = `effects/${cachedName}`;
    return { localPath: cachedPath, publicUrl, staticEffectPath };
  }
}


