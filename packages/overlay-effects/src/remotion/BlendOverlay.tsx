import React from 'react';
import { Img, Video, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { OverlayEffect } from '../core/OverlayEffect';

interface BlendOverlayProps {
  effect: OverlayEffect;
  width: number;
  height: number;
}

const blendModeMap: Record<string, string> = {
  normal: 'normal',
  screen: 'screen',
  multiply: 'multiply',
  overlay: 'overlay',
  add: 'lighter'
};

export const BlendOverlay: React.FC<BlendOverlayProps> = ({ effect, width, height }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  if (!effect.preparedAsset) {
    console.warn(`No prepared asset for effect ${effect.id}`);
    return null;
  }

  const { startFrame, endFrame } = effect.getFrameWindow(
    fps,
    durationInFrames / fps
  );

  // Check if effect is visible at current frame
  if (frame < startFrame || frame > endFrame) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    opacity: effect.opacity,
    mixBlendMode: blendModeMap[effect.blendMode] as any,
    pointerEvents: 'none'
  };

  const assetSrc = staticFile(effect.preparedAsset.staticPath);

  if (effect.source.kind === 'image') {
    return (
      <div style={containerStyle}>
        <Img
          src={assetSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>
    );
  } else {
    // For video overlays, calculate the start time offset
    const videoStartFrame = frame - startFrame;
    
    return (
      <div style={containerStyle}>
        <Video
          src={assetSrc}
          startFrom={videoStartFrame}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>
    );
  }
};