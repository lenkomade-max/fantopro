/**
 * Overlay Remotion Configuration
 * 
 * Separate configuration for overlay rendering that fixes the public directory issue.
 * This config ensures both music/ and effects/ directories are accessible to Remotion.
 */

import { Config } from "@remotion/cli/config";

// Configure overlay-specific rendering settings
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPublicDir("static"); // Includes both music/ and effects/
Config.setEntryPoint("src/components/root/index.ts");

// Overlay-specific timeouts and performance settings
Config.setChromiumOpenGlRenderer("egl");
Config.setChromiumDisableWebSecurity(true);
Config.setEnforceAudioTrack(false);

// Export configuration for programmatic use
export const overlayConfig = {
  publicDir: "static",
  entryPoint: "src/components/root/index.ts",
  videoImageFormat: "jpeg" as const,
  overwriteOutput: true,
  chromiumOpenGlRenderer: "egl" as const,
  chromiumDisableWebSecurity: true,
  enforceAudioTrackPresence: false,
};

// Default timeout settings for overlay rendering
export const overlayTimeouts = {
  perOverlay: 15000, // 15 seconds per overlay
  totalRender: 120000, // 120 seconds total render timeout
  metadataLoad: 20000, // 20 seconds for metadata loading
};

// Default overlay rendering settings
export const overlayRenderSettings = {
  concurrency: 1, // Reduced concurrency for stability
  offthreadVideoCacheSizeInBytes: 100 * 1024 * 1024, // 100MB
  timeoutInMilliseconds: overlayTimeouts.totalRender,
};