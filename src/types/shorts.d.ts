import z from "zod";
export declare enum MusicMoodEnum {
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
    funny = "funny/quirky"
}
export declare enum CaptionPositionEnum {
    top = "top",
    center = "center",
    bottom = "bottom"
}
export type Scene = {
    captions: Caption[];
    video: string;
    audio: {
        url: string;
        duration: number;
    };
};
declare const fileUploadSchema: z.ZodObject<{
    filename: z.ZodString;
    data: z.ZodUnknown;
    mimeType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
    mimeType: string;
    data?: unknown;
}, {
    filename: string;
    mimeType: string;
    data?: unknown;
}>;
declare const mediaSourceSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"pexels">;
    searchTerms: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    type: "pexels";
    searchTerms: string[];
}, {
    type: "pexels";
    searchTerms: string[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"url">;
    urls: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    type: "url";
    urls: string[];
}, {
    type: "url";
    urls: string[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"files">;
    files: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        data: z.ZodUnknown;
        mimeType: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        mimeType: string;
        data?: unknown;
    }, {
        filename: string;
        mimeType: string;
        data?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "files";
    files: {
        filename: string;
        mimeType: string;
        data?: unknown;
    }[];
}, {
    type: "files";
    files: {
        filename: string;
        mimeType: string;
        data?: unknown;
    }[];
}>]>;
export declare enum BlendModeEnum {
    normal = "normal",
    screen = "screen",
    multiply = "multiply",
    overlay = "overlay",
    add = "add"
}
declare const blendEffectSchema: z.ZodObject<{
    type: z.ZodLiteral<"blend">;
    overlayUrl: z.ZodOptional<z.ZodString>;
    overlayFile: z.ZodOptional<z.ZodObject<{
        filename: z.ZodString;
        data: z.ZodUnknown;
        mimeType: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        mimeType: string;
        data?: unknown;
    }, {
        filename: string;
        mimeType: string;
        data?: unknown;
    }>>;
    staticEffectPath: z.ZodOptional<z.ZodString>;
    blendMode: z.ZodNativeEnum<typeof BlendModeEnum>;
    opacity: z.ZodDefault<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"full">, z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        end: number;
    }, {
        start: number;
        end: number;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    type: "blend";
    blendMode: BlendModeEnum;
    opacity: number;
    overlayUrl?: string | undefined;
    overlayFile?: {
        filename: string;
        mimeType: string;
        data?: unknown;
    } | undefined;
    staticEffectPath?: string | undefined;
    duration?: "full" | {
        start: number;
        end: number;
    } | undefined;
}, {
    type: "blend";
    blendMode: BlendModeEnum;
    overlayUrl?: string | undefined;
    overlayFile?: {
        filename: string;
        mimeType: string;
        data?: unknown;
    } | undefined;
    staticEffectPath?: string | undefined;
    opacity?: number | undefined;
    duration?: "full" | {
        start: number;
        end: number;
    } | undefined;
}>;
declare const effectSchema: z.ZodObject<{
    type: z.ZodLiteral<"blend">;
    overlayUrl: z.ZodOptional<z.ZodString>;
    overlayFile: z.ZodOptional<z.ZodObject<{
        filename: z.ZodString;
        data: z.ZodUnknown;
        mimeType: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        mimeType: string;
        data?: unknown;
    }, {
        filename: string;
        mimeType: string;
        data?: unknown;
    }>>;
    staticEffectPath: z.ZodOptional<z.ZodString>;
    blendMode: z.ZodNativeEnum<typeof BlendModeEnum>;
    opacity: z.ZodDefault<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"full">, z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        end: number;
    }, {
        start: number;
        end: number;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    type: "blend";
    blendMode: BlendModeEnum;
    opacity: number;
    overlayUrl?: string | undefined;
    overlayFile?: {
        filename: string;
        mimeType: string;
        data?: unknown;
    } | undefined;
    staticEffectPath?: string | undefined;
    duration?: "full" | {
        start: number;
        end: number;
    } | undefined;
}, {
    type: "blend";
    blendMode: BlendModeEnum;
    overlayUrl?: string | undefined;
    overlayFile?: {
        filename: string;
        mimeType: string;
        data?: unknown;
    } | undefined;
    staticEffectPath?: string | undefined;
    opacity?: number | undefined;
    duration?: "full" | {
        start: number;
        end: number;
    } | undefined;
}>;
export declare enum TextAnimationEnum {
    fadeIn = "fadeIn",
    slideIn = "slideIn",
    typewriter = "typewriter",
    bounce = "bounce",
    pulse = "pulse",
    none = "none"
}
declare const textOverlaySchema: z.ZodObject<{
    text: z.ZodString;
    position: z.ZodObject<{
        x: z.ZodUnion<[z.ZodLiteral<"left">, z.ZodLiteral<"center">, z.ZodLiteral<"right">, z.ZodNumber]>;
        y: z.ZodUnion<[z.ZodLiteral<"top">, z.ZodLiteral<"center">, z.ZodLiteral<"bottom">, z.ZodNumber]>;
    }, "strip", z.ZodTypeAny, {
        x: number | "center" | "left" | "right";
        y: number | "top" | "center" | "bottom";
    }, {
        x: number | "center" | "left" | "right";
        y: number | "top" | "center" | "bottom";
    }>;
    style: z.ZodOptional<z.ZodObject<{
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        backgroundColor: z.ZodOptional<z.ZodString>;
        padding: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        opacity?: number | undefined;
        fontSize?: number | undefined;
        fontFamily?: string | undefined;
        color?: string | undefined;
        backgroundColor?: string | undefined;
        padding?: number | undefined;
    }, {
        opacity?: number | undefined;
        fontSize?: number | undefined;
        fontFamily?: string | undefined;
        color?: string | undefined;
        backgroundColor?: string | undefined;
        padding?: number | undefined;
    }>>;
    animation: z.ZodOptional<z.ZodNativeEnum<typeof TextAnimationEnum>>;
    timing: z.ZodOptional<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        end: number;
    }, {
        start: number;
        end: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    position: {
        x: number | "center" | "left" | "right";
        y: number | "top" | "center" | "bottom";
    };
    style?: {
        opacity?: number | undefined;
        fontSize?: number | undefined;
        fontFamily?: string | undefined;
        color?: string | undefined;
        backgroundColor?: string | undefined;
        padding?: number | undefined;
    } | undefined;
    animation?: TextAnimationEnum | undefined;
    timing?: {
        start: number;
        end: number;
    } | undefined;
}, {
    text: string;
    position: {
        x: number | "center" | "left" | "right";
        y: number | "top" | "center" | "bottom";
    };
    style?: {
        opacity?: number | undefined;
        fontSize?: number | undefined;
        fontFamily?: string | undefined;
        color?: string | undefined;
        backgroundColor?: string | undefined;
        padding?: number | undefined;
    } | undefined;
    animation?: TextAnimationEnum | undefined;
    timing?: {
        start: number;
        end: number;
    } | undefined;
}>;
export declare const sceneInput: z.ZodEffects<z.ZodObject<{
    text: z.ZodString;
    searchTerms: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    media: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"pexels">;
        searchTerms: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "pexels";
        searchTerms: string[];
    }, {
        type: "pexels";
        searchTerms: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"url">;
        urls: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "url";
        urls: string[];
    }, {
        type: "url";
        urls: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"files">;
        files: z.ZodArray<z.ZodObject<{
            filename: z.ZodString;
            data: z.ZodUnknown;
            mimeType: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            mimeType: string;
            data?: unknown;
        }, {
            filename: string;
            mimeType: string;
            data?: unknown;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "files";
        files: {
            filename: string;
            mimeType: string;
            data?: unknown;
        }[];
    }, {
        type: "files";
        files: {
            filename: string;
            mimeType: string;
            data?: unknown;
        }[];
    }>]>>;
    effects: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"blend">;
        overlayUrl: z.ZodOptional<z.ZodString>;
        overlayFile: z.ZodOptional<z.ZodObject<{
            filename: z.ZodString;
            data: z.ZodUnknown;
            mimeType: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            mimeType: string;
            data?: unknown;
        }, {
            filename: string;
            mimeType: string;
            data?: unknown;
        }>>;
        staticEffectPath: z.ZodOptional<z.ZodString>;
        blendMode: z.ZodNativeEnum<typeof BlendModeEnum>;
        opacity: z.ZodDefault<z.ZodNumber>;
        duration: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"full">, z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            start: number;
            end: number;
        }, {
            start: number;
            end: number;
        }>]>>;
    }, "strip", z.ZodTypeAny, {
        type: "blend";
        blendMode: BlendModeEnum;
        opacity: number;
        overlayUrl?: string | undefined;
        overlayFile?: {
            filename: string;
            mimeType: string;
            data?: unknown;
        } | undefined;
        staticEffectPath?: string | undefined;
        duration?: "full" | {
            start: number;
            end: number;
        } | undefined;
    }, {
        type: "blend";
        blendMode: BlendModeEnum;
        overlayUrl?: string | undefined;
        overlayFile?: {
            filename: string;
            mimeType: string;
            data?: unknown;
        } | undefined;
        staticEffectPath?: string | undefined;
        opacity?: number | undefined;
        duration?: "full" | {
            start: number;
            end: number;
        } | undefined;
    }>, "many">>;
    textOverlays: z.ZodOptional<z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodUnion<[z.ZodLiteral<"left">, z.ZodLiteral<"center">, z.ZodLiteral<"right">, z.ZodNumber]>;
            y: z.ZodUnion<[z.ZodLiteral<"top">, z.ZodLiteral<"center">, z.ZodLiteral<"bottom">, z.ZodNumber]>;
        }, "strip", z.ZodTypeAny, {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        }, {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        }>;
        style: z.ZodOptional<z.ZodObject<{
            fontSize: z.ZodOptional<z.ZodNumber>;
            fontFamily: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            backgroundColor: z.ZodOptional<z.ZodString>;
            padding: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        }, {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        }>>;
        animation: z.ZodOptional<z.ZodNativeEnum<typeof TextAnimationEnum>>;
        timing: z.ZodOptional<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            start: number;
            end: number;
        }, {
            start: number;
            end: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        position: {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        };
        style?: {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        } | undefined;
        animation?: TextAnimationEnum | undefined;
        timing?: {
            start: number;
            end: number;
        } | undefined;
    }, {
        text: string;
        position: {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        };
        style?: {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        } | undefined;
        animation?: TextAnimationEnum | undefined;
        timing?: {
            start: number;
            end: number;
        } | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    text: string;
    searchTerms?: string[] | undefined;
    media?: {
        type: "pexels";
        searchTerms: string[];
    } | {
        type: "url";
        urls: string[];
    } | {
        type: "files";
        files: {
            filename: string;
            mimeType: string;
            data?: unknown;
        }[];
    } | undefined;
    effects?: {
        type: "blend";
        blendMode: BlendModeEnum;
        opacity: number;
        overlayUrl?: string | undefined;
        overlayFile?: {
            filename: string;
            mimeType: string;
            data?: unknown;
        } | undefined;
        staticEffectPath?: string | undefined;
        duration?: "full" | {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
    textOverlays?: {
        text: string;
        position: {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        };
        style?: {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        } | undefined;
        animation?: TextAnimationEnum | undefined;
        timing?: {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
}, {
    text: string;
    searchTerms?: string[] | undefined;
    media?: {
        type: "pexels";
        searchTerms: string[];
    } | {
        type: "url";
        urls: string[];
    } | {
        type: "files";
        files: {
            filename: string;
            mimeType: string;
            data?: unknown;
        }[];
    } | undefined;
    effects?: {
        type: "blend";
        blendMode: BlendModeEnum;
        overlayUrl?: string | undefined;
        overlayFile?: {
            filename: string;
            mimeType: string;
            data?: unknown;
        } | undefined;
        staticEffectPath?: string | undefined;
        opacity?: number | undefined;
        duration?: "full" | {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
    textOverlays?: {
        text: string;
        position: {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        };
        style?: {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        } | undefined;
        animation?: TextAnimationEnum | undefined;
        timing?: {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
}>, {
    text: string;
    searchTerms?: string[] | undefined;
    media?: {
        type: "pexels";
        searchTerms: string[];
    } | {
        type: "url";
        urls: string[];
    } | {
        type: "files";
        files: {
            filename: string;
            mimeType: string;
            data?: unknown;
        }[];
    } | undefined;
    effects?: {
        type: "blend";
        blendMode: BlendModeEnum;
        opacity: number;
        overlayUrl?: string | undefined;
        overlayFile?: {
            filename: string;
            mimeType: string;
            data?: unknown;
        } | undefined;
        staticEffectPath?: string | undefined;
        duration?: "full" | {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
    textOverlays?: {
        text: string;
        position: {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        };
        style?: {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        } | undefined;
        animation?: TextAnimationEnum | undefined;
        timing?: {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
}, {
    text: string;
    searchTerms?: string[] | undefined;
    media?: {
        type: "pexels";
        searchTerms: string[];
    } | {
        type: "url";
        urls: string[];
    } | {
        type: "files";
        files: {
            filename: string;
            mimeType: string;
            data?: unknown;
        }[];
    } | undefined;
    effects?: {
        type: "blend";
        blendMode: BlendModeEnum;
        overlayUrl?: string | undefined;
        overlayFile?: {
            filename: string;
            mimeType: string;
            data?: unknown;
        } | undefined;
        staticEffectPath?: string | undefined;
        opacity?: number | undefined;
        duration?: "full" | {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
    textOverlays?: {
        text: string;
        position: {
            x: number | "center" | "left" | "right";
            y: number | "top" | "center" | "bottom";
        };
        style?: {
            opacity?: number | undefined;
            fontSize?: number | undefined;
            fontFamily?: string | undefined;
            color?: string | undefined;
            backgroundColor?: string | undefined;
            padding?: number | undefined;
        } | undefined;
        animation?: TextAnimationEnum | undefined;
        timing?: {
            start: number;
            end: number;
        } | undefined;
    }[] | undefined;
}>;
export type SceneInput = z.infer<typeof sceneInput>;
export type MediaSource = z.infer<typeof mediaSourceSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type BlendEffect = z.infer<typeof blendEffectSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;
export declare enum VoiceEnum {
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
    bm_fable = "bm_fable"
}
export declare enum OrientationEnum {
    landscape = "landscape",
    portrait = "portrait"
}
export declare enum MusicVolumeEnum {
    muted = "muted",
    low = "low",
    medium = "medium",
    high = "high"
}
export declare const renderConfig: z.ZodObject<{
    paddingBack: z.ZodOptional<z.ZodNumber>;
    music: z.ZodOptional<z.ZodNativeEnum<typeof MusicMoodEnum>>;
    captionPosition: z.ZodOptional<z.ZodNativeEnum<typeof CaptionPositionEnum>>;
    captionBackgroundColor: z.ZodOptional<z.ZodString>;
    voice: z.ZodOptional<z.ZodNativeEnum<typeof VoiceEnum>>;
    orientation: z.ZodOptional<z.ZodNativeEnum<typeof OrientationEnum>>;
    musicVolume: z.ZodOptional<z.ZodNativeEnum<typeof MusicVolumeEnum>>;
}, "strip", z.ZodTypeAny, {
    paddingBack?: number | undefined;
    music?: MusicMoodEnum | undefined;
    captionPosition?: CaptionPositionEnum | undefined;
    captionBackgroundColor?: string | undefined;
    voice?: VoiceEnum | undefined;
    orientation?: OrientationEnum | undefined;
    musicVolume?: MusicVolumeEnum | undefined;
}, {
    paddingBack?: number | undefined;
    music?: MusicMoodEnum | undefined;
    captionPosition?: CaptionPositionEnum | undefined;
    captionBackgroundColor?: string | undefined;
    voice?: VoiceEnum | undefined;
    orientation?: OrientationEnum | undefined;
    musicVolume?: MusicVolumeEnum | undefined;
}>;
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
export declare const createShortInput: z.ZodObject<{
    scenes: z.ZodArray<z.ZodEffects<z.ZodObject<{
        text: z.ZodString;
        searchTerms: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        media: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"pexels">;
            searchTerms: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "pexels";
            searchTerms: string[];
        }, {
            type: "pexels";
            searchTerms: string[];
        }>, z.ZodObject<{
            type: z.ZodLiteral<"url">;
            urls: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "url";
            urls: string[];
        }, {
            type: "url";
            urls: string[];
        }>, z.ZodObject<{
            type: z.ZodLiteral<"files">;
            files: z.ZodArray<z.ZodObject<{
                filename: z.ZodString;
                data: z.ZodUnknown;
                mimeType: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                filename: string;
                mimeType: string;
                data?: unknown;
            }, {
                filename: string;
                mimeType: string;
                data?: unknown;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        }, {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        }>]>>;
        effects: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodLiteral<"blend">;
            overlayUrl: z.ZodOptional<z.ZodString>;
            overlayFile: z.ZodOptional<z.ZodObject<{
                filename: z.ZodString;
                data: z.ZodUnknown;
                mimeType: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                filename: string;
                mimeType: string;
                data?: unknown;
            }, {
                filename: string;
                mimeType: string;
                data?: unknown;
            }>>;
            staticEffectPath: z.ZodOptional<z.ZodString>;
            blendMode: z.ZodNativeEnum<typeof BlendModeEnum>;
            opacity: z.ZodDefault<z.ZodNumber>;
            duration: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"full">, z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                start: number;
                end: number;
            }, {
                start: number;
                end: number;
            }>]>>;
        }, "strip", z.ZodTypeAny, {
            type: "blend";
            blendMode: BlendModeEnum;
            opacity: number;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }, {
            type: "blend";
            blendMode: BlendModeEnum;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            opacity?: number | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }>, "many">>;
        textOverlays: z.ZodOptional<z.ZodArray<z.ZodObject<{
            text: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodUnion<[z.ZodLiteral<"left">, z.ZodLiteral<"center">, z.ZodLiteral<"right">, z.ZodNumber]>;
                y: z.ZodUnion<[z.ZodLiteral<"top">, z.ZodLiteral<"center">, z.ZodLiteral<"bottom">, z.ZodNumber]>;
            }, "strip", z.ZodTypeAny, {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            }, {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            }>;
            style: z.ZodOptional<z.ZodObject<{
                fontSize: z.ZodOptional<z.ZodNumber>;
                fontFamily: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                backgroundColor: z.ZodOptional<z.ZodString>;
                padding: z.ZodOptional<z.ZodNumber>;
                opacity: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            }, {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            }>>;
            animation: z.ZodOptional<z.ZodNativeEnum<typeof TextAnimationEnum>>;
            timing: z.ZodOptional<z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                start: number;
                end: number;
            }, {
                start: number;
                end: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }, {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        searchTerms?: string[] | undefined;
        media?: {
            type: "pexels";
            searchTerms: string[];
        } | {
            type: "url";
            urls: string[];
        } | {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        } | undefined;
        effects?: {
            type: "blend";
            blendMode: BlendModeEnum;
            opacity: number;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
        textOverlays?: {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
    }, {
        text: string;
        searchTerms?: string[] | undefined;
        media?: {
            type: "pexels";
            searchTerms: string[];
        } | {
            type: "url";
            urls: string[];
        } | {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        } | undefined;
        effects?: {
            type: "blend";
            blendMode: BlendModeEnum;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            opacity?: number | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
        textOverlays?: {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
    }>, {
        text: string;
        searchTerms?: string[] | undefined;
        media?: {
            type: "pexels";
            searchTerms: string[];
        } | {
            type: "url";
            urls: string[];
        } | {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        } | undefined;
        effects?: {
            type: "blend";
            blendMode: BlendModeEnum;
            opacity: number;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
        textOverlays?: {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
    }, {
        text: string;
        searchTerms?: string[] | undefined;
        media?: {
            type: "pexels";
            searchTerms: string[];
        } | {
            type: "url";
            urls: string[];
        } | {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        } | undefined;
        effects?: {
            type: "blend";
            blendMode: BlendModeEnum;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            opacity?: number | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
        textOverlays?: {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
    }>, "many">;
    config: z.ZodObject<{
        paddingBack: z.ZodOptional<z.ZodNumber>;
        music: z.ZodOptional<z.ZodNativeEnum<typeof MusicMoodEnum>>;
        captionPosition: z.ZodOptional<z.ZodNativeEnum<typeof CaptionPositionEnum>>;
        captionBackgroundColor: z.ZodOptional<z.ZodString>;
        voice: z.ZodOptional<z.ZodNativeEnum<typeof VoiceEnum>>;
        orientation: z.ZodOptional<z.ZodNativeEnum<typeof OrientationEnum>>;
        musicVolume: z.ZodOptional<z.ZodNativeEnum<typeof MusicVolumeEnum>>;
    }, "strip", z.ZodTypeAny, {
        paddingBack?: number | undefined;
        music?: MusicMoodEnum | undefined;
        captionPosition?: CaptionPositionEnum | undefined;
        captionBackgroundColor?: string | undefined;
        voice?: VoiceEnum | undefined;
        orientation?: OrientationEnum | undefined;
        musicVolume?: MusicVolumeEnum | undefined;
    }, {
        paddingBack?: number | undefined;
        music?: MusicMoodEnum | undefined;
        captionPosition?: CaptionPositionEnum | undefined;
        captionBackgroundColor?: string | undefined;
        voice?: VoiceEnum | undefined;
        orientation?: OrientationEnum | undefined;
        musicVolume?: MusicVolumeEnum | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    scenes: {
        text: string;
        searchTerms?: string[] | undefined;
        media?: {
            type: "pexels";
            searchTerms: string[];
        } | {
            type: "url";
            urls: string[];
        } | {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        } | undefined;
        effects?: {
            type: "blend";
            blendMode: BlendModeEnum;
            opacity: number;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
        textOverlays?: {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
    }[];
    config: {
        paddingBack?: number | undefined;
        music?: MusicMoodEnum | undefined;
        captionPosition?: CaptionPositionEnum | undefined;
        captionBackgroundColor?: string | undefined;
        voice?: VoiceEnum | undefined;
        orientation?: OrientationEnum | undefined;
        musicVolume?: MusicVolumeEnum | undefined;
    };
}, {
    scenes: {
        text: string;
        searchTerms?: string[] | undefined;
        media?: {
            type: "pexels";
            searchTerms: string[];
        } | {
            type: "url";
            urls: string[];
        } | {
            type: "files";
            files: {
                filename: string;
                mimeType: string;
                data?: unknown;
            }[];
        } | undefined;
        effects?: {
            type: "blend";
            blendMode: BlendModeEnum;
            overlayUrl?: string | undefined;
            overlayFile?: {
                filename: string;
                mimeType: string;
                data?: unknown;
            } | undefined;
            staticEffectPath?: string | undefined;
            opacity?: number | undefined;
            duration?: "full" | {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
        textOverlays?: {
            text: string;
            position: {
                x: number | "center" | "left" | "right";
                y: number | "top" | "center" | "bottom";
            };
            style?: {
                opacity?: number | undefined;
                fontSize?: number | undefined;
                fontFamily?: string | undefined;
                color?: string | undefined;
                backgroundColor?: string | undefined;
                padding?: number | undefined;
            } | undefined;
            animation?: TextAnimationEnum | undefined;
            timing?: {
                start: number;
                end: number;
            } | undefined;
        }[] | undefined;
    }[];
    config: {
        paddingBack?: number | undefined;
        music?: MusicMoodEnum | undefined;
        captionPosition?: CaptionPositionEnum | undefined;
        captionBackgroundColor?: string | undefined;
        voice?: VoiceEnum | undefined;
        orientation?: OrientationEnum | undefined;
        musicVolume?: MusicVolumeEnum | undefined;
    };
}>;
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
export type whisperModels = "tiny" | "tiny.en" | "base" | "base.en" | "small" | "small.en" | "medium" | "medium.en" | "large-v1" | "large-v2" | "large-v3" | "large-v3-turbo";
export {};
