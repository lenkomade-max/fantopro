/**
 * Advanced Text Overlay Component
 *
 * Renders multi-color, multi-style text overlays with support for:
 * - Accent words with different colors and sizes
 * - Per-segment styling (color, fontSize, fontWeight, etc.)
 * - Advanced line breaking control
 * - All standard animations (fadeIn, slideIn, bounce, pulse, typewriter)
 *
 * Example use cases:
 * - Viral TikTok/Instagram content with color-coded emphasis
 * - Crime documentaries with red accent numbers
 * - Educational content with highlighted key terms
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { AdvancedTextOverlay as AdvancedTextOverlayType, TextSegment } from "../../types/shorts";
import { resolvePosition } from "../../components/utils/position";

export interface AdvancedTextOverlayProps extends AdvancedTextOverlayType {
  /** Scene duration in seconds */
  sceneDuration: number;
}

export const AdvancedTextOverlay: React.FC<AdvancedTextOverlayProps> = ({
  segments,
  position,
  baseStyle = {},
  animation = "fadeIn",
  timing,
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const currentTimeInSeconds = frame / fps;

  // Calculate position using utility function (MUST be before early return - React Hooks rules)
  const resolvedPosition = React.useMemo(() => {
    return resolvePosition(position as any, width, height);
  }, [position, width, height]);

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

  // Base styles with defaults
  const defaultBaseStyle = {
    fontSize: 48,
    fontFamily: "Inter, Arial, sans-serif",
    fontWeight: "bold" as const,
    color: "#FFFFFF",
    backgroundColor: "transparent",
    padding: 10,
    opacity: 1,
    textAlign: "center" as const,
    lineHeight: 1.2,
    // maxWidth removed - only manual lineBreak controls line breaks
  };

  const mergedBaseStyle = { ...defaultBaseStyle, ...baseStyle };

  const getTransform = (): string => {
    let transform = "";

    // Center alignment for aliases and percentages
    const needsXCenter =
      position.x === "center" ||
      position.x === "right" ||
      (typeof position.x === "string" && position.x.endsWith("%") && parseFloat(position.x) > 0);

    const needsYCenter =
      position.y === "center" ||
      position.y === "bottom" ||
      (typeof position.y === "string" && position.y.endsWith("%") && parseFloat(position.y) > 0);

    if (needsXCenter) {
      transform += "translateX(-50%) ";
    }
    if (needsYCenter) {
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
        [0, mergedBaseStyle.opacity],
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
        [0, mergedBaseStyle.opacity],
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
      // For typewriter, we'll handle character revelation per-segment below
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
    left: resolvedPosition.x,
    top: resolvedPosition.y,
    transform: animationStyle.transform || getTransform(),
    backgroundColor: mergedBaseStyle.backgroundColor,
    padding: mergedBaseStyle.padding,
    opacity: animationStyle.opacity ?? mergedBaseStyle.opacity,
    borderRadius: 8,
    textAlign: mergedBaseStyle.textAlign,
    // maxWidth completely removed - only manual lineBreak controls line breaks
    lineHeight: mergedBaseStyle.lineHeight,
    zIndex: 20,
  };

  // Render segments with individual styling
  // Group segments into lines based on lineBreak property
  const renderSegments = () => {
    let totalCharsSoFar = 0;
    const lines: React.ReactNode[][] = [[]];
    let currentLineIndex = 0;

    segments.forEach((segment: TextSegment, index: number) => {
      const segmentStyle: React.CSSProperties = {
        fontSize: segment.style?.fontSize ?? mergedBaseStyle.fontSize,
        fontFamily: segment.style?.fontFamily ?? mergedBaseStyle.fontFamily,
        fontWeight: segment.style?.fontWeight ?? mergedBaseStyle.fontWeight,
        color: segment.style?.color ?? mergedBaseStyle.color,
        backgroundColor: segment.style?.backgroundColor ?? "transparent",
        padding: segment.style?.padding !== undefined ? segment.style.padding : 0,
        opacity: segment.style?.opacity ?? 1,
        textShadow: segment.style?.textShadow ?? "2px 2px 4px rgba(0, 0, 0, 0.8)",
        textTransform: segment.style?.textTransform,
        display: "inline", // Changed from inline-block to inline
      };

      let displayText = segment.text;

      // Handle typewriter animation
      if (animation === "typewriter") {
        const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0);
        const charsToShow = Math.floor(
          interpolate(
            relativeFrame,
            [0, durationFrames * 0.5],
            [0, totalChars],
            { extrapolateRight: "clamp" }
          )
        );

        const segmentStartChar = totalCharsSoFar;
        const segmentEndChar = totalCharsSoFar + segment.text.length;
        totalCharsSoFar = segmentEndChar;

        if (charsToShow < segmentStartChar) {
          return; // Segment not revealed yet
        } else if (charsToShow < segmentEndChar) {
          displayText = segment.text.substring(0, charsToShow - segmentStartChar);
        }
      } else {
        totalCharsSoFar += segment.text.length;
      }

      // Add space before segment text if it's not the first segment in the line
      const needsSpace = lines[currentLineIndex].length > 0 ? " " : "";

      // Add segment to current line
      lines[currentLineIndex].push(
        <span key={index} style={segmentStyle}>
          {needsSpace}{displayText}
        </span>
      );

      // If lineBreak is true, start a new line
      if (segment.lineBreak) {
        currentLineIndex++;
        lines[currentLineIndex] = [];
      }
    });

    // Render lines with div wrappers to enforce line breaks
    // Each line is a block element with whiteSpace: nowrap to prevent automatic wrapping
    return lines.map((line, lineIndex) => (
      <div
        key={lineIndex}
        style={{
          display: "block",
          whiteSpace: "nowrap", // Critical: prevents browser from wrapping text automatically
        }}
      >
        {line}
      </div>
    ));
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
      <div style={containerStyle}>
        {renderSegments()}
      </div>
    </AbsoluteFill>
  );
};
