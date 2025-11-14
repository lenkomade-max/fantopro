# 🎬 FantaProjekt

Автоматическая система создания коротких видеороликов (Shorts) для TikTok, Instagram Reels, YouTube Shorts.

**Версия**: 2.1.0 (обновлено 21.10.2025)
**Основано на**: [short-video-maker](https://github.com/gyoridavid/short-video-maker)

> 🎉 **Последнее обновление:** Гибкое позиционирование текста (3 метода) + управление скоростью речи (1.0-1.5x)!
> 📖 **Изменения:** [UPDATE_21_OCT_2025_POSITIONING_VOICESPEED.md](UPDATE_21_OCT_2025_POSITIONING_VOICESPEED.md)

---

## ✨ Возможности

### Создание видео (ShortCreator)
- 🎬 **Множественные источники контента** - Pexels, URL, прямые файлы от N8N
- ⏱️ **Контроль длительности медиа** - задавайте длительность каждого фото/видео (mediaDuration)
- 🔁 **Автоматическое зацикливание** - медиа зацикливается если короче озвучки
- ✂️ **Обрезка по озвучке** - видео автоматически обрезается до длины аудио
- 🎨 **FFmpeg Blend эффекты** - VHS, снег, световые утечки (12+ blend modes: addition, overlay, multiply, screen, etc.)
- 🎭 **FFmpeg Chromakey баннеры** - Зелёный экран (green screen) наложения с настройкой прозрачности
- 📝 **Гибкое позиционирование текста** 🆕 - алиасы ("center"), проценты ("50%"), пиксели (540) - 3 способа размещения!
- 🎤 **Управление скоростью речи** 🆕 - 1.0-1.5x ускорение озвучки для динамичных видео
- 🎬 **Текстовые анимации** - fadeIn, slideIn, bounce, pulse, typewriter
- 🎵 **Автоозвучка** - Kokoro TTS (72+ голоса)
- 📊 **Авто-субтитры** - Whisper с синхронизацией + гибкое позиционирование
- 🎼 **Фоновая музыка** - 12 настроений с автоприглушением
- 🔧 **N8N интеграция** - полная автоматизация

### Анализ видео (VideoAnalyzer) 🆕
- 🔍 **Автоматический анализ длинных видео** - YouTube, URL, загрузка файлов
- 🎯 **Мультимодальный скоринг** - Текст (40%) + Аудио (30%) + Визуал (30%)
- ✂️ **Генерация вертикальных клипов** - автоматическое создание Shorts (9:16)
- 🧠 **Интеллектуальный выбор моментов** - эмоции, ключевые слова, громкость
- 📥 **Поддержка 1000+ платформ** - через yt-dlp (без API ключей)
- ⚡ **Queue-based обработка** - защита от перегрузки сервера

---

## 🚀 Быстрый старт

### Установка:
```bash
npm install
```

### Запуск сервера:
```bash
npm start
```

### Создание ролика:
```bash
curl -X POST http://localhost:3123/api/short-video \
  -H "Content-Type: application/json" \
  -d '{
    "scenes": [{
      "text": "Hello World!",
      "searchTerms": ["nature", "sunset"]
    }],
    "config": {
      "voice": "am_onyx",
      "music": "chill"
    }
  }'
```

---

## 📖 Документация

- **[МАНИФЕСТ_ПРОЕКТА.md](Документы/МАНИФЕСТ_ПРОЕКТА.md)** - полное описание возможностей
- **[АРХИТЕКТУРА.md](Документы/АРХИТЕКТУРА.md)** - техническая архитектура
- **API_ДОКУМЕНТАЦИЯ.md** - детали всех endpoints
- **ПРИМЕРЫ.md** - готовые примеры использования

---

## 🎯 Примеры

### Минимальный (оригинальный формат):
```json
{
  "scenes": [{
    "text": "Amazing story",
    "searchTerms": ["ocean", "waves"]
  }],
  "config": {
    "voice": "af_heart"
  }
}
```

### С контролем длительности медиа (mediaDuration) 🆕:
```json
{
  "scenes": [{
    "text": "Quick story with precise timing",
    "media": {
      "type": "url",
      "urls": [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
        "https://example.com/photo3.jpg"
      ]
    },
    "mediaDuration": 2
  }],
  "config": {
    "voice": "af_bella"
  }
}
```
> **Результат:** 3 фото × 2 сек = 6 секунд. Если озвучка 12 сек → фото зациклятся. Если озвучка 4 сек → видео обрежется до 4 сек.

### С гибким позиционированием и скоростью речи 🆕:
```json
{
  "scenes": [{
    "text": "Epic moment with visual effects and fast speech",
    "media": {
      "type": "url",
      "urls": ["https://example.com/video.mp4"]
    },
    "effects": [{
      "type": "blend",
      "staticEffectPath": "effects/VHS_01_small.mp4",
      "blendMode": "addition",
      "opacity": 0.5,
      "duration": "full"
    }],
    "textOverlays": [
      {
        "text": "TOP LEFT",
        "position": { "x": "left", "y": "top" },
        "style": { "fontSize": 32, "color": "#FFFFFF" },
        "animation": "fadeIn"
      },
      {
        "text": "CENTER (50%)",
        "position": { "x": "50%", "y": "50%" },
        "style": { "fontSize": 48, "color": "#FFFF00" },
        "animation": "bounce"
      },
      {
        "text": "BOTTOM (85%)",
        "position": { "x": "center", "y": "85%" },
        "style": { "fontSize": 28, "color": "#00FF00" },
        "animation": "slideIn"
      }
    ]
  }],
  "config": {
    "voice": "am_onyx",
    "voiceSpeed": 1.3,
    "music": "dark",
    "orientation": "portrait",
    "captionPosition": "88%"
  }
}
```
> **Новые возможности**:
> - 3 способа позиционирования: алиасы (`"center"`), проценты (`"50%"`), пиксели (`540`)
> - Скорость речи 1.0-1.5x для динамичных роликов
> - Субтитры с процентным позиционированием (`"88%"` от верха)

### С chromakey баннером:
```json
{
  "scenes": [{
    "text": "Check out our amazing product",
    "searchTerms": ["technology", "modern"],
    "effects": [{
      "type": "banner_overlay",
      "staticBannerPath": "banner/greenscreenBanner.mp4",
      "chromakey": {
        "color": "0x00FF00",
        "similarity": 0.4,
        "blend": 0.1
      },
      "position": { "x": 0, "y": 0 }
    }]
  }]
}
```

---

## 🔍 Анализ видео (VideoAnalyzer)

### Включение модуля:
Добавьте в `.env`:
```env
VIDEO_ANALYZER_ENABLED=true
VIDEO_ANALYZER_MAX_DURATION=7200  # 2 часа
VIDEO_ANALYZER_STORAGE=./static/video-analyzer
VIDEO_ANALYZER_RETENTION_DAYS=7
```

### Анализ YouTube видео:
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
      "clipCount": 5,
      "minScore": 0.6,
      "orientation": "portrait"
    }
  }'
```

**Ответ**:
```json
{
  "jobId": "cmgw273kd0009wp54dy9tc3v2",
  "status": "pending",
  "progress": 0,
  "statusUrl": "/api/video-analyzer/jobs/cmgw273kd0009wp54dy9tc3v2/status"
}
```

### Проверка статуса:
```bash
curl http://localhost:3123/api/video-analyzer/jobs/JOB_ID/status
```

**Ответ**:
```json
{
  "jobId": "cmgw273kd0009wp54dy9tc3v2",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "duration": 1847.5,
    "clipsGenerated": 5,
    "topScore": 0.87
  }
}
```

### Получение клипов:
```bash
curl http://localhost:3123/api/video-analyzer/jobs/JOB_ID/clips
```

**Ответ**:
```json
{
  "totalClips": 5,
  "clips": [
    {
      "clipId": "clip-001",
      "duration": 60,
      "score": 0.87,
      "transcript": "Смотрите, это невероятно важная информация...",
      "scores": {
        "text": 0.85,
        "audio": 0.90,
        "visual": 0.86,
        "combined": 0.87
      },
      "downloadUrl": "/api/video-analyzer/jobs/JOB_ID/clips/clip-001"
    }
  ]
}
```

### Скачивание клипа:
```bash
curl http://localhost:3123/api/video-analyzer/jobs/JOB_ID/clips/CLIP_ID > clip.mp4
```

### Все endpoints:
- `POST /api/video-analyzer/analyze` - запустить анализ
- `GET /api/video-analyzer/jobs/:id/status` - проверить статус
- `GET /api/video-analyzer/jobs/:id/clips` - список клипов
- `GET /api/video-analyzer/jobs/:id/clips/:clipId` - скачать клип
- `DELETE /api/video-analyzer/jobs/:id` - удалить задачу
- `GET /api/video-analyzer/jobs` - список всех задач
- `GET /api/video-analyzer/info` - информация о сервисе

**Лимиты**:
- Макс. длительность: 2 часа (по умолчанию)
- Макс. размер файла: 1GB (по умолчанию)
- Rate limiting: 5 запросов/час на IP
- Resource monitoring: 80% памяти

**Документация**: [docs/video-analyzer/](docs/video-analyzer/)

---

## 🛠️ Технологии

- **Node.js** 18+
- **TypeScript** 5+
- **Remotion** 4.0.286
- **Kokoro.js** 1.2.0
- **Whisper CPP**
- **FFmpeg**
- **yt-dlp** (через yt-dlp-wrap) - для VideoAnalyzer

---

## 📦 Структура

```
FantaProjekt/
├── src/
│   ├── short-creator/     # Оригинальная логика создания
│   ├── video-analyzer/    # 🆕 Модуль анализа видео
│   │   ├── analyzers/     # Текст, аудио, визуал
│   │   ├── processors/    # Генерация клипов
│   │   ├── youtube/       # YouTube downloader
│   │   └── types/         # Типы и схемы
│   ├── types/             # TypeScript типы
│   ├── server/            # API серверы (REST + MCP)
│   └── components/        # Remotion компоненты
├── static/
│   ├── music/             # Музыка
│   ├── effects/           # Библиотека эффектов
│   └── video-analyzer/    # 🆕 Хранилище клипов
├── docs/
│   └── video-analyzer/    # 🆕 Документация модуля
├── Документы/             # Основная документация
└── package.json
```

---

## 🔌 API

### ShortCreator Endpoints:
- `POST /api/short-video` - создать видео
- `GET /api/short-video/:id/status` - статус создания
- `GET /api/short-video/:id` - скачать готовое видео
- `DELETE /api/short-video/:id` - удалить видео
- `GET /api/voices` - список голосов (72+)
- `GET /api/music-tags` - музыкальные настроения (12)

### VideoAnalyzer Endpoints (🆕):
- `POST /api/video-analyzer/analyze` - анализ видео
- `GET /api/video-analyzer/jobs/:id/status` - статус анализа
- `GET /api/video-analyzer/jobs/:id/clips` - список клипов
- `GET /api/video-analyzer/jobs/:id/clips/:clipId` - скачать клип
- `DELETE /api/video-analyzer/jobs/:id` - удалить задачу
- `GET /api/video-analyzer/jobs` - список всех задач
- `GET /api/video-analyzer/info` - информация о сервисе

### MCP Protocol:
- Полная поддержка Model Context Protocol
- Интеграция с AI агентами
- N8N workflow совместимость

---

## 🤝 Разработка

### Запуск в dev режиме:
```bash
npm run dev
```

### Сборка:
```bash
npm run build
```

### Тесты:
```bash
npm test
```

---

## 📝 Лицензия

MIT License

---

## 🙏 Благодарности

- [short-video-maker](https://github.com/gyoridavid/short-video-maker) - оригинальный проект
- Remotion - программный рендеринг
- Kokoro - качественный TTS
- Whisper - распознавание речи

---

**FantaProjekt Team** © 2025

