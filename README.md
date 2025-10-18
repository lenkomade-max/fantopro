# 🎬 FantaProjekt

Автоматическая система создания коротких видеороликов (Shorts) для TikTok, Instagram Reels, YouTube Shorts.

**Версия**: 2.0.0 (обновлено 18.10.2025)
**Основано на**: [short-video-maker](https://github.com/gyoridavid/short-video-maker)

> 🎉 **Последнее обновление:** Интеграция FFmpeg post-processing для blend и chromakey эффектов!
> 📖 **Изменения:** [FFMPEG_OVERLAY_GUIDE.md](FFMPEG_OVERLAY_GUIDE.md)

---

## ✨ Возможности

- 🎬 **Множественные источники контента** - Pexels, URL, прямые файлы от N8N
- 🎨 **FFmpeg Blend эффекты** - VHS, снег, световые утечки (12+ blend modes: addition, overlay, multiply, screen, etc.)
- 🎭 **FFmpeg Chromakey баннеры** - Зелёный экран (green screen) наложения с настройкой прозрачности
- 📝 **Текстовые оверлеи** - статичные и анимированные
- 🎵 **Автоозвучка** - Kokoro TTS (72+ голоса)
- 📊 **Авто-субтитры** - Whisper с синхронизацией
- 🎼 **Фоновая музыка** - 12 настроений с автоприглушением
- 🔧 **N8N интеграция** - полная автоматизация

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

### С FFmpeg blend эффектами:
```json
{
  "scenes": [{
    "text": "Epic moment with visual effects",
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
    "textOverlays": [{
      "text": "BREAKING NEWS",
      "position": { "x": "center", "y": "top" },
      "style": { "fontSize": 60, "color": "#FF0000" },
      "animation": "fadeIn"
    }]
  }],
  "config": {
    "voice": "am_onyx",
    "music": "dark",
    "orientation": "portrait"
  }
}
```

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

## 🛠️ Технологии

- **Node.js** 18+
- **TypeScript** 5+
- **Remotion** 4.0.286
- **Kokoro.js** 1.2.0
- **Whisper CPP**
- **FFmpeg**

---

## 📦 Структура

```
FantaProjekt/
├── src/
│   ├── core/           # Оригинальная логика
│   ├── extensions/     # Новые функции
│   ├── types/          # TypeScript типы
│   ├── server/         # API серверы
│   └── components/     # Remotion компоненты
├── static/
│   ├── music/          # Музыка
│   └── effects/        # Библиотека эффектов
├── Документы/          # Документация
└── package.json
```

---

## 🔌 API

### REST Endpoints:
- `POST /api/short-video` - создать
- `GET /api/short-video/:id/status` - статус
- `GET /api/short-video/:id` - скачать
- `GET /api/voices` - список голосов
- `GET /api/music-tags` - музыкальные настроения

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

