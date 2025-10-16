import { OverlayInput, OverlayTiming, PreparedAsset } from '../types/index';

export class OverlayEffect {
  constructor(
    public readonly id: string,
    public readonly source: OverlayInput['source'],
    public readonly blendMode: OverlayInput['blendMode'],
    public readonly opacity: number,
    public readonly zIndex: number,
    public readonly timing: OverlayTiming,
    public preparedAsset?: PreparedAsset,
  ) {}

  static fromInput(input: OverlayInput): OverlayEffect {
    return new OverlayEffect(
      input.id,
      input.source,
      input.blendMode,
      Math.max(0, Math.min(1, input.opacity)),
      input.zIndex,
      input.timing,
    );
  }

  isVisibleAtFrame(frame: number, fps: number, durationSec: number): boolean {
    const { startFrame, endFrame } = this.getFrameWindow(fps, durationSec);
    return frame >= startFrame && frame <= endFrame;
  }

  getFrameWindow(fps: number, durationSec: number): { startFrame: number; endFrame: number } {
    if (this.timing.kind === 'full') {
      return {
        startFrame: 0,
        endFrame: Math.floor(durationSec * fps),
      };
    }
    return {
      startFrame: Math.floor(this.timing.startSec * fps),
      endFrame: Math.floor(this.timing.endSec * fps),
    };
  }

  withPreparedAsset(asset: PreparedAsset): OverlayEffect {
    return new OverlayEffect(
      this.id,
      this.source,
      this.blendMode,
      this.opacity,
      this.zIndex,
      this.timing,
      asset,
    );
  }
}


