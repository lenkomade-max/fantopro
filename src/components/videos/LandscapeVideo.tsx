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

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
} from "../utils";
import { TextOverlay } from "../../remotion/compositions/TextOverlay";
import { KenBurnsImage } from "../../remotion/compositions/KenBurnsImage";

const { fontFamily } = loadFont(); // "Barlow Condensed"

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

  const captionPosition = config.captionPosition ?? "center";
  let captionStyle = {};
  if (captionPosition === "top") {
    captionStyle = { top: 100 };
  }
  if (captionPosition === "center") {
    captionStyle = { top: "50%", transform: "translateY(-50%)" };
  }
  if (captionPosition === "bottom") {
    captionStyle = { bottom: 100 };
  }

  const [musicVolume, musicMuted] = calculateVolume(config.musicVolume);

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <Audio
        loop
        src={music.url}
        startFrom={music.start * fps}
        endAt={music.end * fps}
        volume={() => musicVolume}
        muted={musicMuted}
      />

      {scenes.map((scene, i) => {
        const { captions, audio, video, effects, textOverlays } = scene;
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

        return (
          <Sequence
            from={startFrame}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            {/* Render video or image with Ken Burns effect */}
            {isVideoFile(video) ? (
              <OffthreadVideo src={video} muted />
            ) : (
              <KenBurnsImage 
                src={video}
                durationInSeconds={sceneDuration}
                zoomDirection="in"
                panDirection="none"
              />
            )}
            <Audio src={audio.url} />

            {/* Effects are applied via FFmpeg post-processing (not in Remotion) */}

            {/* Text Overlays */}
            {textOverlays?.map((overlay: any, overlayIdx: number) => (
              <TextOverlay
                key={`overlay-${i}-${overlayIdx}`}
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
