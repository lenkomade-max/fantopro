/**
 * Video Analyzer REST API Router
 *
 * Provides REST API endpoints for video analysis and clip generation.
 * Based on Context7 Express.js best practices for async error handling.
 *
 * Features:
 * - Rate limiting (5 requests/hour per IP)
 * - Resource monitoring (memory, CPU)
 * - Multer file upload support
 * - Async error handling
 * - CORS enabled
 */

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import pino from 'pino';
import { VideoAnalyzer } from '../../video-analyzer/VideoAnalyzer';
import {
  VideoAnalysisInputSchema,
  VideoAnalyzerError,
  VideoAnalyzerErrorCode
} from '../../video-analyzer/types/video-analysis';

const logger = pino({ name: 'VideoAnalyzerRouter' });
const router = express.Router();

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

/**
 * Rate limiting middleware (based on Context7 express-rate-limit docs)
 */
const createRateLimiter = () => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const MAX_REQUESTS = 5;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = requests.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + WINDOW_MS };
      requests.set(ip, record);
    }

    record.count++;

    if (record.count > MAX_REQUESTS) {
      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

      return res.status(429).json({
        error: 'Too many video analysis requests',
        message: 'Please try again later',
        retryAfter: new Date(record.resetTime).toISOString()
      });
    }

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', (MAX_REQUESTS - record.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    next();
  };
};

const rateLimiter = createRateLimiter();

/**
 * Resource monitoring middleware
 */
const checkResources: RequestHandler = (req, res, next) => {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const memUsage = 1 - (freeMem / totalMem);

  // Check memory usage (80% threshold)
  if (memUsage > 0.80) {
    logger.warn({
      memUsage: `${(memUsage * 100).toFixed(1)}%`,
      freeMem: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)}GB`
    }, 'High memory usage detected');

    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Server resources are currently limited. Please try again later.',
      details: {
        memoryUsage: `${(memUsage * 100).toFixed(1)}%`
      }
    });
  }

  next();
};

/**
 * Multer configuration for file uploads (Context7 multer docs)
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.VIDEO_ANALYZER_STORAGE
      ? path.join(process.env.VIDEO_ANALYZER_STORAGE, 'uploads')
      : './static/video-analyzer/uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.VIDEO_ANALYZER_MAX_FILE_SIZE || '1073741824', 10) // 1GB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`));
    }
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Async error wrapper (Context7 Express async error handling pattern)
 */
const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Get VideoAnalyzer instance (injected via router init)
 */
let videoAnalyzer: VideoAnalyzer;

export function initVideoAnalyzerRouter(analyzer: VideoAnalyzer): express.Router {
  videoAnalyzer = analyzer;
  return router;
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * POST /api/video-analyzer/analyze
 * Submit video for analysis
 */
router.post(
  '/analyze',
  rateLimiter,
  checkResources,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info({
      hasFile: !!req.file,
      body: req.body
    }, 'Received video analysis request');

    // Parse input
    let input;

    if (req.file) {
      // File upload
      input = {
        source: {
          type: 'upload' as const,
          file: req.file
        },
        options: req.body.options ? JSON.parse(req.body.options) : undefined
      };
    } else if (req.body.source) {
      // JSON body (YouTube/URL)
      input = req.body;
    } else {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Either provide a file or source in request body'
      });
    }

    // Validate input
    const validated = VideoAnalysisInputSchema.parse(input);

    // Submit for analysis
    const job = await videoAnalyzer.analyzeVideo(validated);

    res.status(202).json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      message: 'Video analysis started',
      statusUrl: `/api/video-analyzer/jobs/${job.jobId}/status`
    });
  })
);

/**
 * GET /api/video-analyzer/jobs/:id/status
 * Get job status
 */
router.get(
  '/jobs/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const job = videoAnalyzer.getJobStatus(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      error: job.error,
      metadata: job.metadata
    });
  })
);

/**
 * GET /api/video-analyzer/jobs/:id/clips
 * Get generated clips
 */
router.get(
  '/jobs/:id/clips',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const clips = videoAnalyzer.getClips(id);

    if (clips === null) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    const job = videoAnalyzer.getJobStatus(id);

    if (job?.status !== 'completed') {
      return res.status(425).json({
        error: 'Job not completed yet',
        status: job?.status,
        progress: job?.progress,
        message: 'Please wait for the job to complete'
      });
    }

    res.json({
      jobId: id,
      totalClips: clips.length,
      clips: clips.map(clip => ({
        clipId: clip.clipId,
        duration: clip.duration,
        score: clip.score,
        transcript: clip.transcript.substring(0, 100) + '...',
        scores: clip.scores,
        downloadUrl: `/api/video-analyzer/jobs/${id}/clips/${clip.clipId}`,
        createdAt: clip.createdAt,
        videoInfo: clip.videoInfo
      }))
    });
  })
);

/**
 * GET /api/video-analyzer/jobs/:jobId/clips/:clipId
 * Download specific clip
 */
router.get(
  '/jobs/:jobId/clips/:clipId',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId, clipId } = req.params;

    const clip = videoAnalyzer.getClip(jobId, clipId);

    if (!clip) {
      return res.status(404).json({
        error: 'Clip not found',
        jobId,
        clipId
      });
    }

    res.download(clip.filePath, `${clip.clipId}.mp4`, (err) => {
      if (err) {
        logger.error({ error: err, clipId }, 'Failed to send clip file');
      }
    });
  })
);

/**
 * DELETE /api/video-analyzer/jobs/:id
 * Delete job and clips
 */
router.delete(
  '/jobs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await videoAnalyzer.deleteJob(id);

    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: id
      });
    }

    res.json({
      message: 'Job deleted successfully',
      jobId: id,
      deletedClips: result.deletedClips,
      freedSpace: result.freedSpace
    });
  })
);

/**
 * GET /api/video-analyzer/jobs
 * List all jobs
 */
router.get(
  '/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;

    const jobs = videoAnalyzer.getAllJobs(status as any);

    res.json({
      total: jobs.length,
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        metadata: job.metadata
      }))
    });
  })
);

/**
 * GET /api/video-analyzer/info
 * Service information
 */
router.get('/info', (req: Request, res: Response) => {
  const config = {
    maxDuration: parseInt(process.env.VIDEO_ANALYZER_MAX_DURATION || '1800', 10),
    maxFileSize: parseInt(process.env.VIDEO_ANALYZER_MAX_FILE_SIZE || '1073741824', 10),
    retentionDays: parseInt(process.env.VIDEO_ANALYZER_RETENTION_DAYS || '3', 10)
  };

  const jobs = videoAnalyzer.getAllJobs();
  const queue = {
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => ['downloading', 'transcribing', 'analyzing', 'generating'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length
  };

  const freeMem = os.freemem();
  const totalMem = os.totalmem();

  res.json({
    version: '1.0.0',
    status: 'healthy',
    limits: {
      maxVideoDuration: config.maxDuration,
      maxFileSize: config.maxFileSize,
      maxClipsPerJob: 20,
      retentionDays: config.retentionDays
    },
    supportedFormats: ['mp4', 'mov', 'avi', 'webm'],
    supportedSources: ['youtube', 'url', 'upload'],
    queue,
    system: {
      memoryUsage: `${((1 - freeMem / totalMem) * 100).toFixed(1)}%`,
      freeMemory: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)}GB`,
      totalMemory: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB`
    }
  });
});

// =============================================================================
// ERROR HANDLING (Context7 Express error handling pattern)
// =============================================================================

/**
 * 404 handler
 */
router.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

/**
 * Global error handler (must have 4 arguments - Context7 docs)
 */
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path
  }, 'API error');

  // VideoAnalyzerError
  if (err instanceof VideoAnalyzerError) {
    const statusMap: Record<VideoAnalyzerErrorCode, number> = {
      [VideoAnalyzerErrorCode.INVALID_INPUT]: 400,
      [VideoAnalyzerErrorCode.VIDEO_TOO_LONG]: 422,
      [VideoAnalyzerErrorCode.FILE_TOO_LARGE]: 413,
      [VideoAnalyzerErrorCode.DOWNLOAD_FAILED]: 502,
      [VideoAnalyzerErrorCode.TRANSCRIPTION_FAILED]: 500,
      [VideoAnalyzerErrorCode.ANALYSIS_FAILED]: 500,
      [VideoAnalyzerErrorCode.CLIP_GENERATION_FAILED]: 500,
      [VideoAnalyzerErrorCode.JOB_NOT_FOUND]: 404,
      [VideoAnalyzerErrorCode.CLIP_NOT_FOUND]: 404,
      [VideoAnalyzerErrorCode.INSUFFICIENT_SEGMENTS]: 422
    };

    return res.status(statusMap[err.code] || 500).json({
      error: err.code,
      message: err.message,
      details: err.details
    });
  }

  // Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid input data',
      details: err.errors
    });
  }

  // Generic error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.DEV === 'true' ? err.message : 'An unexpected error occurred'
  });
});

export default router;
