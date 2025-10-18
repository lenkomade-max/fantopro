# FantaProjekt - Quick Start для AI

## 🎯 Что это за проект (30 секунд)

**Генератор коротких видео** для TikTok/Reels/Shorts с использованием:
- **Remotion 4.0.286** - рендеринг видео
- **Node.js/TypeScript** - бэкенд
- **Express API** - REST + MCP сервер
- **FFmpeg** - обработка медиа
- **Kokoro TTS** - озвучка

## 📁 Структура проекта (модули)

### 1. **Video Creation** (src/short-creator/)
- `ShortCreator.ts` - главный оркестратор создания видео
- `libraries/Remotion.ts` - интеграция с Remotion
- `libraries/FFmpeg.ts` - обработка видео
- `libraries/Kokoro.ts` - генерация голоса

### 2. **Effects System** (src/short-creator/effects/)
- `EffectManager.ts` - управление эффектами
- `OverlayCache.ts` - кэширование оверлеев
- Проблема: рендер с 3+ оверлеями падает

### 3. **Remotion Compositions** (src/remotion/ и src/components/)
- `remotion/compositions/BlendOverlay.tsx` - наложение эффектов
- `components/videos/PortraitVideo.tsx` - вертикальное видео
- `components/videos/LandscapeVideo.tsx` - горизонтальное видео

### 4. **API Server** (src/server/)
- `server/server.ts` - Express сервер
- `server/routers/rest.ts` - REST API
- `server/routers/mcp.ts` - MCP protocol

### 5. **Content Sources** (src/short-creator/libraries/ContentSource/)
- `PexelsSource.ts` - загрузка из Pexels
- `UrlSource.ts` - загрузка по URL
- `FileSource.ts` - локальные файлы

## 🚨 Известные проблемы

1. **Рендер падает с множественными оверлеями** (текущая)
   - Файлы: `BlendOverlay.tsx`, `EffectManager.ts`, `OverlayCache.ts`
   - Симптом: status=failed при 3+ эффектах
   - Тест: `test-overlays-http.json`

## 📚 Детальная документация

- `MANIFEST.md` - обзор модулей
- `FANTA_TECHNICAL_SPEC.md` - техническая спецификация
- `Документы/СТАТУС_ПРОЕКТА.md` - текущий статус
- `Документы/Журнал/` - история изменений

---

## ⚡ Как AI должен работать с проектом

### ❌ НЕ ДЕЛАТЬ:
```
"Изучи весь проект, прочитай все файлы, пойми архитектуру..."
```
→ Слишком много контекста, AI перегружен

### ✅ ПРАВИЛЬНО:
```
"Проблема с рендером оверлеев. Читай:
- BlendOverlay.tsx
- EffectManager.ts
- test-overlays-http.json"
```
→ Конкретная задача, минимальный контекст
