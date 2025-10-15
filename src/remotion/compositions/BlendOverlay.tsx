/**
 * Blend Overlay Component
 * 
 * Renders a blend effect overlay on top of the video.
 */

import React from "react";
import { AbsoluteFill, Video, Img, useCurrentFrame, useVideoConfig } from "remotion";

export interface BlendOverlayProps {
  /** Local path to overlay file */
  overlayPath: string;
  /** CSS blend mode */
  blendMode: "normal" | "screen" | "multiply" | "overlay" | "add";
  /** Opacity (0.0 - 1.0) */
  opacity: number;
  /** Whether overlay is a video or image */
  isVideo: boolean;
  /** Duration configuration */
  duration?: "full" | { start: number; end: number };
  /** Scene duration in seconds */
  sceneDuration: number;
}

export const BlendOverlay: React.FC<BlendOverlayProps> = ({
  overlayPath,
  blendMode,
  opacity,
  isVideo,
  duration = "full",
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const currentTimeInSeconds = frame / fps;

  // Calculate visibility based on duration
  let isVisible = true;
  if (duration !== "full") {
    isVisible = currentTimeInSeconds >= duration.start && currentTimeInSeconds <= duration.end;
  }

  if (!isVisible) {
    return null;
  }

  // Map blend modes to CSS mix-blend-mode values
  const cssBlendMode = blendMode === "add" ? "lighten" : blendMode;

  const overlayStyle: React.CSSProperties = {
    mixBlendMode: cssBlendMode as any,
    opacity,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  return (
    <AbsoluteFill style={{ zIndex: 10 }}>
      {isVideo ? (
        <Video
          src={overlayPath}
          style={overlayStyle}
          muted
          loop
        />
      ) : (
        <Img
          src={overlayPath}
          style={overlayStyle}
        />
      )}
    </AbsoluteFill>
  );
};

