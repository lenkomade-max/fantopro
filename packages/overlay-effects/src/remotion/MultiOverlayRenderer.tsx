import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlendOverlay } from './BlendOverlay';
import { OverlayTrack } from '../core/OverlayTrack';

interface MultiOverlayRendererProps {
  track: OverlayTrack;
  children?: React.ReactNode;
}

export const MultiOverlayRenderer: React.FC<MultiOverlayRendererProps> = ({ 
  track, 
  children 
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  // Get effects visible at current frame, already sorted by zIndex
  const visibleEffects = track.getEffectsAtFrame(frame);

  return (
    <AbsoluteFill>
      {/* Base content */}
      {children}
      
      {/* Overlay effects */}
      {visibleEffects.map((effect) => (
        <BlendOverlay
          key={effect.id}
          effect={effect}
          width={width}
          height={height}
        />
      ))}
    </AbsoluteFill>
  );
};