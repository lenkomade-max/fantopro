import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  OffthreadVideo,
  Img,
} from "remotion";
import { z } from "zod";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOpenSans } from "@remotion/google-fonts/OpenSans";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
} from "../utils";
import { TextOverlay } from "../../remotion/compositions/TextOverlay";
import { AdvancedTextOverlay } from "../../remotion/compositions/AdvancedTextOverlay";
import { KenBurnsImage } from "../../remotion/compositions/KenBurnsImage";
import { resolvePositionValue } from "../utils/position";

const { fontFamily } = loadFont(); // "Barlow Condensed" (for captions)

// Load fonts for text overlays (Crime videos)
loadAnton();
loadOswald();
loadBebasNeue();
loadRoboto();
loadMontserrat();
loadOpenSans();

// Helper function to determine if file is video based on extension
const isVideoFile = (url: string): boolean => {
  return url.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv|flv|wmv)$/) !== null;
};

export const LandscapeVideo: React.FC<z.infer<typeof shortVideoSchema>> = ({
  scenes,
  music,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";

  const activeStyle = {
    backgroundColor: captionBackgroundColor,
    padding: "10px",
    marginLeft: "-10px",
    marginRight: "-10px",
    borderRadius: "10px",
  };

  // Resolve caption position from flexible format (pixels, percentages, aliases) to absolute pixels
  const captionPosition = config.captionPosition ?? "center";
  const VIDEO_HEIGHT = 1080; // Landscape height
  const resolvedCaptionY = resolvePositionValue(captionPosition, VIDEO_HEIGHT, true);

  const captionStyle = {
    top: resolvedCaptionY,
  };

  const [musicVolume, musicMuted] = calculateVolume(config.musicVolume);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio
        loop
        src={music.url}
        startFrom={music.start * fps}
        endAt={music.end * fps}
        volume={() => musicVolume}
        muted={musicMuted}
      />

      {scenes.map((scene, i) => {
        const { captions, audio, video, videos, mediaDuration, effects, textOverlays, advancedTextOverlays } = scene;
        const pages = createCaptionPages({
          captions,
          lineMaxLength: 30,
          lineCount: 1,
          maxDistanceMs: 1000,
        });

        // Calculate the start and end time of the scene
        const startFrame =
          scenes.slice(0, i).reduce((acc, curr) => {
            return acc + curr.audio.duration;
          }, 0) * fps;
        let durationInFrames =
          scenes.slice(0, i + 1).reduce((acc, curr) => {
            return acc + curr.audio.duration;
          }, 0) * fps;
        if (config.paddingBack && i === scenes.length - 1) {
          durationInFrames += (config.paddingBack / 1000) * fps;
        }

        const sceneDuration = audio.duration;

        // Check if using multi-media looping mode
        const useMultiMedia = videos && mediaDuration;

        return (
          <Sequence
            from={startFrame}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            {/* Render media based on mode */}
            {useMultiMedia ? (
              // NEW: Multi-media looping mode
              (() => {
                // Add paddingBack to last scene's total duration
                const isLastScene = i === scenes.length - 1;
                const paddingBackSeconds = (isLastScene && config.paddingBack) ? config.paddingBack / 1000 : 0;
                const totalSceneDuration = sceneDuration + paddingBackSeconds;
                const totalSlots = Math.ceil(totalSceneDuration / mediaDuration);
                const mediaSequences = [];

                for (let slot = 0; slot < totalSlots; slot++) {
                  const mediaIndex = slot % videos.length;
                  const currentMedia = videos[mediaIndex];
                  const slotStartTime = slot * mediaDuration;
                  const slotDuration = Math.min(mediaDuration, totalSceneDuration - slotStartTime);
                  const slotStartFrame = Math.round(slotStartTime * fps);
                  const slotDurationFrames = Math.round(slotDuration * fps);

                  mediaSequences.push(
                    <Sequence
                      key={`media-${slot}`}
                      from={slotStartFrame}
                      durationInFrames={slotDurationFrames}
                    >
                      {isVideoFile(currentMedia) ? (
                        <OffthreadVideo src={currentMedia} muted />
                      ) : (
                        <KenBurnsImage
                          src={currentMedia}
                          durationInSeconds={slotDuration}
                          zoomDirection="in"
                          panDirection="none"
                        />
                      )}
                    </Sequence>
                  );
                }

                return <>{mediaSequences}</>;
              })()
            ) : (
              // LEGACY: Single media for entire scene
              (() => {
                const isLastScene = i === scenes.length - 1;
                const paddingBackSeconds = (isLastScene && config.paddingBack) ? config.paddingBack / 1000 : 0;
                const totalDuration = sceneDuration + paddingBackSeconds;

                return (
                  <>
                    {isVideoFile(video!) ? (
                      <OffthreadVideo src={video!} muted />
                    ) : (
                      <KenBurnsImage
                        src={video!}
                        durationInSeconds={totalDuration}
                        zoomDirection="in"
                        panDirection="none"
                      />
                    )}
                  </>
                );
              })()
            )}
            <Audio src={audio.url} />

            {/* Effects are applied via FFmpeg post-processing (not in Remotion) */}

            {/* Text Overlays (legacy simple text) */}
            {textOverlays?.map((overlay: any, overlayIdx: number) => (
              <TextOverlay
                key={`overlay-${i}-${overlayIdx}`}
                {...overlay}
                sceneDuration={sceneDuration}
              />
            ))}

            {/* Advanced Text Overlays (multi-color/multi-style support) */}
            {advancedTextOverlays?.map((overlay: any, overlayIdx: number) => (
              <AdvancedTextOverlay
                key={`advanced-overlay-${i}-${overlayIdx}`}
                {...overlay}
                sceneDuration={sceneDuration}
              />
            ))}
            
            {pages.map((page, j) => {
              return (
                <Sequence
                  key={`scene-${i}-page-${j}`}
                  from={Math.round((page.startMs / 1000) * fps)}
                  durationInFrames={Math.round(
                    ((page.endMs - page.startMs) / 1000) * fps,
                  )}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      width: "100%",
                      ...captionStyle,
                    }}
                  >
                    {page.lines.map((line, k) => {
                      return (
                        <p
                          style={{
                            fontSize: "8em",
                            fontFamily: fontFamily,
                            fontWeight: "black",
                            color: "white",
                            WebkitTextStroke: "2px black",
                            WebkitTextFillColor: "white",
                            textShadow: "0px 0px 10px black",
                            textAlign: "center",
                            width: "100%",
                            // uppercase
                            textTransform: "uppercase",
                          }}
                          key={`scene-${i}-page-${j}-line-${k}`}
                        >
                          {line.texts.map((text, l) => {
                            const active =
                              frame >=
                                startFrame + (text.startMs / 1000) * fps &&
                              frame <= startFrame + (text.endMs / 1000) * fps;
                            return (
                              <>
                                <span
                                  style={{
                                    fontWeight: "bold",
                                    ...(active ? activeStyle : {}),
                                  }}
                                  key={`scene-${i}-page-${j}-line-${k}-text-${l}`}
                                >
                                  {text.text}
                                </span>
                                {l < line.texts.length - 1 ? " " : ""}
                              </>
                            );
                          })}
                        </p>
                      );
                    })}
                  </div>
                </Sequence>
              );
            })}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
