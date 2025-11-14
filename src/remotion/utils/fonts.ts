/**
 * Google Fonts Utility for Viral Content
 *
 * Collection of 20 modern, bold, high-impact fonts perfect for:
 * - TikTok viral videos
 * - Instagram Reels
 * - YouTube Shorts
 * - Crime documentaries
 * - Educational content
 *
 * All fonts are from Google Fonts (@remotion/google-fonts) and are
 * free for commercial use.
 */

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadRaleway } from "@remotion/google-fonts/Raleway";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadRubikMonoOne } from "@remotion/google-fonts/RubikMonoOne";
import { loadFont as loadRighteousFont } from "@remotion/google-fonts/Righteous";
import { loadFont as loadTeko } from "@remotion/google-fonts/Teko";
import { loadFont as loadRussoOne } from "@remotion/google-fonts/RussoOne";
import { loadFont as loadFredoka } from "@remotion/google-fonts/Fredoka";
import { loadFont as loadPatuaOne } from "@remotion/google-fonts/PatuaOne";
import { loadFont as loadKanit } from "@remotion/google-fonts/Kanit";
import { loadFont as loadBarlow } from "@remotion/google-fonts/Barlow";
import { loadFont as loadAlfaSlabOne } from "@remotion/google-fonts/AlfaSlabOne";
import { loadFont as loadFugazOne } from "@remotion/google-fonts/FugazOne";
import { loadFont as loadYellowTail } from "@remotion/google-fonts/Yellowtail";

/**
 * Font categories for easy selection
 */
export enum FontCategory {
  /** Clean, modern sans-serif fonts */
  MODERN_SANS = "modern_sans",
  /** Bold, impactful display fonts */
  BOLD_DISPLAY = "bold_display",
  /** Condensed, space-efficient fonts */
  CONDENSED = "condensed",
  /** Playful, attention-grabbing fonts */
  PLAYFUL = "playful",
  /** Script and handwriting fonts */
  SCRIPT = "script",
}

/**
 * Font metadata with usage recommendations
 */
interface FontInfo {
  name: string;
  fontFamily: string;
  category: FontCategory;
  description: string;
  bestFor: string[];
  loadFont: () => { fontFamily: string; fonts: any };
}

/**
 * Complete collection of 20 viral content fonts
 */
export const VIRAL_FONTS: Record<string, FontInfo> = {
  // MODERN SANS-SERIF (Clean & Professional)
  inter: {
    name: "Inter",
    fontFamily: "Inter",
    category: FontCategory.MODERN_SANS,
    description: "Clean, modern sans-serif with excellent readability",
    bestFor: ["subtitles", "body text", "professional content"],
    loadFont: loadInter,
  },
  montserrat: {
    name: "Montserrat",
    fontFamily: "Montserrat",
    category: FontCategory.MODERN_SANS,
    description: "Geometric sans-serif, perfect for headlines",
    bestFor: ["titles", "modern content", "tech videos"],
    loadFont: loadMontserrat,
  },
  roboto: {
    name: "Roboto",
    fontFamily: "Roboto",
    category: FontCategory.MODERN_SANS,
    description: "Google's flagship font, versatile and clean",
    bestFor: ["UI text", "general purpose", "clean design"],
    loadFont: loadRoboto,
  },
  poppins: {
    name: "Poppins",
    fontFamily: "Poppins",
    category: FontCategory.MODERN_SANS,
    description: "Friendly geometric sans, great for engagement",
    bestFor: ["social media", "friendly content", "modern design"],
    loadFont: loadPoppins,
  },
  raleway: {
    name: "Raleway",
    fontFamily: "Raleway",
    category: FontCategory.MODERN_SANS,
    description: "Elegant thin sans-serif with impact",
    bestFor: ["elegant titles", "fashion", "lifestyle"],
    loadFont: loadRaleway,
  },

  // BOLD DISPLAY (Maximum Impact)
  bebasNeue: {
    name: "Bebas Neue",
    fontFamily: "Bebas Neue",
    category: FontCategory.BOLD_DISPLAY,
    description: "Ultra-bold condensed display font, viral favorite",
    bestFor: ["crime docs", "bold statements", "viral titles"],
    loadFont: loadBebasNeue,
  },
  anton: {
    name: "Anton",
    fontFamily: "Anton",
    category: FontCategory.BOLD_DISPLAY,
    description: "Heavy impact font for maximum attention",
    bestFor: ["headlines", "attention-grabbing", "bold claims"],
    loadFont: loadAnton,
  },
  bangers: {
    name: "Bangers",
    fontFamily: "Bangers",
    category: FontCategory.BOLD_DISPLAY,
    description: "Comic-book style, fun and energetic",
    bestFor: ["fun content", "kids videos", "playful design"],
    loadFont: loadBangers,
  },
  russoOne: {
    name: "Russo One",
    fontFamily: "Russo One",
    category: FontCategory.BOLD_DISPLAY,
    description: "Bold geometric display with strong presence",
    bestFor: ["tech", "gaming", "bold headlines"],
    loadFont: loadRussoOne,
  },
  alfaSlabOne: {
    name: "Alfa Slab One",
    fontFamily: "Alfa Slab One",
    category: FontCategory.BOLD_DISPLAY,
    description: "Ultra-bold slab serif, impossible to ignore",
    bestFor: ["viral hooks", "dramatic reveals", "strong emphasis"],
    loadFont: loadAlfaSlabOne,
  },
  fugazOne: {
    name: "Fugaz One",
    fontFamily: "Fugaz One",
    category: FontCategory.BOLD_DISPLAY,
    description: "Bold rounded display, friendly but powerful",
    bestFor: ["bold statements", "friendly impact", "modern viral"],
    loadFont: loadFugazOne,
  },

  // CONDENSED (Space-Efficient)
  oswald: {
    name: "Oswald",
    fontFamily: "Oswald",
    category: FontCategory.CONDENSED,
    description: "Condensed sans-serif, great for tight spaces",
    bestFor: ["subtitles", "crime docs", "news style"],
    loadFont: loadOswald,
  },
  teko: {
    name: "Teko",
    fontFamily: "Teko",
    category: FontCategory.CONDENSED,
    description: "Ultra-condensed, modern and technical",
    bestFor: ["tech content", "data", "modern aesthetics"],
    loadFont: loadTeko,
  },
  barlow: {
    name: "Barlow Condensed",
    fontFamily: "Barlow",
    category: FontCategory.CONDENSED,
    description: "Condensed sans with excellent readability",
    bestFor: ["subtitles", "long text", "professional"],
    loadFont: loadBarlow,
  },

  // PLAYFUL (Attention-Grabbing)
  fredoka: {
    name: "Fredoka",
    fontFamily: "Fredoka",
    category: FontCategory.PLAYFUL,
    description: "Round, bold, friendly display font",
    bestFor: ["kids content", "fun videos", "playful design"],
    loadFont: loadFredoka,
  },
  patuaOne: {
    name: "Patua One",
    fontFamily: "Patua One",
    category: FontCategory.PLAYFUL,
    description: "Bold, quirky display font",
    bestFor: ["creative content", "unique style", "standout text"],
    loadFont: loadPatuaOne,
  },
  rubikMonoOne: {
    name: "Rubik Mono One",
    fontFamily: "Rubik Mono One",
    category: FontCategory.PLAYFUL,
    description: "Geometric display with strong personality",
    bestFor: ["logos", "brand text", "bold identity"],
    loadFont: loadRubikMonoOne,
  },
  righteous: {
    name: "Righteous",
    fontFamily: "Righteous",
    category: FontCategory.PLAYFUL,
    description: "Rounded geometric with retro vibe",
    bestFor: ["retro content", "gaming", "fun headlines"],
    loadFont: loadRighteousFont,
  },
  kanit: {
    name: "Kanit",
    fontFamily: "Kanit",
    category: FontCategory.PLAYFUL,
    description: "Modern Thai-inspired sans with looped terminals",
    bestFor: ["unique style", "modern viral", "distinctive text"],
    loadFont: loadKanit,
  },

  // SCRIPT (Elegant & Handwritten)
  yellowtail: {
    name: "Yellowtail",
    fontFamily: "Yellowtail",
    category: FontCategory.SCRIPT,
    description: "Elegant handwritten script",
    bestFor: ["elegant quotes", "lifestyle", "personal touch"],
    loadFont: loadYellowTail,
  },
};

/**
 * Get fonts by category
 */
export function getFontsByCategory(category: FontCategory): FontInfo[] {
  return Object.values(VIRAL_FONTS).filter((font) => font.category === category);
}

/**
 * Get recommended fonts for specific content types
 */
export function getRecommendedFonts(contentType: string): FontInfo[] {
  const recommendations: Record<string, string[]> = {
    crime: ["bebasNeue", "oswald", "anton", "montserrat"],
    viral: ["bebasNeue", "anton", "alfaSlabOne", "bangers"],
    educational: ["inter", "montserrat", "roboto", "poppins"],
    fun: ["bangers", "fredoka", "patuaOne", "righteous"],
    tech: ["inter", "roboto", "teko", "russoOne"],
    lifestyle: ["raleway", "yellowtail", "montserrat", "poppins"],
    news: ["oswald", "barlow", "roboto", "teko"],
  };

  const fontKeys = recommendations[contentType.toLowerCase()] || ["inter", "montserrat"];
  return fontKeys.map((key) => VIRAL_FONTS[key]).filter(Boolean);
}

/**
 * Load a specific font
 */
export function loadViralFont(fontKey: string): string {
  const fontInfo = VIRAL_FONTS[fontKey];
  if (!fontInfo) {
    console.warn(`Font "${fontKey}" not found, falling back to Inter`);
    return loadInter().fontFamily;
  }

  const { fontFamily } = fontInfo.loadFont();
  return fontFamily;
}

/**
 * Load multiple fonts at once
 */
export function loadViralFonts(fontKeys: string[]): Record<string, string> {
  const loadedFonts: Record<string, string> = {};

  fontKeys.forEach((key) => {
    const fontInfo = VIRAL_FONTS[key];
    if (fontInfo) {
      const { fontFamily } = fontInfo.loadFont();
      loadedFonts[key] = fontFamily;
    }
  });

  return loadedFonts;
}

/**
 * Get all available font names
 */
export function getAllFontNames(): string[] {
  return Object.keys(VIRAL_FONTS);
}

/**
 * Example usage for AdvancedTextOverlay:
 *
 * ```typescript
 * import { loadViralFont, VIRAL_FONTS } from "./utils/fonts";
 *
 * const bebasFont = loadViralFont("bebasNeue");
 * const interFont = loadViralFont("inter");
 *
 * // Use in AdvancedTextOverlay
 * {
 *   segments: [
 *     { text: "APARTMENT JANITOR INSTALLED SECRET CAMERAS IN ", style: { fontFamily: bebasFont, color: "#FFFFFF" } },
 *     { text: "200 UNITS", style: { fontFamily: bebasFont, color: "#FF0000", fontSize: 60 } },
 *     { text: " TO SPY ON RESIDENTS", style: { fontFamily: bebasFont, color: "#FF0000" } },
 *   ],
 *   ...
 * }
 * ```
 */
