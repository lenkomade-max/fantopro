/**
 * Content Source Factory
 * 
 * Factory pattern implementation for creating content source instances.
 * Supports backward compatibility with legacy searchTerms format.
 */

import { Config } from "../../../config";
import { PexelsAPI } from "../Pexels";
import { logger } from "../../../logger";
import {
  ContentSourceConfig,
  IContentSource,
} from "./types";
import { PexelsSource } from "./PexelsSource";
import { UrlSource } from "./UrlSource";
import { FileSource } from "./FileSource";

export class ContentSourceFactory {
  constructor(
    private config: Config,
    private pexelsApi: PexelsAPI,
  ) {}

  /**
   * Create a content source instance based on configuration
   * 
   * @param sourceConfig - Content source configuration
   * @returns Content source instance
   */
  create(sourceConfig: ContentSourceConfig): IContentSource {
    logger.debug({ sourceConfig }, "Creating content source");

    switch (sourceConfig.type) {
      case "pexels":
        return new PexelsSource(this.pexelsApi, sourceConfig.searchTerms);

      case "url":
        return new UrlSource(this.config, sourceConfig.urls);

      case "files":
        return new FileSource(this.config, sourceConfig.files);

      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = sourceConfig;
        throw new Error(`Unknown content source type: ${_exhaustive}`);
    }
  }

  /**
   * Create content source from legacy searchTerms format (backward compatibility)
   * 
   * @param searchTerms - Array of search terms for Pexels
   * @returns Pexels content source instance
   */
  createFromLegacySearchTerms(searchTerms: string[]): IContentSource {
    logger.debug({ searchTerms }, "Creating Pexels source from legacy format");
    return new PexelsSource(this.pexelsApi, searchTerms);
  }
}

