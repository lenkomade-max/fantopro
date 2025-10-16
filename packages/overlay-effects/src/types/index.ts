export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

export type OverlayTiming =
  | { kind: 'full' }
  | { kind: 'window'; startSec: number; endSec: number };

export type OverlaySource =
  | { kind: 'image'; src: string }
  | { kind: 'video'; src: string };

export interface OverlayInput {
  id: string;
  source: OverlaySource;
  blendMode: BlendMode;
  opacity: number; // 0..1
  zIndex: number;  // layer order
  timing: OverlayTiming;
}

export interface SceneInput {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  overlays: OverlayInput[];
}

export interface PreparedAsset {
  id: string;
  kind: 'image' | 'video';
  staticPath: string; // relative path for staticFile()-style usage
}

export interface PrepareResult {
  assets: PreparedAsset[];
}

export interface OverlayEngine {
  prepare(scene: SceneInput): Promise<PrepareResult>;
}

// Internal types
export interface ProcessedOverlay extends OverlayInput {
  startFrame: number;
  endFrame: number;
  preparedAsset?: PreparedAsset;
}


