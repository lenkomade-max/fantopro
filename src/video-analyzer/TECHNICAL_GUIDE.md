# VideoAnalyzer Technical Guide

Техническая документация для разработчиков VideoAnalyzer модуля.

## 📐 Архитектура

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     REST API Layer                           │
│  POST /api/video-analyzer/analyze                           │
│  GET  /api/video-analyzer/jobs/:id/status                   │
│  GET  /api/video-analyzer/info                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   VideoAnalyzer                              │
│  Main Orchestrator - Job Queue & Lifecycle Management       │
└─┬───────────────────────────────────────────────────────────┘
  │
  ├─► YouTubeDownloader ────► yt-dlp binary
  │
  ├─► VideoProcessor ────► FFmpeg (audio extract, metadata)
  │
  ├─► Whisper ────► whisper.cpp (transcription)
  │
  ├─► Analyzers
  │   ├─► TextAnalyzer (keywords, action verbs)
  │   ├─► AudioAnalyzer (placeholder)
  │   └─► VisualAnalyzer (scene detection - MVP)
  │
  ├─► ClipGenerator ────► FFmpeg (clip extraction)
  │
  └─► VideoEnhancer ────► OpenRouter API (future)
```

### Data Flow

```
User Request
    │
    ▼
[Create Job] → pending (0%)
    │
    ▼
[Download Video] → downloading (10%)
    │ yt-dlp + cookies
    ▼
[Extract Audio] → transcribing (15%)
    │ FFmpeg: mp4 → wav (16kHz, mono, pcm_s16le)
    ▼
[Transcribe] → transcribing (20-50%)
    │ Whisper C++: wav → Caption[] with timestamps
    ▼
[Analyze Segments] → analyzing (50-70%)
    │ Text: keywords, action verbs
    │ Audio: (placeholder)
    │ Visual: scene changes
    │ Score: weighted sum (0-1)
    ▼
[Generate Clips] → generating_clips (70-90%)
    │ Sort by score
    │ Select top N
    │ FFmpeg: extract segments
    │ Orient: portrait (1080x1920) or landscape
    ▼
[Enhance Clips] → enhancing (90-100%) [optional]
    │ AI narrative generation
    │ Subtitle rendering
    │ TTS voice-over
    ▼
[Complete] → completed (100%)
    │
    ▼
[Cleanup Task] → delete after 7 days
```

## 🧩 Core Components

### 1. VideoAnalyzer

**File**: `src/video-analyzer/VideoAnalyzer.ts`

**Responsibilities**:
- Job lifecycle management
- Queue processing (sequential)
- Progress tracking
- Error handling
- File cleanup

**Key Methods**:

```typescript
class VideoAnalyzer {
  // Public API
  async analyze(input: VideoAnalysisInput): Promise<AnalysisJob>
  async getJobStatus(jobId: string): Promise<AnalysisJob | null>
  async getInfo(): Promise<SystemInfo>

  // Internal Pipeline
  private async processJob(job: AnalysisJob): Promise<void>
  private async downloadVideo(url: string, jobId: string): Promise<string>
  private async extractAudio(videoPath: string, jobId: string): Promise<string>
  private async transcribeAudio(audioPath: string): Promise<TranscriptResult>
  private async analyzeSegments(transcript: TranscriptResult, videoPath: string): Promise<AnalyzedSegment[]>
  private async generateClips(segments: AnalyzedSegment[], videoPath: string, options: VideoAnalysisOptions): Promise<GeneratedClip[]>
  private async enhanceClips(clips: GeneratedClip[], options: VideoAnalysisOptions): Promise<EnhancedClip[]>
}
```

**Job State Machine**:

```typescript
type JobStatus =
  | 'pending'           // 0%  - Queued
  | 'downloading'       // 10% - Fetching video
  | 'transcribing'      // 20% - Whisper processing
  | 'analyzing'         // 50% - Segment scoring
  | 'generating_clips'  // 70% - Clip extraction
  | 'enhancing'         // 90% - AI enhancement
  | 'completed'         // 100% - Done
  | 'failed';           // Error occurred
```

### 2. YouTubeDownloader

**File**: `src/video-analyzer/youtube/YouTubeDownloader.ts`

**Purpose**: Download videos from YouTube and 1000+ platforms using yt-dlp.

**Critical Implementation Details**:

```typescript
class YouTubeDownloader {
  private buildDownloadOptions(outputTemplate: string): string[] {
    const options = [
      // Format: best MP4 video + audio
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',

      // Output template with job ID
      '-o', outputTemplate,  // e.g., "storage/uploads/{jobId}.%(ext)s"

      // Limits
      '--max-filesize', '2G',
      '--no-playlist',

      // Reliability
      '--extractor-retries', '3',
      '--retries', '5',
      '--no-abort-on-error',

      // Progress
      '--progress',
      '--no-warnings'
    ];

    // Add cookies if provided (CRITICAL for YouTube bot bypass)
    if (this.cookiesFile && existsSync(this.cookiesFile)) {
      options.push('--cookies', this.cookiesFile);
    }

    return options;
  }

  async download(url: string, jobId: string): Promise<string> {
    const options = this.buildDownloadOptions(outputTemplate);

    // CRITICAL: Add URL as last argument
    options.push(url);  // yt-dlp syntax: yt-dlp [OPTIONS] URL

    await this.ytdlp.execPromise(options);

    // Find downloaded file (extension may vary)
    return await this.findDownloadedFile(jobId);
  }
}
```

**Cookies Format** (Netscape):
```
# Netscape HTTP Cookie File
# domain  flag  path  secure  expiration  name  value
.youtube.com  TRUE  /  TRUE  1795104435  __Secure-1PSID  g.a000...
.youtube.com  TRUE  /  TRUE  1795104435  SAPISID  irVF0u...
```

### 3. VideoProcessor

**File**: `src/video-analyzer/processors/VideoProcessor.ts`

**Purpose**: FFmpeg-based video/audio processing.

**Critical Audio Extraction**:

```typescript
async extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      // CRITICAL: Whisper requires exactly these settings
      .audioCodec('pcm_s16le')   // WAV format with 16-bit PCM
      .audioChannels(1)           // Mono (better for speech)
      .audioFrequency(16000)      // 16kHz sample rate (required!)
      .output(outputPath)         // Must end with .wav
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error))
      .run();
  });
}
```

**Why These Settings?**

| Setting | Value | Reason |
|---------|-------|--------|
| Codec | pcm_s16le | Whisper requires PCM WAV |
| Channels | 1 (mono) | Speech transcription works better with mono |
| Frequency | 16000 Hz | Whisper model trained on 16kHz audio |
| Container | .wav | Only WAV format supported by whisper.cpp |

**Wrong Settings (DO NOT USE)**:
```typescript
// ❌ WRONG - Whisper will fail
.audioCodec('libmp3lame')  // MP3 not supported
.audioFrequency(44100)     // Wrong sample rate
.audioChannels(2)          // Stereo unnecessary for speech
```

### 4. Whisper Integration

**File**: `src/video-analyzer/VideoAnalyzer.ts:441-463`

**Critical Path Resolution**:

```typescript
private async transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  // CRITICAL: Whisper binary needs absolute path
  // Relative paths fail because whisper.cpp changes working directory
  const absoluteAudioPath = path.resolve(audioPath);

  // Use FantaProjekt's Whisper.CreateCaption
  const captions = await this.whisper.CreateCaption(absoluteAudioPath);

  // Convert Caption[] to TranscriptResult
  const fullText = captions.map(c => c.text).join('');
  const segments = captions.map((caption, index) => ({
    id: index,
    text: caption.text,
    start: caption.startMs / 1000,
    end: caption.endMs / 1000
  }));

  return {
    text: fullText,
    language: 'ru',  // Auto-detected
    duration: segments[segments.length - 1]?.end || 0,
    segments
  };
}
```

**Why Absolute Paths?**

Whisper C++ binary is executed via child_process:
```bash
/root/.ai-agents-az-video-generator/libs/whisper/main \
  -f /absolute/path/to/file.wav \    # ✅ Works
  -m /path/to/model.bin

# ❌ Fails with relative path:
# error: input file not found 'relative/path/file.wav'
```

### 5. Content Analysis

**File**: `src/video-analyzer/analyzers/`

#### TextAnalyzer

**Keywords Extraction**:
```typescript
private keywords = [
  'важно', 'срочно', 'внимание', 'эксклюзив', 'впервые',
  'шокирующий', 'невероятно', 'сенсация', 'breaking', ...
];

analyzeText(text: string): number {
  const lowerText = text.toLowerCase();
  const matchCount = this.keywords.filter(k => lowerText.includes(k)).length;
  return Math.min(matchCount / this.keywords.length, 1.0);
}
```

**Action Verbs Detection**:
```typescript
private actionVerbs = [
  'смотреть', 'видеть', 'слушать', 'понять', 'узнать',
  'открыть', 'найти', 'получить', 'watch', 'see', ...
];

hasActionVerb(text: string): boolean {
  const lowerText = text.toLowerCase();
  return this.actionVerbs.some(verb => lowerText.includes(verb));
}
```

#### AudioAnalyzer

**Status**: Placeholder (future implementation)

Planned features:
- Volume level detection
- Silence detection
- Music vs speech classification
- Emotional tone analysis

#### VisualAnalyzer

**Status**: MVP mode (basic scene detection)

```typescript
class VisualAnalyzer {
  private sceneThreshold = 0.4;  // Scene change sensitivity

  async analyzeVisual(videoPath: string, segments: AnalyzedSegment[]): Promise<void> {
    // MVP: Simple scene detection via ffmpeg
    // Future: Frame-by-frame analysis, object detection, face detection

    for (const segment of segments) {
      // Check if segment has scene changes
      const hasSceneChange = await this.detectSceneChange(
        videoPath,
        segment.start,
        segment.end
      );

      segment.visualScore = hasSceneChange ? 0.8 : 0.3;
    }
  }
}
```

### 6. Segment Scoring

**Algorithm**:

```typescript
function calculateSegmentScore(segment: AnalyzedSegment): number {
  const weights = {
    text: 0.4,    // Text analysis weight
    audio: 0.3,   // Audio analysis weight
    visual: 0.3   // Visual analysis weight
  };

  const score =
    segment.textScore * weights.text +
    segment.audioScore * weights.audio +
    segment.visualScore * weights.visual;

  return Math.min(Math.max(score, 0), 1);  // Clamp to [0, 1]
}
```

**Example Scores**:

| Segment | Text | Audio | Visual | Final Score |
|---------|------|-------|--------|-------------|
| Intro | 0.2 | 0.1 | 0.3 | **0.19** (skip) |
| Action scene | 0.7 | 0.8 | 0.9 | **0.78** (✓ include) |
| Dialogue | 0.5 | 0.6 | 0.4 | **0.51** (✓ include) |
| Credits | 0.1 | 0.0 | 0.1 | **0.07** (skip) |

### 7. Clip Generation

**File**: `src/video-analyzer/processors/ClipGenerator.ts`

**Clip Selection Logic**:

```typescript
async generateClips(
  segments: AnalyzedSegment[],
  videoPath: string,
  options: VideoAnalysisOptions
): Promise<GeneratedClip[]> {
  // 1. Filter by minimum score
  const goodSegments = segments
    .filter(s => s.score >= options.minScore)  // e.g., 0.6
    .sort((a, b) => b.score - a.score);        // Best first

  // 2. Select top N segments
  const topSegments = goodSegments.slice(0, options.clipCount);  // e.g., 3

  // 3. Extract clips via FFmpeg
  const clips: GeneratedClip[] = [];

  for (const segment of topSegments) {
    const clipPath = await this.extractClip(
      videoPath,
      segment.start,
      segment.end,
      options.orientation  // 'portrait' or 'landscape'
    );

    clips.push({
      clipId: randomUUID(),
      startTime: segment.start,
      endTime: segment.end,
      duration: segment.end - segment.start,
      score: segment.score,
      path: clipPath,
      orientation: options.orientation
    });
  }

  return clips;
}
```

**FFmpeg Clip Extraction**:

```typescript
async extractClip(
  videoPath: string,
  start: number,
  end: number,
  orientation: 'portrait' | 'landscape'
): Promise<string> {
  const duration = end - start;
  const dimensions = orientation === 'portrait'
    ? { width: 1080, height: 1920 }   // 9:16 (TikTok/Reels)
    : { width: 1920, height: 1080 };  // 16:9 (YouTube)

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(start)
      .duration(duration)
      .size(`${dimensions.width}x${dimensions.height}`)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset medium',
        '-crf 23',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

## 🔧 Configuration

### Environment Variables

```bash
# VideoAnalyzer Module
VIDEO_ANALYZER_ENABLED=true                          # Enable module
VIDEO_ANALYZER_MAX_DURATION=7200                     # 2 hours max
VIDEO_ANALYZER_MAX_FILE_SIZE=1073741824              # 1GB max
VIDEO_ANALYZER_STORAGE=./static/video-analyzer       # Storage directory
VIDEO_ANALYZER_RETENTION_DAYS=7                      # Auto-cleanup after 7 days

# YouTube Cookies
YOUTUBE_COOKIES_FILE=/path/to/youtube-cookies.txt    # Netscape format

# AI Enhancement (optional)
VIDEO_ANALYZER_ENHANCEMENT_ENABLED=true
OPENROUTER_API_KEY=sk-or-v1-...
AI_COST_STRATEGY=budget                              # budget|balanced|premium
AI_VISION_PRIMARY=qwen/qwen-2-vl-72b:free           # Vision model
AI_NARRATIVE_PRIMARY=anthropic/claude-3.7-sonnet     # Narrative model
AI_UTILITY_PRIMARY=meta-llama/llama-3.3-70b-instruct:free
```

### Runtime Configuration

```typescript
const config: VideoAnalyzerConfig = {
  enabled: process.env.VIDEO_ANALYZER_ENABLED === 'true',
  maxDuration: parseInt(process.env.VIDEO_ANALYZER_MAX_DURATION || '7200'),
  maxFileSize: parseInt(process.env.VIDEO_ANALYZER_MAX_FILE_SIZE || '1073741824'),
  storageDir: process.env.VIDEO_ANALYZER_STORAGE || './static/video-analyzer',
  retentionDays: parseInt(process.env.VIDEO_ANALYZER_RETENTION_DAYS || '7'),

  analyzerWeights: {
    text: 0.4,
    audio: 0.3,
    visual: 0.3
  },

  processing: {
    maxConcurrentClips: 3,
    ffmpegPreset: 'medium',
    outputCrf: 23,
    audioBitrate: '128k'
  }
};
```

## 🐛 Debugging

### Enable Debug Logging

```typescript
// Set in .env
LOG_LEVEL=debug

// Or programmatically
const logger = pino({ level: 'debug', name: 'VideoAnalyzer' });
```

### Common Debug Points

**1. Check yt-dlp command**:
```typescript
logger.debug({ options, url }, 'yt-dlp options');
// Output: Full command line that will be executed
```

**2. Verify audio file**:
```bash
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels \
  static/video-analyzer/processing/job-id.wav

# Expected output:
# codec_name=pcm_s16le
# sample_rate=16000
# channels=1
```

**3. Test Whisper manually**:
```bash
/root/.ai-agents-az-video-generator/libs/whisper/main \
  -f /absolute/path/to/audio.wav \
  -m /root/.ai-agents-az-video-generator/libs/whisper/models/ggml-tiny.en.bin \
  -oj
```

**4. Monitor job status**:
```bash
# Create monitor script
./monitor-job.sh JOB_ID

# Or manual:
watch -n 5 'curl -s http://localhost:3123/api/video-analyzer/jobs/JOB_ID/status | jq'
```

## 📊 Performance Optimization

### Bottlenecks

1. **Whisper Transcription** (slowest)
   - ~10s per minute of audio
   - No GPU acceleration currently
   - Future: Use faster-whisper or whisper.cpp with GPU

2. **Video Download** (network-bound)
   - Depends on internet speed
   - No optimization possible

3. **Clip Extraction** (I/O-bound)
   - FFmpeg sequential processing
   - Future: Parallel clip extraction

### Optimization Strategies

```typescript
// Future: Parallel clip processing
const clips = await Promise.all(
  topSegments.map(segment => this.extractClip(segment))
);

// Future: GPU Whisper
const whisper = new WhisperGPU({ device: 'cuda' });

// Future: Resume failed jobs
if (job.lastCheckpoint) {
  await this.resumeFromCheckpoint(job);
}
```

## 🔒 Security Considerations

### 1. Cookies Storage

**Risk**: Cookies file contains authentication tokens

**Mitigation**:
- Store outside repository
- Add to `.gitignore`
- Use environment variable for path
- Set file permissions: `chmod 600 youtube-cookies.txt`

### 2. File Path Injection

**Risk**: User-provided paths could access unauthorized files

**Mitigation**:
```typescript
// ALWAYS use storageDir prefix
const safeJobPath = path.join(this.config.storageDir, 'uploads', `${jobId}.mp4`);

// NEVER use user input directly
const unsafe = userInput;  // ❌ DON'T
```

### 3. Resource Exhaustion

**Risk**: Large videos could crash server

**Mitigation**:
- Max file size limit (1GB default)
- Max duration limit (2 hours default)
- Queue with single job processing
- Automatic cleanup after 7 days

## 🧪 Testing

### Unit Tests

```typescript
// test/video-analyzer/YouTubeDownloader.test.ts
describe('YouTubeDownloader', () => {
  it('should download public video', async () => {
    const downloader = new YouTubeDownloader('./test-storage');
    const videoPath = await downloader.download(
      'https://youtube.com/watch?v=TEST',
      'test-job-id'
    );
    expect(videoPath).toMatch(/test-job-id\.(mp4|mkv|webm)$/);
  });

  it('should fail on invalid URL', async () => {
    await expect(
      downloader.download('invalid-url', 'test-id')
    ).rejects.toThrow('Invalid video URL');
  });
});
```

### Integration Tests

```bash
# Full pipeline test
curl -X POST http://localhost:3123/api/video-analyzer/analyze \
  -H "Content-Type: application/json" \
  -d @test-youtube-ai-enhancement.json

# Monitor until completion
./monitor-job.sh JOB_ID

# Verify clips exist
ls -lh static/video-analyzer/clips/JOB_ID_*.mp4
```

## 📚 References

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp/wiki)
- [Whisper C++ GitHub](https://github.com/ggerganov/whisper.cpp)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Remotion Whisper Integration](https://www.remotion.dev/docs/whisper)

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
**Maintainer**: FantaProjekt Team
