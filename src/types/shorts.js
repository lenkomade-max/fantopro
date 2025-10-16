"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShortInput = exports.renderConfig = exports.MusicVolumeEnum = exports.OrientationEnum = exports.VoiceEnum = exports.sceneInput = exports.TextAnimationEnum = exports.BlendModeEnum = exports.CaptionPositionEnum = exports.MusicMoodEnum = void 0;
const zod_1 = __importDefault(require("zod"));
var MusicMoodEnum;
(function (MusicMoodEnum) {
    MusicMoodEnum["sad"] = "sad";
    MusicMoodEnum["melancholic"] = "melancholic";
    MusicMoodEnum["happy"] = "happy";
    MusicMoodEnum["euphoric"] = "euphoric/high";
    MusicMoodEnum["excited"] = "excited";
    MusicMoodEnum["chill"] = "chill";
    MusicMoodEnum["uneasy"] = "uneasy";
    MusicMoodEnum["angry"] = "angry";
    MusicMoodEnum["dark"] = "dark";
    MusicMoodEnum["hopeful"] = "hopeful";
    MusicMoodEnum["contemplative"] = "contemplative";
    MusicMoodEnum["funny"] = "funny/quirky";
})(MusicMoodEnum || (exports.MusicMoodEnum = MusicMoodEnum = {}));
var CaptionPositionEnum;
(function (CaptionPositionEnum) {
    CaptionPositionEnum["top"] = "top";
    CaptionPositionEnum["center"] = "center";
    CaptionPositionEnum["bottom"] = "bottom";
})(CaptionPositionEnum || (exports.CaptionPositionEnum = CaptionPositionEnum = {}));
// Media source types for flexible content loading
const fileUploadSchema = zod_1.default.object({
    filename: zod_1.default.string().describe("Original filename"),
    data: zod_1.default.unknown().describe("Base64 encoded string or binary Buffer"),
    mimeType: zod_1.default.string().describe("MIME type (e.g., video/mp4, image/jpeg)"),
});
const pexelsMediaSchema = zod_1.default.object({
    type: zod_1.default.literal("pexels"),
    searchTerms: zod_1.default
        .array(zod_1.default.string())
        .describe("Search terms for Pexels video search"),
});
const urlMediaSchema = zod_1.default.object({
    type: zod_1.default.literal("url"),
    urls: zod_1.default
        .array(zod_1.default.string().url())
        .describe("Array of HTTP/HTTPS URLs to video or image files"),
});
const fileMediaSchema = zod_1.default.object({
    type: zod_1.default.literal("files"),
    files: zod_1.default
        .array(fileUploadSchema)
        .describe("Array of direct file uploads (base64 or binary)"),
});
const mediaSourceSchema = zod_1.default.union([
    pexelsMediaSchema,
    urlMediaSchema,
    fileMediaSchema,
]);
// Blend effect configuration
var BlendModeEnum;
(function (BlendModeEnum) {
    BlendModeEnum["normal"] = "normal";
    BlendModeEnum["screen"] = "screen";
    BlendModeEnum["multiply"] = "multiply";
    BlendModeEnum["overlay"] = "overlay";
    BlendModeEnum["add"] = "add";
})(BlendModeEnum || (exports.BlendModeEnum = BlendModeEnum = {}));
const blendEffectSchema = zod_1.default.object({
    type: zod_1.default.literal("blend"),
    overlayUrl: zod_1.default.string().url().optional().describe("URL to overlay video/image"),
    overlayFile: fileUploadSchema.optional().describe("Direct file upload for overlay"),
    staticEffectPath: zod_1.default.string().optional().describe("Path to static effect in effects directory (e.g., effects/hash.mp4)"),
    blendMode: zod_1.default.nativeEnum(BlendModeEnum).describe("CSS blend mode"),
    opacity: zod_1.default.number().min(0).max(1).default(1).describe("Opacity (0.0 - 1.0)"),
    duration: zod_1.default.union([
        zod_1.default.literal("full"),
        zod_1.default.object({
            start: zod_1.default.number().describe("Start time in seconds"),
            end: zod_1.default.number().describe("End time in seconds"),
        }),
    ]).optional().describe("Duration of the effect (default: full scene)"),
});
// For now, only blend effect is supported. More effect types can be added later.
const effectSchema = blendEffectSchema;
// Text overlay configuration
var TextAnimationEnum;
(function (TextAnimationEnum) {
    TextAnimationEnum["fadeIn"] = "fadeIn";
    TextAnimationEnum["slideIn"] = "slideIn";
    TextAnimationEnum["typewriter"] = "typewriter";
    TextAnimationEnum["bounce"] = "bounce";
    TextAnimationEnum["pulse"] = "pulse";
    TextAnimationEnum["none"] = "none";
})(TextAnimationEnum || (exports.TextAnimationEnum = TextAnimationEnum = {}));
const textOverlaySchema = zod_1.default.object({
    text: zod_1.default.string().describe("Text to display"),
    position: zod_1.default.object({
        x: zod_1.default.union([zod_1.default.literal("left"), zod_1.default.literal("center"), zod_1.default.literal("right"), zod_1.default.number()]).describe("X position"),
        y: zod_1.default.union([zod_1.default.literal("top"), zod_1.default.literal("center"), zod_1.default.literal("bottom"), zod_1.default.number()]).describe("Y position"),
    }).describe("Text position on screen"),
    style: zod_1.default.object({
        fontSize: zod_1.default.number().optional().describe("Font size in pixels"),
        fontFamily: zod_1.default.string().optional().describe("Font family"),
        color: zod_1.default.string().optional().describe("Text color (CSS color)"),
        backgroundColor: zod_1.default.string().optional().describe("Background color (CSS color)"),
        padding: zod_1.default.number().optional().describe("Padding in pixels"),
        opacity: zod_1.default.number().min(0).max(1).optional().describe("Opacity (0.0 - 1.0)"),
    }).optional().describe("Text styling"),
    animation: zod_1.default.nativeEnum(TextAnimationEnum).optional().describe("Animation type"),
    timing: zod_1.default.object({
        start: zod_1.default.number().describe("Start time in seconds"),
        end: zod_1.default.number().describe("End time in seconds"),
    }).optional().describe("When to show the text (default: full scene)"),
});
exports.sceneInput = zod_1.default.object({
    text: zod_1.default.string().describe("Text to be spoken in the video"),
    // Legacy format (backward compatibility) - OPTIONAL now
    searchTerms: zod_1.default
        .array(zod_1.default.string())
        .optional()
        .describe("LEGACY: Search terms for Pexels. Use 'media' field for new flexible sources."),
    // NEW: Flexible media source - OPTIONAL
    media: mediaSourceSchema
        .optional()
        .describe("Media source configuration. Supports Pexels, URL downloads, or direct file uploads."),
    // NEW: Effects - OPTIONAL
    effects: zod_1.default
        .array(effectSchema)
        .optional()
        .describe("Visual effects to apply (blend overlays, etc.)"),
    // NEW: Text overlays - OPTIONAL
    textOverlays: zod_1.default
        .array(textOverlaySchema)
        .optional()
        .describe("Text overlays to display on the video"),
}).refine((data) => data.searchTerms || data.media, {
    message: "Either 'searchTerms' (legacy) or 'media' must be provided",
});
var VoiceEnum;
(function (VoiceEnum) {
    VoiceEnum["af_heart"] = "af_heart";
    VoiceEnum["af_alloy"] = "af_alloy";
    VoiceEnum["af_aoede"] = "af_aoede";
    VoiceEnum["af_bella"] = "af_bella";
    VoiceEnum["af_jessica"] = "af_jessica";
    VoiceEnum["af_kore"] = "af_kore";
    VoiceEnum["af_nicole"] = "af_nicole";
    VoiceEnum["af_nova"] = "af_nova";
    VoiceEnum["af_river"] = "af_river";
    VoiceEnum["af_sarah"] = "af_sarah";
    VoiceEnum["af_sky"] = "af_sky";
    VoiceEnum["am_adam"] = "am_adam";
    VoiceEnum["am_echo"] = "am_echo";
    VoiceEnum["am_eric"] = "am_eric";
    VoiceEnum["am_fenrir"] = "am_fenrir";
    VoiceEnum["am_liam"] = "am_liam";
    VoiceEnum["am_michael"] = "am_michael";
    VoiceEnum["am_onyx"] = "am_onyx";
    VoiceEnum["am_puck"] = "am_puck";
    VoiceEnum["am_santa"] = "am_santa";
    VoiceEnum["bf_emma"] = "bf_emma";
    VoiceEnum["bf_isabella"] = "bf_isabella";
    VoiceEnum["bm_george"] = "bm_george";
    VoiceEnum["bm_lewis"] = "bm_lewis";
    VoiceEnum["bf_alice"] = "bf_alice";
    VoiceEnum["bf_lily"] = "bf_lily";
    VoiceEnum["bm_daniel"] = "bm_daniel";
    VoiceEnum["bm_fable"] = "bm_fable";
})(VoiceEnum || (exports.VoiceEnum = VoiceEnum = {}));
var OrientationEnum;
(function (OrientationEnum) {
    OrientationEnum["landscape"] = "landscape";
    OrientationEnum["portrait"] = "portrait";
})(OrientationEnum || (exports.OrientationEnum = OrientationEnum = {}));
var MusicVolumeEnum;
(function (MusicVolumeEnum) {
    MusicVolumeEnum["muted"] = "muted";
    MusicVolumeEnum["low"] = "low";
    MusicVolumeEnum["medium"] = "medium";
    MusicVolumeEnum["high"] = "high";
})(MusicVolumeEnum || (exports.MusicVolumeEnum = MusicVolumeEnum = {}));
exports.renderConfig = zod_1.default.object({
    paddingBack: zod_1.default
        .number()
        .optional()
        .describe("For how long the video should be playing after the speech is done, in milliseconds. 1500 is a good value."),
    music: zod_1.default
        .nativeEnum(MusicMoodEnum)
        .optional()
        .describe("Music tag to be used to find the right music for the video"),
    captionPosition: zod_1.default
        .nativeEnum(CaptionPositionEnum)
        .optional()
        .describe("Position of the caption in the video"),
    captionBackgroundColor: zod_1.default
        .string()
        .optional()
        .describe("Background color of the caption, a valid css color, default is blue"),
    voice: zod_1.default
        .nativeEnum(VoiceEnum)
        .optional()
        .describe("Voice to be used for the speech, default is af_heart"),
    orientation: zod_1.default
        .nativeEnum(OrientationEnum)
        .optional()
        .describe("Orientation of the video, default is portrait"),
    musicVolume: zod_1.default
        .nativeEnum(MusicVolumeEnum)
        .optional()
        .describe("Volume of the music, default is high"),
});
exports.createShortInput = zod_1.default.object({
    scenes: zod_1.default.array(exports.sceneInput).describe("Each scene to be created"),
    config: exports.renderConfig.describe("Configuration for rendering the video"),
});
