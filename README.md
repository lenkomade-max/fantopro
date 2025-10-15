# 🎬 FantaProjekt

Автоматическая система создания коротких видеороликов (Shorts) для TikTok, Instagram Reels, YouTube Shorts.

**Версия**: 1.0.0  
**Основано на**: [short-video-maker](https://github.com/gyoridavid/short-video-maker)

---

## ✨ Возможности

- 🎬 **Множественные источники контента** - Pexels, URL, прямые файлы от N8N
- 🎨 **Эффекты наложения** - VHS, снег, световые утечки, пользовательские
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

### С эффектами и оверлеями:
```json
{
  "scenes": [{
    "text": "Epic moment",
    "media": {
      "type": "url",
      "url": "https://example.com/video.mp4"
    },
    "effects": [{
      "type": "overlay",
      "source": "vhs-glitch.mp4",
      "blendMode": "overlay",
      "opacity": 0.7
    }],
    "textOverlays": [{
      "text": "BREAKING NEWS",
      "position": "top",
      "style": { "fontSize": 60, "color": "#FF0000" }
    }]
  }],
  "config": {
    "voice": "am_onyx",
    "music": "dark",
    "orientation": "portrait"
  }
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

