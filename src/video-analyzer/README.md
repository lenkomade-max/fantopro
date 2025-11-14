# VideoAnalyzer Module

**AI-Powered YouTube Video Analysis & Clip Generation**

Автоматический анализ YouTube видео с генерацией clips для TikTok/Instagram Reels/YouTube Shorts.

## 🎯 Возможности

### Основные функции
- ✅ **YouTube Download** - Скачивание видео через yt-dlp (без API ключей)
- ✅ **Audio Transcription** - Whisper transcription (1400+ segments support)
- ✅ **Content Analysis** - Text + Audio + Visual анализ (MVP mode)
- ✅ **Clip Generation** - Автоматическое создание shorts clips
- 🚧 **AI Enhancement** - AI narrative generation (OpenRouter integration)

### Поддерживаемые источники
- YouTube (cookies authentication)
- Direct URL upload
- Local file upload

## 🏗️ Архитектура

```
VideoAnalyzer (main orchestrator)
├── YouTubeDownloader - yt-dlp integration
├── VideoProcessor - FFmpeg audio/video processing
├── TextAnalyzer - Keyword & action verb extraction
├── AudioAnalyzer - Audio analysis (placeholder)
├── VisualAnalyzer - Scene detection (MVP mode)
├── ClipGenerator - Clip creation & processing
└── VideoEnhancer - AI narrative enhancement (future)
```

## 📦 Зависимости

**Runtime:**
- `yt-dlp` - YouTube video downloader (system binary)
- `@remotion/install-whisper-cpp` - Audio transcription
- `fluent-ffmpeg` - Video/audio processing
- `@ffmpeg-installer/ffmpeg` - FFmpeg bundled binary
- `pino` - Structured logging

**Development:**
- TypeScript 5+
- Node.js 18+

## 🚀 Быстрый старт

### 1. Установка

```bash
# Install yt-dlp system dependency
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp
chmod a+rx ~/.local/bin/yt-dlp
sudo ln -sf ~/.local/bin/yt-dlp /usr/local/bin/yt-dlp

# Install Node dependencies
npm install
npm run build
```

### 2. Конфигурация

Create `.env` file:

```env
# Video Analyzer Module
VIDEO_ANALYZER_ENABLED=true
VIDEO_ANALYZER_MAX_DURATION=7200
VIDEO_ANALYZER_STORAGE=./static/video-analyzer
VIDEO_ANALYZER_RETENTION_DAYS=7
YOUTUBE_COOKIES_FILE=/path/to/youtube-cookies.txt

# AI Enhancement (optional)
VIDEO_ANALYZER_ENHANCEMENT_ENABLED=true
OPENROUTER_API_KEY=sk-or-v1-...
AI_COST_STRATEGY=budget
AI_VISION_PRIMARY=qwen/qwen-2-vl-72b:free
AI_NARRATIVE_PRIMARY=anthropic/claude-3.7-sonnet
AI_UTILITY_PRIMARY=meta-llama/llama-3.3-70b-instruct:free
```

### 3. YouTube Cookies Setup

Для обхода YouTube bot protection требуются cookies:

```bash
# Export cookies from browser using extension "Get cookies.txt"
# Or use yt-dlp:
yt-dlp --cookies-from-browser chrome --cookies youtube-cookies.txt

# Cookies format: Netscape HTTP Cookie File
# File structure:
# domain  flag  path  secure  expiration  name  value
.youtube.com  TRUE  /  TRUE  1234567890  COOKIE_NAME  cookie_value
```

### 4. Запуск

```bash
npm start
# Server starts on port 3123
```

## 📡 API Endpoints

### POST `/api/video-analyzer/analyze`

Начать анализ видео:

```bash
curl -X POST http://localhost:3123/api/video-analyzer/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "youtube",
      "url": "https://www.youtube.com/watch?v=VIDEO_ID"
    },
    "options": {
      "clipDuration": 60,
      "clipCount": 3,
      "minScore": 0.6,
      "orientation": "portrait",
      "enableEnhancement": true,
      "narrativeStyle": "recap",
      "voiceId": "af_sarah",
      "addSubtitles": true,
      "keepOriginalAudio": false
    }
  }'
```

**Response:**
```json
{
  "jobId": "uuid-here",
  "status": "downloading",
  "progress": 10,
  "createdAt": "2025-10-19T11:58:37.294Z",
  "statusUrl": "/api/video-analyzer/jobs/uuid/status"
}
```

### GET `/api/video-analyzer/jobs/:jobId/status`

Проверить статус job:

```bash
curl http://localhost:3123/api/video-analyzer/jobs/UUID/status
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "progress": 100,
  "createdAt": "2025-10-19T11:58:37.294Z",
  "updatedAt": "2025-10-19T12:10:00.000Z",
  "metadata": {
    "sourceType": "youtube",
    "sourceUrl": "https://youtube.com/...",
    "duration": 1381.61,
    "fileSize": 334853770
  },
  "result": {
    "clips": [
      {
        "clipId": "uuid",
        "startTime": 120.5,
        "endTime": 180.5,
        "duration": 60,
        "score": 0.85,
        "path": "/path/to/clip.mp4"
      }
    ]
  }
}
```

### GET `/api/video-analyzer/info`

Получить информацию о системе:

```bash
curl http://localhost:3123/api/video-analyzer/info
```

## 🔧 Конфигурация

### Настройки VideoAnalyzer

```typescript
interface VideoAnalyzerConfig {
  enabled: boolean;              // Включить модуль
  maxDuration: number;           // Max длительность видео (сек)
  maxFileSize: number;           // Max размер файла (байты)
  storageDir: string;            // Путь для хранения
  retentionDays: number;         // Срок хранения (дни)

  analyzerWeights: {
    text: number;                // Вес text analysis (0-1)
    audio: number;               // Вес audio analysis (0-1)
    visual: number;              // Вес visual analysis (0-1)
  };

  processing: {
    maxConcurrentClips: number;  // Макс. параллельных clips
    ffmpegPreset: string;        // FFmpeg preset (fast/medium/slow)
    outputCrf: number;           // Output quality (18-28)
    audioBitrate: string;        // Audio bitrate (128k)
  };
}
```

### Job Lifecycle

```
Status Flow:
pending → downloading → transcribing → analyzing →
generating_clips → enhancing (optional) → completed / failed

Progress:
pending:       0%
downloading:   10%
transcribing:  20%
analyzing:     50%
generating:    70%
enhancing:     90%
completed:     100%
```

## 🐛 Troubleshooting

### Проблема: "Sign in to confirm you're not a bot"

**Решение**: Настройте YouTube cookies:

1. Export cookies из browser
2. Сохраните в Netscape format
3. Укажите путь в `.env`: `YOUTUBE_COOKIES_FILE=/path/to/cookies.txt`

### Проблема: "Invalid inputFile type. Not a wav file"

**Решение**: Проверьте что VideoProcessor создаёт WAV 16kHz:

```typescript
// VideoProcessor.ts - correct config:
.audioCodec('pcm_s16le')  // WAV format
.audioChannels(1)          // Mono
.audioFrequency(16000)     // 16kHz (required by Whisper)
```

### Проблема: "input file not found"

**Решение**: Используйте абсолютные пути для Whisper:

```typescript
const absolutePath = path.resolve(audioPath);
await whisper.CreateCaption(absolutePath);
```

### Проблема: "yt-dlp ENOENT"

**Решение**: Установите yt-dlp system binary:

```bash
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o ~/.local/bin/yt-dlp
chmod a+rx ~/.local/bin/yt-dlp
sudo ln -sf ~/.local/bin/yt-dlp /usr/local/bin/yt-dlp
```

## 📊 Performance

### Типичное время обработки

**Видео: 23 минуты (320MB, 1920x1080)**

| Stage          | Time    | Progress |
|----------------|---------|----------|
| Download       | ~24s    | 10%      |
| Audio extract  | ~2s     | 15%      |
| Transcription  | ~4min   | 50%      |
| Analysis       | ~2min   | 70%      |
| Clip generation| ~1min   | 90%      |
| **Total**      | **~7min** | 100%   |

### Ограничения

- Max video duration: 2 hours (7200 sec)
- Max file size: 1GB (configurable)
- Max clips per job: 20
- Retention period: 7 days

## 🔐 Security

### Cookies Storage

Cookies файл содержит authentication токены. **Важно:**

- Храните вне git repository
- Используйте `.gitignore`: `youtube-cookies.txt`
- Обновляйте регулярно (cookies expire)
- Не делитесь публично

### File Paths

Модуль использует только `storageDir` для файлов:

```
static/video-analyzer/
├── uploads/       # Downloaded videos
├── processing/    # Audio extraction, temp files
└── clips/         # Generated clips
```

## 📝 Changelog

См. [CHANGELOG.md](./CHANGELOG.md)

## 🤝 Contributing

1. Все изменения в TypeScript
2. Build перед commit: `npm run build`
3. Тесты: `npm test`
4. Логирование через `pino`
5. Используйте Context7 для dependency research

## 📄 License

Part of FantaProjekt - Short Video Creator System
