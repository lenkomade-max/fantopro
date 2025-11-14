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
  // Crime music tracks
  crime_anepic = "crime_anepic",
  crime_darkhorror = "crime_darkhorror",
  crime_disturbance = "crime_disturbance",
  crime_dronesystem = "crime_dronesystem",
  crime_drone_system_stalker = "crime_drone_system_stalker",
  crime_new_report = "crime_new_report",
}

export enum CaptionPositionEnum {
  top = "top",
  center = "center",
  bottom = "bottom",
}

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

// Blend effect configuration (FFmpeg blend modes)
export enum BlendModeEnum {
  normal = "normal",
  addition = "addition",  // FFmpeg blend mode (replaces 'add')
  screen = "screen",
  multiply = "multiply",
  overlay = "overlay",
  average = "average",   // FFmpeg: 50/50 mix
  lighten = "lighten",   // FFmpeg: light leaks
  darken = "darken",     // FFmpeg: darken - good for white overlays
  hardlight = "hardlight", // FFmpeg: hard light - enhances contrast with white overlays
  add = "add",          // Legacy (deprecated, use 'addition')
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

// Banner overlay effect configuration (Green screen chromakey)
const bannerOverlayEffectSchema = z.object({
  type: z.literal("banner_overlay"),
  bannerUrl: z.string().url().optional().describe("URL to banner video/image with green screen"),
  bannerFile: fileUploadSchema.optional().describe("Direct file upload for banner"),
  staticBannerPath: z.string().optional().describe("Path to static banner in effects directory (e.g., effects/banner.mp4)"),
  chromakey: z.object({
    color: z.string().default("0x00FF00").describe("Chromakey color (default: green #00FF00)"),
    similarity: z.number().min(0).max(1).default(0.2).describe("How similar colors to remove (0.0-1.0)"),
    blend: z.number().min(0).max(1).default(0.2).describe("Edge softness (0.0-1.0)"),
  }).optional().describe("Chromakey settings (default: green 0x00FF00, similarity 0.2, blend 0.2)"),
  position: z.object({
    x: z.union([
      z.literal("left"),
      z.literal("center"),
      z.literal("right"),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '50%')"),
    ]).default(0).describe("X position: 'left'|'center'|'right'|pixels|'50%'"),
    y: z.union([
      z.literal("top"),
      z.literal("center"),
      z.literal("bottom"),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '50%')"),
    ]).default(0).describe("Y position: 'top'|'center'|'bottom'|pixels|'50%'"),
  }).optional().describe("Banner position on screen (default: 0,0 top-left)"),
  duration: z.union([
    z.literal("full"),
    z.object({
      start: z.number().describe("Start time in seconds"),
      end: z.number().describe("End time in seconds"),
    }),
  ]).optional().describe("Duration of the banner (default: full scene)"),
});

// Effect union: blend overlay (VHS effects) + banner overlay (green screen chromakey)
const effectSchema = z.union([blendEffectSchema, bannerOverlayEffectSchema]);

// Text overlay configuration
export enum TextAnimationEnum {
  fadeIn = "fadeIn",
  slideIn = "slideIn",
  typewriter = "typewriter",
  bounce = "bounce",
  pulse = "pulse",
  none = "none",
}

// Text segment for advanced multi-color/multi-style text
const textSegmentSchema = z.object({
  text: z.string().describe("Text content for this segment"),
  style: z.object({
    fontSize: z.number().optional().describe("Font size in pixels (overrides parent)"),
    fontFamily: z.string().optional().describe("Font family (overrides parent)"),
    fontWeight: z.union([z.number(), z.string()]).optional().describe("Font weight: 'normal'|'bold'|100-900"),
    color: z.string().optional().describe("Text color (CSS color, overrides parent)"),
    backgroundColor: z.string().optional().describe("Background color (CSS color, overrides parent)"),
    padding: z.number().optional().describe("Padding in pixels (overrides parent)"),
    opacity: z.number().min(0).max(1).optional().describe("Opacity (0.0 - 1.0, overrides parent)"),
    textShadow: z.string().optional().describe("Custom text shadow (CSS syntax)"),
    textTransform: z.enum(["uppercase", "lowercase", "capitalize", "none"]).optional().describe("Text transformation"),
  }).optional().describe("Segment-specific styling (overrides parent styles)"),
  lineBreak: z.boolean().optional().describe("Force line break after this segment"),
});

const textOverlaySchema = z.object({
  text: z.string().describe("Text to display"),
  position: z.object({
    x: z.union([
      z.literal("left"),
      z.literal("center"),
      z.literal("right"),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '50%', '25.5%')"),
    ]).describe("X position: 'left'|'center'|'right'|pixels|'50%'"),
    y: z.union([
      z.literal("top"),
      z.literal("center"),
      z.literal("bottom"),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '50%', '25.5%')"),
    ]).describe("Y position: 'top'|'center'|'bottom'|pixels|'50%'"),
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

// Advanced text overlay with multi-color/multi-style support
const advancedTextOverlaySchema = z.object({
  segments: z.array(textSegmentSchema).describe("Array of text segments with individual styling"),
  position: z.object({
    x: z.union([
      z.literal("left"),
      z.literal("center"),
      z.literal("right"),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '50%', '25.5%')"),
    ]).describe("X position: 'left'|'center'|'right'|pixels|'50%'"),
    y: z.union([
      z.literal("top"),
      z.literal("center"),
      z.literal("bottom"),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '50%', '25.5%')"),
    ]).describe("Y position: 'top'|'center'|'bottom'|pixels|'50%'"),
  }).describe("Container position on screen"),
  baseStyle: z.object({
    fontSize: z.number().optional().describe("Base font size in pixels (default: 48)"),
    fontFamily: z.string().optional().describe("Base font family (default: 'Inter')"),
    fontWeight: z.union([z.number(), z.string()]).optional().describe("Base font weight (default: 'bold')"),
    color: z.string().optional().describe("Base text color (default: '#FFFFFF')"),
    backgroundColor: z.string().optional().describe("Base background color (default: transparent)"),
    padding: z.number().optional().describe("Base padding in pixels (default: 10)"),
    opacity: z.number().min(0).max(1).optional().describe("Base opacity (default: 1)"),
    textAlign: z.enum(["left", "center", "right"]).optional().describe("Text alignment (default: 'center')"),
    lineHeight: z.number().optional().describe("Line height multiplier (default: 1.2)"),
    maxWidth: z.union([z.number(), z.string()]).optional().describe("Max width in pixels or percentage (default: '80%')"),
  }).optional().describe("Base styling for all segments (can be overridden per segment)"),
  animation: z.nativeEnum(TextAnimationEnum).optional().describe("Animation type applied to entire overlay"),
  timing: z.object({
    start: z.number().describe("Start time in seconds"),
    end: z.number().describe("End time in seconds"),
  }).optional().describe("When to show the overlay (default: full scene)"),
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

  // NEW: Media duration control - OPTIONAL
  mediaDuration: z
    .number()
    .positive()
    .optional()
    .describe(
      "Duration in seconds for each media item (photo/video). If total media duration < audio duration, media will loop. If > audio duration, excess media is discarded. Default: full scene duration (audio length).",
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

  // NEW: Advanced text overlays with multi-color/multi-style support - OPTIONAL
  advancedTextOverlays: z
    .array(advancedTextOverlaySchema)
    .optional()
    .describe("Advanced text overlays with per-segment styling (accent words, multi-color text)"),
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
export type BannerOverlayEffect = z.infer<typeof bannerOverlayEffectSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;
export type TextSegment = z.infer<typeof textSegmentSchema>;
export type AdvancedTextOverlay = z.infer<typeof advancedTextOverlaySchema>;

// Scene type - moved here after type definitions to avoid forward reference issues
export type Scene = {
  captions: Caption[];
  video?: string;  // Single media file (legacy/default behavior)
  videos?: string[];  // Multiple media files (when mediaDuration is specified)
  mediaDuration?: number;  // Duration in seconds for each media item
  audio: {
    url: string;
    duration: number;
  };
  effects?: Effect[];  // Visual effects (blend overlays, banners)
  textOverlays?: TextOverlay[];  // Simple text overlays
  advancedTextOverlays?: AdvancedTextOverlay[];  // Multi-color/multi-style text overlays
};

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
  very_high = "very_high",
  ultra = "ultra",
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
    .union([
      z.nativeEnum(CaptionPositionEnum),
      z.number(),
      z.string().regex(/^\d+(\.\d+)?%$/).describe("Percentage (e.g., '85%')"),
    ])
    .optional()
    .describe("Position of the caption in the video: 'top'|'center'|'bottom'|pixels|'85%'"),
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
  voiceSpeed: z
    .number()
    .min(1.0)
    .max(1.5)
    .default(1.0)
    .optional()
    .describe("Speed of the voice/speech (1.0 = normal, 1.5 = 1.5x faster). Uses FFmpeg atempo filter."),
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
