import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Video, Img, useCurrentFrame, useVideoConfig, delayRender, continueRender, Sequence, staticFile } from "remotion";

export interface BlendOverlayProps {
  /** Local path to overlay file */
  overlayPath: string;
  /** Optional public URL (/static/effects/...) */
  publicUrl?: string;
  /** Optional staticEffectPath ('effects/<hash>.<ext>') for staticFile() */
  staticEffectPath?: string;
  /** CSS blend mode */
  blendMode: string;
  /** Opacity (0.0 - 1.0) */
  opacity?: number;
  /** Whether overlay is a video or image */
  isVideo: boolean;
  /** Duration configuration */
  duration?: "full" | { start: number; end: number };
  /** Scene duration in seconds */
  sceneDuration: number;
}

export const BlendOverlay: React.FC<BlendOverlayProps> = ({
  overlayPath,
  publicUrl,
  staticEffectPath,
  blendMode,
  opacity = 1,
  isVideo,
  duration = "full",
  sceneDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = useState(() => delayRender(`overlay(${overlayPath})`));
  const timeoutRef = useRef<number | null>(null);
  
  const currentTimeInSeconds = frame / fps;

  // Compute timing window in frames
  const startSeconds = duration === "full" ? 0 : Math.max(0, duration.start);
  const endSeconds = duration === "full" ? sceneDuration : Math.min(sceneDuration, duration.end);
  const startFrameWindow = Math.round(startSeconds * fps);
  const durationFramesWindow = Math.max(1, Math.round((endSeconds - startSeconds) * fps));

  // Use blend mode directly - no mapping needed
  const overlayStyle: React.CSSProperties = {
    mixBlendMode: blendMode as any,
    opacity,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  // Безопасная инициализация: продолжаем рендер только после загрузки метаданных/изображения
  const onReady = useMemo(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    continueRender(handle);
  }, [handle]);

  const onError = useMemo(
    () => (e: any) => {
      // Даже при ошибке продолжаем, чтобы не повиснуть
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      continueRender(handle);
    },
    [handle],
  );

  useEffect(() => {
    // Фолбэк: если за 20с не загрузилось, продолжаем, чтобы не словить timeout
    timeoutRef.current = window.setTimeout(() => {
      continueRender(handle);
    }, 20000);
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [handle]);

  // Используем только локальные пути к файлам, без HTTP URL
  if (!overlayPath) {
    console.error("BlendOverlay: No overlayPath provided", { overlayPath, publicUrl });
    return null;
  }
  
  // Use staticFile() for proper bundling
  const src = staticEffectPath ? staticFile(staticEffectPath) : overlayPath;
  
  // Debug logging to verify path resolution
  console.log("BlendOverlay: Using local file path", {
    staticEffectPath,
    resolvedSrc: src,
    overlayPath,
    publicUrl,
    isVideo,
    blendMode,
    opacity,
    duration,
    sceneDuration
  });

  return (
    <Sequence from={startFrameWindow} durationInFrames={durationFramesWindow}>
      <AbsoluteFill style={{ zIndex: 10 }}>
        {isVideo ? (
          <Video
            src={src}
            style={overlayStyle}
            muted
            loop
            onLoadedMetadata={onReady}
            onError={onError}
          />
        ) : (
          <Img
            src={src}
            style={overlayStyle}
            onLoad={onReady}
            onError={onError}
          />
        )}
      </AbsoluteFill>
    </Sequence>
  );
};


