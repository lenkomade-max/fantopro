/**
 * Face API Detector - Local face detection using face-api.js + TensorFlow.js
 *
 * FREE solution: $0.00 cost, no API limits
 * Performance: 50-100ms per frame on CPU
 * Model: Tiny Face Detector (190KB, very fast)
 */

import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs-node';
import { readFile } from 'fs/promises';
import path from 'path';
import pino from 'pino';

const logger = pino({ name: 'FaceApiDetector' });

export class FaceApiDetector {
  private modelsLoaded: boolean = false;
  private modelsPath: string;

  constructor() {
    this.modelsPath = path.join(process.cwd(), 'static', 'face-api-models');
    logger.info({ modelsPath: this.modelsPath }, 'FaceApiDetector initialized');
  }

  /**
   * Load face-api.js models (call once on startup)
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) {
      logger.debug('Models already loaded');
      return;
    }

    try {
      logger.info('Loading Tiny Face Detector model...');

      // Load Tiny Face Detector (fastest, 190KB)
      await faceapi.nets.tinyFaceDetector.loadFromDisk(this.modelsPath);

      this.modelsLoaded = true;
      logger.info('✅ Face detection models loaded successfully');

    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to load face detection models');
      throw error;
    }
  }

  /**
   * Detect faces in a single image buffer
   * @param imageBuffer Image buffer (JPEG/PNG)
   * @returns Number of faces detected
   */
  async detectFaces(imageBuffer: Buffer): Promise<number> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }

    try {
      // Decode image to tensor
      const tensor = tf.node.decodeImage(imageBuffer, 3); // RGB channels

      // Detect faces using Tiny Face Detector
      const detections = await faceapi.detectAllFaces(
        tensor as any,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416, // Larger = more accurate but slower
          scoreThreshold: 0.5 // Confidence threshold
        })
      );

      // Cleanup tensor
      tensor.dispose();

      const faceCount = detections.length;
      logger.debug({ faceCount }, 'Face detection complete');

      return faceCount;

    } catch (error: any) {
      logger.warn({ error: error.message }, 'Face detection failed');
      return 0; // Fallback to 0 faces on error
    }
  }

  /**
   * Batch detect faces in multiple image buffers
   * @param imageBuffers Array of image buffers
   * @returns Array of face counts
   */
  async detectFacesBatch(imageBuffers: Buffer[]): Promise<number[]> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }

    logger.info({ count: imageBuffers.length }, 'Starting batch face detection');

    const results = await Promise.all(
      imageBuffers.map(buffer => this.detectFaces(buffer))
    );

    logger.info({ processed: results.length }, 'Batch face detection complete');

    return results;
  }

  /**
   * Convert face count to interest score (0-1)
   * @param faceCount Number of faces detected
   * @returns Interest score (0-1)
   */
  faceCountToScore(faceCount: number): number {
    // Scoring logic:
    // 0 faces = 0.3 (low interest)
    // 1-2 faces = 0.7 (medium interest)
    // 3+ faces = 1.0 (high interest)

    if (faceCount >= 3) {
      return 1.0;
    } else if (faceCount >= 1) {
      return 0.7;
    } else {
      return 0.3;
    }
  }
}

/**
 * Factory function to create FaceApiDetector
 */
export function createFaceApiDetector(): FaceApiDetector {
  return new FaceApiDetector();
}
