/**
 * Text Overlay Component
 * 
 * Renders animated text overlays on the video.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { TextOverlay as TextOverlayType } from "../../types/shorts";

export interface TextOverlayProps extends TextOverlayType {
  /** Scene duration in seconds */
  sceneDuration: number;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  position,
  style = {},
  animation = "fadeIn",
  timing,
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  const currentTimeInSeconds = frame / fps;

  // Calculate visibility based on timing
  const startTime = timing?.start ?? 0;
  const endTime = timing?.end ?? sceneDuration;
  const isVisible = currentTimeInSeconds >= startTime && currentTimeInSeconds <= endTime;

  if (!isVisible) {
    return null;
  }

  // Calculate frames for animation
  const startFrame = startTime * fps;
  const endFrame = endTime * fps;
  const durationFrames = endFrame - startFrame;
  const relativeFrame = frame - startFrame;

  // Calculate position
  const getXPosition = (): string | number => {
    if (typeof position.x === "number") return position.x;
    switch (position.x) {
      case "left": return "5%";
      case "center": return "50%";
      case "right": return "95%";
      default: return "50%";
    }
  };

  const getYPosition = (): string | number => {
    if (typeof position.y === "number") return position.y;
    switch (position.y) {
      case "top": return "10%";
      case "center": return "50%";
      case "bottom": return "90%";
      default: return "50%";
    }
  };

  const getTransform = (): string => {
    let transform = "";
    
    if (position.x === "center" || position.x === "right") {
      transform += "translateX(-50%) ";
    }
    if (position.y === "center" || position.y === "bottom") {
      transform += "translateY(-50%) ";
    }

    return transform.trim();
  };

  // Apply animations
  let animationStyle: React.CSSProperties = {};
  
  switch (animation) {
    case "fadeIn": {
      const opacity = interpolate(
        relativeFrame,
        [0, Math.min(30, durationFrames * 0.3)],
        [0, style.opacity ?? 1],
        { extrapolateRight: "clamp" }
      );
      animationStyle.opacity = opacity;
      break;
    }
    
    case "slideIn": {
      const translateY = interpolate(
        relativeFrame,
        [0, Math.min(30, durationFrames * 0.3)],
        [50, 0],
        { extrapolateRight: "clamp" }
      );
      animationStyle.transform = `${getTransform()} translateY(${translateY}px)`;
      animationStyle.opacity = interpolate(
        relativeFrame,
        [0, Math.min(15, durationFrames * 0.15)],
        [0, style.opacity ?? 1],
        { extrapolateRight: "clamp" }
      );
      break;
    }
    
    case "bounce": {
      const bounceValue = spring({
        frame: relativeFrame,
        fps,
        config: {
          damping: 10,
          stiffness: 100,
        },
      });
      const scale = interpolate(bounceValue, [0, 1], [0.8, 1]);
      animationStyle.transform = `${getTransform()} scale(${scale})`;
      break;
    }
    
    case "pulse": {
      const pulseValue = Math.sin((relativeFrame / fps) * Math.PI * 2) * 0.1 + 1;
      animationStyle.transform = `${getTransform()} scale(${pulseValue})`;
      break;
    }
    
    case "typewriter": {
      const charsToShow = Math.floor(
        interpolate(
          relativeFrame,
          [0, durationFrames * 0.5],
          [0, text.length],
          { extrapolateRight: "clamp" }
        )
      );
      text = text.substring(0, charsToShow);
      break;
    }
    
    case "none":
    default:
      if (!animationStyle.transform) {
        animationStyle.transform = getTransform();
      }
      break;
  }

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: getXPosition(),
    top: getYPosition(),
    transform: animationStyle.transform || getTransform(),
    fontSize: style.fontSize ?? 32,
    fontFamily: style.fontFamily ?? "Arial, sans-serif",
    color: style.color ?? "#FFFFFF",
    backgroundColor: style.backgroundColor ?? "transparent",
    padding: style.padding ?? 10,
    opacity: animationStyle.opacity ?? style.opacity ?? 1,
    fontWeight: "bold",
    textAlign: "center",
    borderRadius: 8,
    whiteSpace: "pre-wrap",
    maxWidth: "80%",
    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
    zIndex: 20,
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
      <div style={containerStyle}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

