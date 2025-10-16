// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs

import { Config } from "@remotion/cli/config";

// Basic configuration
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPublicDir("static"); // Includes both music/ and effects/
Config.setEntryPoint("src/components/root/index.ts");

// Performance and rendering settings
Config.setChromiumOpenGlRenderer("egl");
Config.setChromiumDisableWebSecurity(true);
Config.setEnforceAudioTrack(false);

// Overlay-specific timeouts and performance settings
Config.setChromiumOpenGlRenderer("egl");
Config.setChromiumDisableWebSecurity(true);
Config.setEnforceAudioTrack(false);

// Default timeout settings for overlay rendering
Config.setConcurrency(1); // Reduced concurrency for stability
Config.setOffthreadVideoCacheSizeInBytes(100 * 1024 * 1024); // 100MB

// Export configuration for programmatic use
export const remotionConfig = {
  publicDir: "static",
  entryPoint: "src/components/root/index.ts",
  videoImageFormat: "jpeg" as const,
  overwriteOutput: true,
  chromiumOpenGlRenderer: "egl" as const,
  chromiumDisableWebSecurity: true,
  enforceAudioTrackPresence: false,
  concurrency: 1,
  offthreadVideoCacheSizeInBytes: 100 * 1024 * 1024,
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
