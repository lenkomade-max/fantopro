import z from "zod";

export enum MusicMoodEnum {
  sad = "sad",
  melancholic = "melancholic",
  happy = "happy",
  euphoric = "euphoric/high",
  excited = "excited",
  chill = "chill",
  uneasy = "uneasy",
  angry = "angry",
  dark = "dark",
  hopeful = "hopeful",
  contemplative = "contemplative",
  funny = "funny/quirky",
}

export enum CaptionPositionEnum {
  top = "top",
  center = "center",
  bottom = "bottom",
}

export type Scene = {
  captions: Caption[];
  video: string;
  audio: {
    url: string;
    duration: number;
  };
};

// Media source types for flexible content loading
const fileUploadSchema = z.object({
  filename: z.string().describe("Original filename"),
  data: z.unknown().describe("Base64 encoded string or binary Buffer"),
  mimeType: z.string().describe("MIME type (e.g., video/mp4, image/jpeg)"),
});

const pexelsMediaSchema = z.object({
  type: z.literal("pexels"),
  searchTerms: z
    .array(z.string())
    .describe("Search terms for Pexels video search"),
});

const urlMediaSchema = z.object({
  type: z.literal("url"),
  urls: z
    .array(z.string().url())
    .describe("Array of HTTP/HTTPS URLs to video or image files"),
});

const fileMediaSchema = z.object({
  type: z.literal("files"),
  files: z
    .array(fileUploadSchema)
    .describe("Array of direct file uploads (base64 or binary)"),
});

const mediaSourceSchema = z.union([
  pexelsMediaSchema,
  urlMediaSchema,
  fileMediaSchema,
]);

// Blend effect configuration
export enum BlendModeEnum {
  normal = "normal",
  screen = "screen",
  multiply = "multiply",
  overlay = "overlay",
  add = "add",
}

const blendEffectSchema = z.object({
  type: z.literal("blend"),
  overlayUrl: z.string().url().optional().describe("URL to overlay video/image"),
  overlayFile: fileUploadSchema.optional().describe("Direct file upload for overlay"),
  staticEffectPath: z.string().optional().describe("Path to static effect in effects directory (e.g., effects/hash.mp4)"),
  blendMode: z.nativeEnum(BlendModeEnum).describe("CSS blend mode"),
  opacity: z.number().min(0).max(1).default(1).describe("Opacity (0.0 - 1.0)"),
  duration: z.union([
    z.literal("full"),
    z.object({
      start: z.number().describe("Start time in seconds"),
      end: z.number().describe("End time in seconds"),
    }),
  ]).optional().describe("Duration of the effect (default: full scene)"),
});

// For now, only blend effect is supported. More effect types can be added later.
const effectSchema = blendEffectSchema;

// Text overlay configuration
export enum TextAnimationEnum {
  fadeIn = "fadeIn",
  slideIn = "slideIn",
  typewriter = "typewriter",
  bounce = "bounce",
  pulse = "pulse",
  none = "none",
}

const textOverlaySchema = z.object({
  text: z.string().describe("Text to display"),
  position: z.object({
    x: z.union([z.literal("left"), z.literal("center"), z.literal("right"), z.number()]).describe("X position"),
    y: z.union([z.literal("top"), z.literal("center"), z.literal("bottom"), z.number()]).describe("Y position"),
  }).describe("Text position on screen"),
  style: z.object({
    fontSize: z.number().optional().describe("Font size in pixels"),
    fontFamily: z.string().optional().describe("Font family"),
    color: z.string().optional().describe("Text color (CSS color)"),
    backgroundColor: z.string().optional().describe("Background color (CSS color)"),
    padding: z.number().optional().describe("Padding in pixels"),
    opacity: z.number().min(0).max(1).optional().describe("Opacity (0.0 - 1.0)"),
  }).optional().describe("Text styling"),
  animation: z.nativeEnum(TextAnimationEnum).optional().describe("Animation type"),
  timing: z.object({
    start: z.number().describe("Start time in seconds"),
    end: z.number().describe("End time in seconds"),
  }).optional().describe("When to show the text (default: full scene)"),
});

export const sceneInput = z.object({
  text: z.string().describe("Text to be spoken in the video"),
  
  // Legacy format (backward compatibility) - OPTIONAL now
  searchTerms: z
    .array(z.string())
    .optional()
    .describe(
      "LEGACY: Search terms for Pexels. Use 'media' field for new flexible sources.",
    ),
  
  // NEW: Flexible media source - OPTIONAL
  media: mediaSourceSchema
    .optional()
    .describe(
      "Media source configuration. Supports Pexels, URL downloads, or direct file uploads.",
    ),
  
  // NEW: Effects - OPTIONAL
  effects: z
    .array(effectSchema)
    .optional()
    .describe("Visual effects to apply (blend overlays, etc.)"),
  
  // NEW: Text overlays - OPTIONAL
  textOverlays: z
    .array(textOverlaySchema)
    .optional()
    .describe("Text overlays to display on the video"),
}).refine(
  (data) => data.searchTerms || data.media,
  {
    message: "Either 'searchTerms' (legacy) or 'media' must be provided",
  },
);

export type SceneInput = z.infer<typeof sceneInput>;
export type MediaSource = z.infer<typeof mediaSourceSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type BlendEffect = z.infer<typeof blendEffectSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;

export enum VoiceEnum {
  af_heart = "af_heart",
  af_alloy = "af_alloy",
  af_aoede = "af_aoede",
  af_bella = "af_bella",
  af_jessica = "af_jessica",
  af_kore = "af_kore",
  af_nicole = "af_nicole",
  af_nova = "af_nova",
  af_river = "af_river",
  af_sarah = "af_sarah",
  af_sky = "af_sky",
  am_adam = "am_adam",
  am_echo = "am_echo",
  am_eric = "am_eric",
  am_fenrir = "am_fenrir",
  am_liam = "am_liam",
  am_michael = "am_michael",
  am_onyx = "am_onyx",
  am_puck = "am_puck",
  am_santa = "am_santa",
  bf_emma = "bf_emma",
  bf_isabella = "bf_isabella",
  bm_george = "bm_george",
  bm_lewis = "bm_lewis",
  bf_alice = "bf_alice",
  bf_lily = "bf_lily",
  bm_daniel = "bm_daniel",
  bm_fable = "bm_fable",
}

export enum OrientationEnum {
  landscape = "landscape",
  portrait = "portrait",
}

export enum MusicVolumeEnum {
  muted = "muted",
  low = "low",
  medium = "medium",
  high = "high",
}

export const renderConfig = z.object({
  paddingBack: z
    .number()
    .optional()
    .describe(
      "For how long the video should be playing after the speech is done, in milliseconds. 1500 is a good value.",
    ),
  music: z
    .nativeEnum(MusicMoodEnum)
    .optional()
    .describe("Music tag to be used to find the right music for the video"),
  captionPosition: z
    .nativeEnum(CaptionPositionEnum)
    .optional()
    .describe("Position of the caption in the video"),
  captionBackgroundColor: z
    .string()
    .optional()
    .describe(
      "Background color of the caption, a valid css color, default is blue",
    ),
  voice: z
    .nativeEnum(VoiceEnum)
    .optional()
    .describe("Voice to be used for the speech, default is af_heart"),
  orientation: z
    .nativeEnum(OrientationEnum)
    .optional()
    .describe("Orientation of the video, default is portrait"),
  musicVolume: z
    .nativeEnum(MusicVolumeEnum)
    .optional()
    .describe("Volume of the music, default is high"),
});
export type RenderConfig = z.infer<typeof renderConfig>;

export type Voices = `${VoiceEnum}`;

export type Video = {
  id: string;
  url: string;
  width: number;
  height: number;
};
export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
};

export type CaptionLine = {
  texts: Caption[];
};
export type CaptionPage = {
  startMs: number;
  endMs: number;
  lines: CaptionLine[];
};

export const createShortInput = z.object({
  scenes: z.array(sceneInput).describe("Each scene to be created"),
  config: renderConfig.describe("Configuration for rendering the video"),
});
export type CreateShortInput = z.infer<typeof createShortInput>;

export type VideoStatus = "processing" | "ready" | "failed";

export type Music = {
  file: string;
  start: number;
  end: number;
  mood: string;
};
export type MusicForVideo = Music & {
  url: string;
};

export type MusicTag = `${MusicMoodEnum}`;

export type kokoroModelPrecision = "fp32" | "fp16" | "q8" | "q4" | "q4f16";

export type whisperModels =
  | "tiny"
  | "tiny.en"
  | "base"
  | "base.en"
  | "small"
  | "small.en"
  | "medium"
  | "medium.en"
  | "large-v1"
  | "large-v2"
  | "large-v3"
  | "large-v3-turbo";
