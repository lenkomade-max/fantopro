import { OverlayEffect } from './OverlayEffect';
import { SceneInput } from '../types';

export class OverlayTrack {
  private effects: OverlayEffect[] = [];

  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly fps: number,
    public readonly durationSec: number,
  ) {}

  static fromScene(scene: SceneInput): OverlayTrack {
    const track = new OverlayTrack(scene.width, scene.height, scene.fps, scene.durationSec);
    for (const overlay of scene.overlays) {
      track.addEffect(OverlayEffect.fromInput(overlay));
    }
    return track;
  }

  addEffect(effect: OverlayEffect): void {
    this.effects.push(effect);
    this.sortEffects();
  }

  removeEffect(id: string): boolean {
    const initialLength = this.effects.length;
    this.effects = this.effects.filter(e => e.id !== id);
    return this.effects.length < initialLength;
  }

  getEffectsAtFrame(frame: number): OverlayEffect[] {
    return this.effects
      .filter(effect => effect.isVisibleAtFrame(frame, this.fps, this.durationSec))
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getAllEffects(): OverlayEffect[] {
    return [...this.effects];
  }

  getEffectById(id: string): OverlayEffect | undefined {
    return this.effects.find(e => e.id === id);
  }

  updateEffect(id: string, updatedEffect: OverlayEffect): boolean {
    const index = this.effects.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.effects[index] = updatedEffect;
    this.sortEffects();
    return true;
  }

  private sortEffects(): void {
    this.effects.sort((a, b) => a.zIndex - b.zIndex);
  }

  getMaxConcurrentEffects(): number {
    let maxConcurrent = 0;
    const totalFrames = Math.floor(this.durationSec * this.fps);
    for (let frame = 0; frame <= totalFrames; frame++) {
      const concurrent = this.getEffectsAtFrame(frame).length;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
    }
    return maxConcurrent;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.effects.length === 0) {
      errors.push('No effects in track');
    }
    if (this.getMaxConcurrentEffects() > 10) {
      errors.push('More than 10 concurrent effects detected');
    }
    for (const effect of this.effects) {
      if (effect.opacity < 0 || effect.opacity > 1) {
        errors.push(`Effect ${effect.id} has invalid opacity: ${effect.opacity}`);
      }
      if (effect.timing.kind === 'window') {
        if (effect.timing.startSec < 0) {
          errors.push(`Effect ${effect.id} has negative start time`);
        }
        if (effect.timing.endSec > this.durationSec) {
          errors.push(`Effect ${effect.id} extends beyond scene duration`);
        }
        if (effect.timing.startSec >= effect.timing.endSec) {
          errors.push(`Effect ${effect.id} has invalid time window`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
}


