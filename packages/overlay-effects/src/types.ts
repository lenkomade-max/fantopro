export interface OverlayEffectRef { staticEffectPath: string; blendMode: string; opacity: number; isVideo: boolean; duration?: "full" | { start: number; end: number }; }
export interface OverlayInput { scenes: Array<{ effects?: OverlayEffectRef[]; sceneDuration: number }>; };
