# MANIFEST

Проект: FantaProjekt — Генератор коротких видео (Node/TypeScript + Remotion)
Дата: 15 Oct 2025

## Модули и ключевые файлы
- Оркестрация:
  - `src/short-creator/ShortCreator.ts`
  - `src/short-creator/libraries/Remotion.ts`
- Эффекты и кэш:
  - `src/short-creator/effects/EffectManager.ts`
  - `src/short-creator/effects/OverlayCache.ts` (новый)
- Remotion-композиции:
  - `src/remotion/compositions/BlendOverlay.tsx`
  - `src/components/videos/PortraitVideo.tsx`
  - `src/components/videos/LandscapeVideo.tsx`
- Типы:
  - `src/types/shorts.ts`
- FFmpeg-обёртка:
  - `src/short-creator/libraries/FFmpeg.ts`

## Что добавлено в рамках задачи оверлеев
- Кэш оверлеев с хешированием и перекодированием в `static/effects`.
- Возврат `staticEffectPath` для работы через `staticFile()`.
- В `BlendOverlay.tsx` — `delayRender/continueRender`, `onLoadedMetadata/onLoad`, `Sequence` для тайминга.
- Увеличен `renderTimeout` до 120s.

## Текущее ограничение
- Рендер с 3 наложениями может завершаться статусом `failed` (воспроизводится на `test-overlays-http.json`).

## Как собрать и запустить
- Сборка: `npm run build`
- Запуск рендера: POST `/api/short-video` с телом `test-overlays-http.json`.
- Проверка статуса: GET `/api/short-video/<videoId>/status`.

## Документы
- Статус: `Документы/СТАТУС_ПРОЕКТА.md`
- Журнал задачи: `Документы/Журнал/ЗАДАЧА_ДЛЯ_РАЗРАБОТЧИКА_ПОЛНЫЙ_КОНТЕКСТ_15OCT2025.md`
