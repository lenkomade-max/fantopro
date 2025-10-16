/**
 * Overlay Renderer Service
 * 
 * Service layer for overlay detection, routing, and error handling.
 * Determines when to use the overlay pipeline vs standard pipeline.
 */

import { logger } from "../../logger";
import type { Scene } from "../../types/shorts";
import { EffectManager, type ProcessedEffect } from "../../short-creator/effects/EffectManager";

export interface OverlayDetectionResult {
  hasOverlays: boolean;
  overlayCount: number;
  effects: ProcessedEffect[];
  recommendedRenderer: "standard" | "overlay";
  reason: string;
}

export interface OverlayRenderOptions {
  perOverlayTimeout?: number;
  totalTimeout?: number;
  enableFallback?: boolean;
  maxConcurrentOverlays?: number;
}

/**
 * Service for detecting and routing overlay rendering
 */
export class OverlayRenderer {
  private effectManager: EffectManager;
  private defaultOptions: OverlayRenderOptions = {
    perOverlayTimeout: 15000, // 15 seconds per overlay
    totalTimeout: 120000, // 120 seconds total
    enableFallback: true,
    maxConcurrentOverlays: 10,
  };

  constructor(effectManager: EffectManager, options: Partial<OverlayRenderOptions> = {}) {
    this.effectManager = effectManager;
    this.defaultOptions = { ...this.defaultOptions, ...options };
    logger.info("Overlay effects active (local build)");
  }

  /**
   * Detect if scenes contain overlays and recommend renderer
   */
  async detectOverlays(scenes: Scene[]): Promise<OverlayDetectionResult> {
    let totalOverlayCount = 0;
    let allEffects: ProcessedEffect[] = [];
    let hasComplexOverlays = false;
    let hasTimedOverlays = false;

    for (const scene of scenes) {
      if ((scene as any).effects && (scene as any).effects.length > 0) {
        const sceneEffects = (scene as any).effects;
        totalOverlayCount += sceneEffects.length;
        allEffects.push(...sceneEffects);

        // Check for complex overlay scenarios
        for (const effect of sceneEffects) {
          if (effect.type === "blend") {
            // Check for timed overlays (not full duration)
            if (effect.duration && effect.duration !== "full") {
              hasTimedOverlays = true;
            }
            
            // Check for multiple blend modes
            if (effect.blendMode !== "normal") {
              hasComplexOverlays = true;
            }
          }
        }
      }
    }

    const hasOverlays = totalOverlayCount > 0;
    let recommendedRenderer: "standard" | "overlay" = "standard";
    let reason = "";

    // Determine renderer recommendation
    if (!hasOverlays) {
      recommendedRenderer = "standard";
      reason = "No overlays detected";
    } else if (totalOverlayCount > 3) {
      recommendedRenderer = "overlay";
      reason = `Multiple overlays detected (${totalOverlayCount}), using overlay pipeline for stability`;
    } else if (hasTimedOverlays) {
      recommendedRenderer = "overlay";
      reason = "Timed overlays detected, using overlay pipeline for precise timing";
    } else if (hasComplexOverlays) {
      recommendedRenderer = "overlay";
      reason = "Complex blend modes detected, using overlay pipeline for better handling";
    } else {
      recommendedRenderer = "standard";
      reason = "Simple overlays detected, standard pipeline sufficient";
    }

    // Check if overlay count exceeds maximum
    if (totalOverlayCount > this.defaultOptions.maxConcurrentOverlays!) {
      logger.warn(
        { overlayCount: totalOverlayCount, maxAllowed: this.defaultOptions.maxConcurrentOverlays },
        "Overlay count exceeds recommended maximum"
      );
    }

    logger.debug(
      {
        hasOverlays,
        overlayCount: totalOverlayCount,
        recommendedRenderer,
        reason,
        hasTimedOverlays,
        hasComplexOverlays,
      },
      "Overlay detection complete"
    );

    return {
      hasOverlays,
      overlayCount: totalOverlayCount,
      effects: allEffects,
      recommendedRenderer,
      reason,
    };
  }

  /**
   * Process effects for overlay rendering
   */
  async processEffects(scenes: Scene[]): Promise<ProcessedEffect[]> {
    const allEffects: ProcessedEffect[] = [];

    for (const scene of scenes) {
      if ((scene as any).effects && (scene as any).effects.length > 0) {
        try {
          const processedEffects = await this.effectManager.processEffects((scene as any).effects);
          allEffects.push(...processedEffects);
        } catch (error) {
          logger.error({ error, sceneIndex: scenes.indexOf(scene) }, "Failed to process scene effects");
          throw error;
        }
      }
    }

    return allEffects;
  }

  /**
   * Validate overlay configuration
   */
  validateOverlayConfig(effects: ProcessedEffect[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!effects || effects.length === 0) {
      return { isValid: true, errors: [] };
    }

    // Check overlay count
    if (effects.length > this.defaultOptions.maxConcurrentOverlays!) {
      errors.push(`Too many overlays (${effects.length}). Maximum supported: ${this.defaultOptions.maxConcurrentOverlays}`);
    }

    // Check each effect
    effects.forEach((effect, index) => {
      if (!effect.staticEffectPath) {
        errors.push(`Overlay ${index}: Missing staticEffectPath`);
      }

      if (effect.opacity < 0 || effect.opacity > 1) {
        errors.push(`Overlay ${index}: Invalid opacity (${effect.opacity}). Must be between 0 and 1`);
      }

      if (effect.duration && effect.duration !== "full") {
        if (effect.duration.start < 0) {
          errors.push(`Overlay ${index}: Invalid start time (${effect.duration.start}). Must be >= 0`);
        }
        if (effect.duration.end <= effect.duration.start) {
          errors.push(`Overlay ${index}: Invalid end time (${effect.duration.end}). Must be > start time`);
        }
      }
    });

    const isValid = errors.length === 0;
    
    if (!isValid) {
      logger.warn({ errors, effectCount: effects.length }, "Overlay validation failed");
    }

    return { isValid, errors };
  }

  /**
   * Get render options based on overlay count
   */
  getRenderOptions(overlayCount: number): OverlayRenderOptions {
    const options = { ...this.defaultOptions };

    // Adjust timeouts based on overlay count
    if (overlayCount > 5) {
      options.totalTimeout = Math.min(180000, options.totalTimeout! + overlayCount * 5000);
      options.perOverlayTimeout = Math.max(10000, options.perOverlayTimeout! - 1000);
    }

    logger.debug(
      { overlayCount, options },
      "Calculated overlay render options"
    );

    return options;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.effectManager.cleanup();
      logger.debug("Overlay renderer cleanup complete");
    } catch (error) {
      logger.warn({ error }, "Failed to cleanup overlay renderer");
    }
  }

  /**
   * Get overlay statistics
   */
  getOverlayStats(scenes: Scene[]): {
    totalScenes: number;
    scenesWithOverlays: number;
    totalOverlays: number;
    averageOverlaysPerScene: number;
    blendModes: Record<string, number>;
  } {
    let scenesWithOverlays = 0;
    let totalOverlays = 0;
    const blendModes: Record<string, number> = {};

    scenes.forEach((scene) => {
      if ((scene as any).effects && (scene as any).effects.length > 0) {
        const sceneEffects = (scene as any).effects;
        scenesWithOverlays++;
        totalOverlays += sceneEffects.length;

        sceneEffects.forEach((effect: any) => {
          if (effect.type === "blend") {
            const mode = effect.blendMode || "normal";
            blendModes[mode] = (blendModes[mode] || 0) + 1;
          }
        });
      }
    });

    return {
      totalScenes: scenes.length,
      scenesWithOverlays,
      totalOverlays,
      averageOverlaysPerScene: scenesWithOverlays > 0 ? totalOverlays / scenesWithOverlays : 0,
      blendModes,
    };
  }
}