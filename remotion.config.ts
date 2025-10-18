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
Config.setConcurrency(2); // Optimized for 3 CPU cores
Config.setOffthreadVideoCacheSizeInBytes(150 * 1024 * 1024); // 150MB - increased for better performance

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
  offthreadVideoCacheSizeInBytes: 150 * 1024 * 1024,
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
  offthreadVideoCacheSizeInBytes: 150 * 1024 * 1024, // 100MB
  timeoutInMilliseconds: overlayTimeouts.totalRender,
};

// Webpack override: provide browser fallback for Node core modules used indirectly in the bundle
// Fixes: "Module not found: Error: Can't resolve 'path'" during Remotion bundling
Config.overrideWebpackConfig((currentConfiguration) => {
  // Ensure objects exist
  currentConfiguration.resolve = currentConfiguration.resolve || {};
  // Keep existing fallbacks, then add/override Node.js polyfills
  currentConfiguration.resolve.fallback = {
    ...(currentConfiguration.resolve.fallback || {}),
    path: require.resolve("path-browserify"),
    os: require.resolve("os-browserify/browser"),
    crypto: require.resolve("crypto-browserify"),
    https: require.resolve("https-browserify"),
    http: require.resolve("stream-http"),
    stream: require.resolve("stream-http"),
    fs: false,              // Exclude fs from browser bundle
    'graceful-fs': false,   // Exclude graceful-fs from browser bundle
  };

  return currentConfiguration;
});
