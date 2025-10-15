/**
 * Content Source Types
 * 
 * This module defines the abstraction layer for different media content sources.
 * Supports: Pexels API, URL downloads, and direct file uploads.
 */

import { OrientationEnum } from "../../../types/shorts";

/**
 * Media file information returned by content sources
 */
export interface MediaFile {
  /** Local file path after download/processing */
  localPath: string;
  /** Original filename */
  filename: string;
  /** MIME type (e.g., video/mp4, image/jpeg) */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Whether this is a video (false = image) */
  isVideo: boolean;
}

/**
 * Configuration for Pexels content source
 */
export interface PexelsSourceConfig {
  type: "pexels";
  searchTerms: string[];
}

/**
 * Configuration for URL content source
 */
export interface UrlSourceConfig {
  type: "url";
  urls: string[];
}

/**
 * Direct file upload configuration
 */
export interface FileUpload {
  filename: string;
  /** Base64 encoded data or Buffer (required at runtime, but typed as optional for Zod compat) */
  data?: unknown; // Using unknown to avoid Buffer reference in browser environments
  mimeType: string;
}

/**
 * Configuration for direct files content source
 */
export interface FileSourceConfig {
  type: "files";
  files: FileUpload[];
}

/**
 * Union type of all content source configurations
 */
export type ContentSourceConfig =
  | PexelsSourceConfig
  | UrlSourceConfig
  | FileSourceConfig;

/**
 * Parameters for getting media content
 */
export interface GetMediaParams {
  /** Required video duration in seconds */
  duration: number;
  /** Video orientation */
  orientation: OrientationEnum;
  /** IDs to exclude (for Pexels) */
  excludeIds?: string[];
}

/**
 * Interface that all content sources must implement
 */
export interface IContentSource {
  /**
   * Get media files for the scene
   * @param params - Parameters for media selection
   * @returns Array of media files (local paths)
   */
  getMedia(params: GetMediaParams): Promise<MediaFile[]>;

  /**
   * Cleanup temporary files if needed
   */
  cleanup?(): Promise<void>;
}

