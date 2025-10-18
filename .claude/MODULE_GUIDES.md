# Модульные гайды для AI

## Принцип работы: "Один модуль - один чат"

Каждый модуль изолирован. AI не нужно знать весь проект для работы с одним модулем.

---

## 📦 Module 1: Effects System

### Когда использовать:
- Проблемы с наложением эффектов
- Баги в BlendOverlay
- Кэширование оверлеев

### Ключевые файлы:
```
src/short-creator/effects/EffectManager.ts
src/short-creator/effects/OverlayCache.ts
src/remotion/compositions/BlendOverlay.tsx
```

### Типы:
```typescript
// src/types/shorts.ts
interface OverlayEffect {
  url: string;
  startTime: number;
  endTime: number;
  position?: { x: number; y: number };
  scale?: number;
  opacity?: number;
}
```

### Prompt для AI:
```
Проблема с эффектами оверлеев.
Читай только:
- src/remotion/compositions/BlendOverlay.tsx
- src/short-creator/effects/EffectManager.ts
Не читай другие файлы без разрешения.
```

---

## 📦 Module 2: Video Rendering

### Когда использовать:
- Ошибки рендеринга Remotion
- Timeout проблемы
- Проблемы с композициями

### Ключевые файлы:
```
src/short-creator/libraries/Remotion.ts
src/components/videos/PortraitVideo.tsx
src/components/videos/LandscapeVideo.tsx
```

### Зависимости:
- Remotion 4.0.286
- @remotion/renderer
- @remotion/bundler

### Prompt для AI:
```
Проблема с рендером видео в Remotion.
Читай:
- src/short-creator/libraries/Remotion.ts
- src/components/videos/PortraitVideo.tsx
use context7 для актуальной документации Remotion 4.0.286
```

---

## 📦 Module 3: Content Sources

### Когда использовать:
- Проблемы загрузки контента
- Интеграция с Pexels
- Обработка URL/файлов

### Ключевые файлы:
```
src/short-creator/libraries/ContentSource/Factory.ts
src/short-creator/libraries/ContentSource/PexelsSource.ts
src/short-creator/libraries/ContentSource/UrlSource.ts
src/short-creator/libraries/ContentSource/FileSource.ts
```

### Prompt для AI:
```
Проблема с загрузкой контента из Pexels.
Читай:
- src/short-creator/libraries/ContentSource/PexelsSource.ts
- src/short-creator/libraries/ContentSource/types.ts
```

---

## 📦 Module 4: API Server

### Когда использовать:
- Проблемы с REST API
- MCP protocol issues
- Роутинг

### Ключевые файлы:
```
src/server/server.ts
src/server/routers/rest.ts
src/server/routers/mcp.ts
src/server/validator.ts
```

### Prompt для AI:
```
Проблема с API endpoint /api/short-video.
Читай:
- src/server/routers/rest.ts
- src/server/validator.ts
```

---

## 📦 Module 5: Audio (TTS)

### Когда использовать:
- Проблемы с Kokoro TTS
- Генерация озвучки
- Whisper транскрипция

### Ключевые файлы:
```
src/short-creator/libraries/Kokoro.ts
src/short-creator/libraries/Whisper.ts
```

### Prompt для AI:
```
Проблема с генерацией голоса через Kokoro.
Читай:
- src/short-creator/libraries/Kokoro.ts
use context7 для kokoro-js 1.2.0 документации
```

---

## 🎯 Правило работы с AI:

### ❌ Плохо:
```
"Изучи проект, найди проблему, фикси всё"
```

### ✅ Хорошо:
```
"Module: Effects System
Проблема: Рендер падает с 3+ оверлеями
Ошибка: [текст ошибки]
Читай только файлы Module 1"
```

---

## 🔄 Если проблема межмодульная:

1. Определите основной модуль проблемы
2. Начните с него
3. Если нужен второй модуль - укажите явно
4. Не давайте больше 2-3 модулей за раз

### Пример:
```
"Проблема между Effects и Rendering модулями.
Читай:
- BlendOverlay.tsx (Module 1)
- Remotion.ts (Module 2)
Только эти файлы!"
```
