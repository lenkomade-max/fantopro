/**
 * Ken Burns Effect Component
 * 
 * Applies smooth zoom and pan animation to static images
 */

import React from "react";
import { Img, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface KenBurnsImageProps {
  /** Image source path */
  src: string;
  /** Duration in seconds */
  durationInSeconds: number;
  /** Zoom direction: in (zoom in) or out (zoom out) */
  zoomDirection?: "in" | "out";
  /** Pan direction */
  panDirection?: "left" | "right" | "up" | "down" | "none";
}

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  durationInSeconds,
  zoomDirection = "in",
  panDirection = "none",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const totalFrames = durationInSeconds * fps;

  // Zoom animation
  const scale = interpolate(
    frame,
    [0, totalFrames],
    zoomDirection === "in" ? [1, 1.2] : [1.2, 1],
    { extrapolateRight: "clamp" }
  );

  // Pan animation
  let translateX = 0;
  let translateY = 0;

  if (panDirection === "left" || panDirection === "right") {
    translateX = interpolate(
      frame,
      [0, totalFrames],
      panDirection === "left" ? [0, -5] : [0, 5],
      { extrapolateRight: "clamp" }
    );
  }

  if (panDirection === "up" || panDirection === "down") {
    translateY = interpolate(
      frame,
      [0, totalFrames],
      panDirection === "up" ? [0, -5] : [0, 5],
      { extrapolateRight: "clamp" }
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        }}
      />
    </div>
  );
};

