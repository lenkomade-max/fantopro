# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 LINEAR (ОБЯЗАТЕЛЬНО!)

**В начале КАЖДОЙ сессии**:
1. Читай активные задачи из Linear (статус "In Progress")
2. Проверяй комментарии для контекста
3. Спроси юзера: продолжить или новая задача?

**Во время работы**: Каждый шаг = комментарий в Linear!

**Подробно**: См. `/home/developer/projects/CLAUDE.md` → раздел "LINEAR PROJECT MANAGEMENT"

---

## Project Overview

**FantaProjekt** is an automated short-form video creation system for TikTok, Instagram Reels, and YouTube Shorts. It extends [short-video-makez ) with additional features while maintaining 100% backward compatibility.

**Core capabilities**:
- Multiple content sources (Pexels API, URLs, direct file uploads)
- Media duration control (mediaDuration) - set individual photo/video durations
- Automatic media looping - media loops when shorter than audio
- Audio-based trimming - video trims to match audio length
- Visual overlay effects with blend modes (VHS, glitches, light leaks)
- **Flexible text positioning** - 3 methods: aliases ("center"), percentages ("50%"), pixels (540)
- **Voice speed control** - 1.0-1.5x speech acceleration for dynamic content
- **Advanced text effects** - multi-color text, accent words, 20 viral fonts, **manual line breaks** 🆕
- **Manual line control** - `lineBreak: true` for precise multi-line text without auto-wrapping 🆕
- Text overlays with 6 animation types (fadeIn, slideIn, bounce, pulse, typewriter, none)
- AI voice synthesis (Kokoro TTS, 72+ voices)
- Automatic subtitle generation (Whisper) with flexible positioning
- Background music with auto-ducking
- **Server monitoring & alerts** - Telegram notifications for crashes, errors, video creation events 🆕
- REST API and MCP protocol support

**Technology stack**: Node.js 18+, TypeScript 5+, Remotion 4.0.286, Express, FFmpeg, Vite, @remotion/google-fonts, node-telegram-bot-api

## Essential Commands

### 🐳 Production (Docker) - ОСНОВНОЙ СПОСОБ
```bash
# FantaProjekt работает в Docker контейнере
docker ps | grep fantaprojekt       # Проверить статус
docker logs fantaprojekt --tail 50  # Посмотреть логи
docker restart fantaprojekt         # Перезапуск

# API доступен на http://localhost:3123
```

### 💻 Development (только для тестов!)
```bash
npm install              # Install dependencies

# ⚠️ ВАЖНО: Build только для проверки компиляции TypeScript
npm run build           # Проверить что код компилируется
rm -rf dist/            # СРАЗУ УДАЛИТЬ после проверки!

# НЕ используем npm start локально - только Docker!
```

### 🧪 Testing
```bash
npm test                # Run Vitest test suite
```

### API Testing
```bash
# Create video (работает с Docker контейнером)
curl -X POST http://localhost:3123/api/short-video \
  -H "Content-Type: application/json" \
  -d @test-simple.json

# Check status
curl http://localhost:3123/api/short-video/<videoId>/status

# Download video
curl http://localhost:3123/api/short-video/<videoId> > output.mp4
```

### Environment Setup
Файл `.env` уже настроен. Основные переменные:
```env
PEXELS_API_KEY=...              # Pexels API ключ
PORT=3123                       # Порт сервера
LOG_LEVEL=info                  # Уровень логирования
DEV=true                        # Dev mode

# Новые пути (v2.2.0)
WORKSPACE_DIR_PATH=./workspace           # Рабочие файлы
LIBS_DIR_PATH=./fantaprojekt-libs        # Библиотеки (whisper)
```

## Architecture Overview

### Core Principle: Non-Breaking Extensions
The original short-video-maker code remains **untouched**. All new features are implemented as extensions in separate modules. This ensures backward compatibility and allows the project to sync with upstream updates.

### Main Pipeline Flow
```
Input JSON → ShortCreator → Content Acquisition → TTS Generation →
Subtitle Generation → Effects Processing → Remotion Rendering → MP4 Output
```

### Key Components

**ShortCreator** (`src/short-creator/ShortCreator.ts`):
- Main orchestration class managing the video creation pipeline
- Queue-based processing system (one video at a time)
- Integrates all libraries: Remotion, Kokoro, Whisper, FFmpeg, Pexels
- Uses ContentSourceFactory for flexible media sourcing
- Uses EffectManager for overlay effects
- Supports mediaDuration for precise media timing control
- Handles media looping when total duration < audio duration
- Trims video to audio length when media duration > audio duration

**Content Sources** (`src/short-creator/libraries/ContentSource/`):
- `Factory.ts`: Determines source type from input
- `PexelsSource.ts`: Searches Pexels API (original behavior)
- `UrlSource.ts`: Downloads from HTTP/HTTPS URLs
- `FileSource.ts`: Handles direct file uploads (base64 or binary)

**Effect System** (`src/short-creator/effects/`):
- `EffectManager.ts`: Processes blend effects and overlay videos
- `OverlayCache.ts`: Caches effect files in `static/effects/`
- Supports 12+ blend modes (overlay, multiply, screen, etc.)

**Remotion Integration** (`src/short-creator/libraries/`):
- `Remotion.ts`: Standard video rendering
- `OverlayRemotion.ts`: Enhanced rendering for overlay effects
- Automatically selects renderer based on effect complexity

**Remotion Compositions** (`src/remotion/compositions/`):
- `BlendOverlay.tsx`: CSS-based blend mode overlays
- `CanvasBlendOverlay.tsx`: Canvas-based pixel blending (experimental)
- Both implementations coexist; selection via `useCanvas` prop

**Video Components** (`src/components/videos/`):
- `PortraitVideo.tsx`: 9:16 aspect ratio (1080×1920)
- `LandscapeVideo.tsx`: 16:9 aspect ratio (1920×1080)

**Type Definitions** (`src/types/shorts.ts`):
- Zod schemas for validation
- `SceneInput`: Scene configuration with media, effects, text overlays, mediaDuration
- `RenderConfig`: Voice, music, orientation, captions
- `MediaSource`: Union type for Pexels/URL/File sources
- `mediaDuration`: Optional number (seconds) controlling individual media item duration

### Directory Structure (v2.2.0)
```
FantaProjekt/
├── src/                    # Исходный код
│   ├── short-creator/      # Основная логика создания видео
│   │   ├── ShortCreator.ts
│   │   ├── libraries/      # Remotion, Kokoro, Whisper, FFmpeg, Pexels
│   │   ├── effects/        # EffectManager, OverlayCache
│   │   └── cache/          # CacheManager
│   ├── components/         # Remotion компоненты видео
│   ├── remotion/           # Remotion композиции
│   ├── server/             # REST API + MCP протокол
│   ├── types/              # TypeScript типы
│   └── config.ts           # ⭐ Конфигурация путей
│
├── static/                 # Статические файлы (музыка, эффекты)
│
├── workspace/              # Рабочая папка (авто-очистка)
│   ├── temp/               # Временные файлы (очистка: 1 день)
│   ├── renders/            # Готовые видео (очистка: 7 дней)
│   ├── cache/              # Кэш (очистка: по размеру > 5GB)
│   └── downloads/          # Скачанные медиа (очистка: 3 дня)
│
├── fantaprojekt-libs/      # Библиотеки
│   └── libs/
│       └── whisper/        # Whisper C++ (1.6GB, НЕ трогать!)
│
├── workflows/              # n8n workflow файлы
│   ├── v6/                 # Последняя версия (v6.x)
│   ├── v5/                 # Предыдущая версия (v5.x)
│   └── README.md
│
├── test-data/              # Тестовые JSON файлы
│   ├── test-*.json         # Тесты функций
│   ├── CRIME-*.json        # Криминальные workflow тесты
│   ├── STRESS-TEST-*.json  # Стресс-тесты
│   └── README.md
│
├── other-projects/         # Другие проекты
│   ├── fanta-site/         # Веб-редактор
│   ├── apps/               # Приложения
│   ├── packages/           # NPM пакеты
│   └── README.md
│
├── archive/                # Архив (старые файлы)
│   ├── reports/            # Старые отчеты
│   ├── scripts/            # Устаревшие скрипты
│   ├── screenshots/        # Старые скриншоты
│   └── README.md
│
├── .ai-temp/               # Временные файлы AI-агентов (в .gitignore)
│   ├── reports/            # Второстепенные отчеты
│   ├── scratch/            # Черновики
│   └── README.md
│
├── Документы/              # Основная документация проекта
│   ├── АРХИТЕКТУРА.md
│   ├── МАНИФЕСТ_ПРОЕКТА.md
│   └── Журнал/             # Отчеты разработки
│
└── node_modules/           # npm зависимости
    └── .cache/             # Kokoro модели (311MB, НЕ трогать!)
```

**⚠️ ВАЖНО:**
- `workspace/` - автоочистка, НЕ хранить важные данные!
- `fantaprojekt-libs/` - библиотеки, НЕ удалять!
- `test-data/` - все тестовые JSON здесь
- `workflows/` - только v5 и v6, старые версии удалены
- `.ai-temp/` - для временных файлов AI-агентов (не коммитится в git)
- `archive/` - старые файлы (не коммитится в git)
- `dist/` - создается только для тестов, сразу удалять!

## Data Schemas

### Input Format (SceneInput)
```typescript
{
  text: string;              // Required: Text to be spoken

  // Legacy (backward compatible)
  searchTerms?: string[];    // Pexels search

  // New flexible media source
  media?: {
    type: "pexels" | "url" | "files";
    // Pexels
    searchTerms?: string[];
    // URL
    urls?: string[];
    // Files
    files?: Array<{
      filename: string;
      data: string | Buffer;  // base64 or binary
      mimeType: string;
    }>;
  };

  // Media duration control (NEW)
  mediaDuration?: number;    // Duration in seconds for each media item
                              // If total < audio: media loops automatically
                              // If total > audio: video trims to audio length

  // Visual effects
  effects?: Array<{
    type: "blend";
    overlayUrl?: string;
    staticEffectPath?: string;
    blendMode: "normal" | "overlay" | "multiply" | "screen" | ...;
    opacity: number;  // 0.0-1.0
    duration?: "full" | { start: number; end: number };
  }>;

  // Text overlays (NEW: 3 positioning methods)
  textOverlays?: Array<{
    text: string;
    position: {
      x: "left"|"center"|"right"|number|"50%";  // Aliases, pixels, or percentages
      y: "top"|"center"|"bottom"|number|"85%";  // Mix and match!
    };
    style?: { fontSize, fontFamily, color, backgroundColor, padding, opacity };
    animation?: "fadeIn" | "slideIn" | "typewriter" | "bounce" | "pulse" | "none";
    timing?: { start: number; end: number };
  }>;
}
```

### Configuration (RenderConfig)
```typescript
{
  voice?: VoiceEnum;              // 72+ voices (default: af_heart)
  voiceSpeed?: number;            // 1.0-1.5x speech speed (NEW: 1.0 = normal, 1.5 = fastest)
  music?: MusicMoodEnum;          // 12 moods (sad, dark, chill, etc.)
  musicVolume?: "muted"|"low"|"medium"|"high";
  orientation?: "portrait"|"landscape";
  captionPosition?: "top"|"center"|"bottom"|number|"85%";  // NEW: Flexible positioning
  captionBackgroundColor?: string;
  paddingBack?: number;           // Extra time after speech (ms)
}
```

## Common Development Tasks

### Testing Video Generation
Используйте тестовые JSON файлы из папки `test-data/`:

**Базовые тесты:**
- `test-data/comprehensive_test_video.json` - Полный тест всех функций
- `test-data/test-advanced-text-overlay.json` - Расширенные текстовые эффекты
- `test-data/test-advanced-text-multiple-styles.json` - Множественные стили текста
- `test-data/test-positioning-full.json` - Гибкое позиционирование

**Тесты mediaDuration:**
- `test-data/test-10photos-1sec-CORRECT.json` - 10 фото × 1 сек (с зацикливанием)
- `test-data/test-short-audio-trim.json` - Обрезка при медиа > аудио

**Криминальные workflow:**
- `test-data/CRIME-CORRECT-JSON.json` - Правильное использование lineBreak
- `test-data/CRIME-WORKFLOW-STANDARD-TEST.json` - Стандартный криминальный workflow

**Стресс-тесты:**
- `test-data/STRESS-TEST-10SEC-ALL-FEATURES.json` - Все функции за 10 секунд
- `test-data/ULTIMATE-STRESS-TEST-ALL-FEATURES.json` - Максимальная нагрузка

**Использование:**
```bash
curl -X POST http://localhost:3123/api/short-video \
  -H "Content-Type: application/json" \
  -d @test-data/test-advanced-text-overlay.json
```

Полный список тестов смотрите в `test-data/README.md`

### Adding New Visual Effects
1. Place effect video/image in `static/effects/`
2. Reference in JSON:
   ```json
   {
     "effects": [{
       "type": "blend",
       "staticEffectPath": "effects/my-effect.mp4",
       "blendMode": "overlay",
       "opacity": 0.6
     }]
   }
   ```
3. Effect is auto-cached by OverlayCache on first use

### Working with Overlays
**Important**: Two parallel implementations exist:
- **CSS Overlay** (`BlendOverlay.tsx`): Uses CSS `mix-blend-mode`, simpler but browser-dependent
- **Canvas Overlay** (`CanvasBlendOverlay.tsx`): Pixel-level blending, more control but complex

**Current status**: Both implementations are integrated but have stability issues in certain scenarios. Select via `useCanvas` prop or config in `config/canvas-overlay.ts`.

### Debugging Render Issues
1. Check logs: Enable `LOG_LEVEL=debug` in `.env`
2. Increase timeout: Default is 120s in `remotion.config.ts`
3. Test simpler JSON first to isolate issues
4. Check if overlay effects are causing problems (try without effects)

### Running Tests
```bash
npm test                    # All tests
npm test ShortCreator       # Specific test file
npm test -- --watch         # Watch mode
```

## API Endpoints

### REST API
- `POST /api/short-video` - Create video, returns `{ videoId, status }`
- `GET /api/short-video/:id/status` - Check processing status
- `GET /api/short-video/:id` - Download rendered video (MP4)
- `DELETE /api/short-video/:id` - Delete video
- `GET /api/voices` - List available TTS voices
- `GET /api/music-tags` - List music moods
- `GET /api/tmp/:filename` - Serve temporary files (for Remotion)

### MCP Protocol
Compatible with Model Context Protocol for AI agent integration.

## Build System

### TypeScript Compilation
- Main config: `tsconfig.json`
- Build config: `tsconfig.build.json` (excludes UI and tests)
- Output: `dist/` directory
- Entry point: `src/index.ts` → `dist/index.js`

### Vite Build (UI)
- Config: `vite.config.ts`
- Root: `src/ui/`
- Output: `dist/ui/`
- Dev server: Port 3000 with proxy to API (port 3123)

### Remotion Configuration
- Config: `remotion.config.ts`
- Public directory: `static/` (includes music and effects)
- Entry point: `src/components/root/index.ts`
- Chrome renderer: `egl` for better performance
- Concurrency: 1 (for stability with overlays)
- Webpack polyfills for Node.js modules (path, crypto, stream, etc.)

## Important Development Guidelines

### 1. Preserve Original Behavior
- Never modify original short-video-maker logic
- All new features must be optional and backward compatible
- If `searchTerms` is provided (legacy), behavior is identical to upstream

### 2. File Path Handling
- Always use absolute paths
- Validate file existence before processing
- Use `path.join()` for cross-platform compatibility
- Remotion static files must use `staticFile()` from `remotion` package

### 3. Error Handling
- Log errors with context using `logger` (pino)
- Clean up temporary files in finally blocks
- Provide fallback renderers if overlay rendering fails

### 4. Testing Before Deployment
- Always run `npm run build` before testing changes
- Test with simple examples first
- Verify backward compatibility with legacy format
- Check logs for warnings/errors

### 5. Memory Management
- Clean up temp files after rendering
- Limit concurrent operations (queue-based processing)
- Use OverlayCache to avoid re-downloading effects

## Known Limitations

- Maximum 3-4 overlay effects per scene (timeout risk beyond this)
- Overlay effects require static path resolution via `staticFile()`
- Canvas overlay implementation is experimental and may not work in all cases
- Rendering with many overlays can timeout (default: 120s)
- Ken Burns zoom effect for photos centers on image (no panning)

## Important Notes

### Whisper GLIBC Compatibility Issue
**⚠️ КРИТИЧНО:** Whisper должен быть собран внутри Docker контейнера, а не скопирован с хост-машины!

**Проблема:**
- Whisper C++ требует **GLIBC 2.38+**
- Docker image (node:18-bookworm-slim) использует **GLIBC 2.36**
- Бинарник Whisper, собранный на хост-машине с новой GLIBC, **не работает** в контейнере
- Ошибка: `GLIBC_2.38 not found (required by /app/fantaprojekt-libs/libs/whisper/main)`

**Причина:**
В `src/short-creator/libraries/Whisper.ts` есть проверка:
```typescript
if (!config.runningInDocker) {
  await installWhisperCpp(...);  // Установка только НЕ в Docker
}
```
Это означает, что Whisper **не устанавливается** при запуске в Docker, а должен быть предустановлен.

**Решение:**
В `Dockerfile` добавлена установка Whisper во время сборки образа:
```dockerfile
# Install Whisper inside Docker (builds for container's GLIBC version)
# This is required because Whisper.ts skips installation when DOCKER=true
RUN npx --yes @remotion/install-whisper-cpp@1.0.4 \
    --to=/app/fantaprojekt-libs/libs/whisper
```

**Важно:**
- Docker volume `whisper-models` сохраняет скомпилированный Whisper между перезапусками
- При изменении базового образа Node.js или GLIBC версии нужно удалить volume: `docker volume rm fantaprojekt_whisper-models`
- После этого пересобрать образ: `docker compose build --no-cache`

### Monitoring & Telegram Alerts
**🆕 ДОБАВЛЕНО:** Система мониторинга и уведомлений в Telegram

**Конфигурация в `.env`:**
```env
# Monitoring & Alerts
MONITORING_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

**Переменные должны быть прокинуты в docker-compose.yml:**
```yaml
environment:
  - MONITORING_ENABLED=${MONITORING_ENABLED:-false}
  - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
  - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}
```

**Уведомления отправляются при:**
- 🚀 Запуске сервера
- 🛑 Остановке сервера (SIGTERM/SIGINT)
- 🚨 Uncaught exceptions (критические ошибки)
- ⚠️ Unhandled promise rejections
- 🎬 Получении запроса на создание видео
- ✅ Успешном создании видео
- ❌ Ошибке при создании видео

**Документация:** `src/monitoring/README.md` и `Документы/СИСТЕМА_МОНИТОРИНГА.md`

### AdvancedTextOverlay and lineBreak
**⚠️ КРИТИЧНО:** Не используйте `maxWidth` или `whiteSpace` в `baseStyle` для AdvancedTextOverlay!

**❌ Неправильно:**
```json
{
  "baseStyle": {
    "maxWidth": "100%",
    "whiteSpace": "pre"  // Конфликтует с lineBreak!
  }
}
```

**✅ Правильно:**
```json
{
  "baseStyle": {
    "fontFamily": "Oswald",
    "backgroundColor": "rgba(0, 0, 0, 0.8)",
    "padding": 20,
    "textAlign": "center"
  }
}
```

См. `archive/reports/UPDATE_22_OCT_2025_LINEBREAK_FIX.md` для деталей.

## Maintenance & Auto-Cleanup

### Automatic Cleanup System

**FantaProjekt has an automated cleanup system** that runs daily at 03:00 to maintain server health.

**What gets cleaned:**
- `workspace/temp/` - files older than 1 day
- `workspace/downloads/` - files older than 3 days
- `workspace/renders/` - videos older than 7 days
- `workspace/cache/` - keeps size under 5GB (removes oldest files)
- `n8n_data/binaryData/` - files older than 7 days
- **Weekly** (Sunday): system logs, Docker images/containers, npm cache

**Script location:** `/home/developer/projects/FantaProjekt/cleanup.sh`
**Log file:** `/var/log/fantaprojekt-cleanup.log`
**Cron schedule:** `0 3 * * *` (daily at 03:00)

**Manual execution:**
```bash
# Run cleanup manually
/home/developer/projects/FantaProjekt/cleanup.sh

# View cleanup log
tail -50 /var/log/fantaprojekt-cleanup.log

# Check workspace size
du -sh /home/developer/projects/FantaProjekt/workspace/*
```

**⚠️ Important:**
- Videos in `renders/` are automatically deleted after 7 days
- Download important videos before they're cleaned up
- The system never touches databases, node_modules, or fresh files

**Full documentation:** `Документы/СИСТЕМА_АВТООЧИСТКИ.md`

## Documentation References

**Основная документация:**
- `README.md` - Обзор проекта и быстрый старт
- `CLAUDE.md` - Руководство для AI-агентов (этот файл)
- `Документы/МАНИФЕСТ_ПРОЕКТА.md` - Полный манифест функций
- `Документы/АРХИТЕКТУРА.md` - Детальная архитектура проекта
- `Документы/РАСШИРЕННАЯ_СИСТЕМА_ТЕКСТА.md` - Система текстовых эффектов
- `Документы/СИСТЕМА_АВТООЧИСТКИ.md` - Система автоочистки

**README файлы в папках:**
- `workflows/README.md` - Документация по workflow
- `test-data/README.md` - Каталог тестовых файлов
- `archive/README.md` - Политика архивирования
- `other-projects/README.md` - Описание других проектов
- `.ai-temp/README.md` - Правила для AI-агентов

**Старые отчеты (в archive/):**
- Все UPDATE_*.md файлы перемещены в `archive/reports/`
- Технические спецификации в `archive/reports/`
- Для справки о старых изменениях смотрите `archive/reports/`

## Working with the Codebase

When making changes:
1. Read relevant documentation in `Документы/` first
2. Check existing test files in `archive/scripts/*.test.ts` for examples
3. Verify types in `src/types/shorts.ts`
4. Run `npm run build` before testing
5. Test with JSON files from `test-data/`
6. Update documentation if adding new features
7. Ensure backward compatibility with legacy format

**New Folder Guidelines:**
- Test files → `test-data/`
- Workflow files → `workflows/v6/` or `workflows/v5/`
- Temporary AI reports → `.ai-temp/reports/`
- Archived files → `archive/`
- Related projects → `other-projects/`

## AI Agent Reporting Guidelines

**ВАЖНО: Экономия токенов**

**НЕ пишите детальные отчеты для:**
- Мелких фиксов и багфиксов
- Изменений в n8n workflow нодах
- Временных скриптов и утилит
- Рутинных задач

**Пишите краткие отчеты ТОЛЬКО для:**
- Важных внедрений в FantaProjekt core (src/)
- Архитектурных изменений
- Новых функций API
- Критических багфиксов

**Формат отчетов:**
- Место: `Документы/Журнал/` (ТОЛЬКО туда!)
- Стиль: Краткий, для AI-агентов (экономить токены)
- Имя: `YYYYMMDD_краткое_название.md`
- Структура: Проблема → Решение → Файлы (без воды!)

**Пример правильного отчета (макс 50 строк):**
```markdown
# Fix: Random Music n8n Node
Проблема: $node[] ломал data flow
Решение: Inline music selection
Файл: .ai-temp/Build_VIRAL_Payload5_FIXED_RANDOMMUSIC.json
Изменения: +18 строк музыки, -0 строк остального
Статус: ✅ Работает
```

**НЕ создавайте:**
- Файлы в .ai-temp/ с отчетами (только скрипты!)
- Многостраничные markdown отчеты
- Дубликаты документации
