# Спецификация интеграции (OPUS v2 + SONET)

Цель: довести редактор шаблонов до продакшена, взяв ядро из OPUS 4.1 (2-я доработанная версия) и дозируя лучшие части из SONET. Ниже — что именно брать, куда вставлять и как проверять.

## База проекта
- База: OPUS 4.1 (2-я доработанная версия)
- Встраивание без изменений: публичный API `mountEditor(el, options): EditorHandle`
- Сохраняем: Timekeeper, Renderer, TimelineController, EffectsProcessor, KeyframeInterpolator, SubtitleManager, SchemaValidator, HistoryManager, README, vite lib mode

## Что перенести из SONET (и как)

### 1) Конфигурация редактора (константы)
- Файл в новом проекте: `packages/template-editor/config/editorConfig.ts`
- Вставить константы из SONET: FPS/GRID/ZOOM/ASSETS/HISTORY
```ts
export const EDITOR_CONFIG = {
  DEFAULT_FPS: 30,
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  TIMELINE: {
    TRACK_HEIGHT: 60,
    MIN_CLIP_WIDTH: 20,
    SNAP_THRESHOLD: 5,
    ZOOM_LEVELS: [10, 20, 50, 100, 200, 500, 1000],
    GRID_INTERVAL: 1000, // ms
  },
  PREVIEW: { TARGET_FPS: 30, MAX_CANVAS_SIZE: 4096 },
  PLAYBACK: { PLAYBACK_RATE_NORMAL: 1, PLAYBACK_RATE_FAST: 2, PLAYBACK_RATE_SLOW: 0.5 },
  ASSETS: {
    MAX_FILE_SIZE: 500 * 1024 * 1024,
    ALLOWED_VIDEO_MIMES: ['video/mp4','video/webm','video/quicktime'],
    ALLOWED_AUDIO_MIMES: ['audio/mp3','audio/mpeg','audio/wav','audio/ogg'],
    ALLOWED_IMAGE_MIMES: ['image/png','image/jpeg','image/gif','image/webp'],
  },
  HISTORY: { MAX_UNDO_STEPS: 50 },
} as const;
```
- Интеграция: используйте `EDITOR_CONFIG` в Timekeeper/Timeline/Assets/History вместо хардкодов

### 2) Утилиты времени и геометрии
- Файлы: `packages/template-editor/utils/time.ts`, `packages/template-editor/utils/geometry.ts`
- Из SONET взять: `ms↔frames`, снап, формат времени; матрица трансформаций, вращение точки
```ts
export function msToFrames(ms: number, fps: number): number { return Math.round((ms / 1000) * fps); }
export function framesToMs(frames: number, fps: number): number { return (frames / fps) * 1000; }
export function snapToGrid(ms: number, gridMs: number): number { return Math.round(ms / gridMs) * gridMs; }
export function applyTransformMatrix(ctx: CanvasRenderingContext2D, t: Transform) {
  const { x, y, scaleX, scaleY, rotation, anchorX, anchorY } = t;
  ctx.translate(x + anchorX, y + anchorY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-anchorX, -anchorY);
}
```
- Интеграция: Renderer заменяет свою локальную математику трансформа на `applyTransformMatrix`

### 3) Ajv-схема как ориентир
- Во 2-й версии уже есть `SchemaValidator`. Сверить поля со схемой SONET:
  - Проверка `blendMode` enum
  - Наличие `trackId` в клипах
  - Диапазоны `opacity`, размеры, fps
- Итог: обновить `validation/SchemaValidator.ts` так, чтобы Ajv ловил несоответствия, а `migrateTemplate()` добавлял недостающие дефолты (anchorX/anchorY и т.п.)

### 4) Горячие клавиши (объединить)
- Из SONET взять базовые: Space, J/K/L, +/- (zoom), Delete, Ctrl/Cmd+Z / Shift+Z
- Во 2-й версии добавить: G/U (group/ungroup), box-select, zoom-to-cursor (поддерживается `TimelineController.zoomToCursor`)

### 5) Стили (скелет)
- Из SONET взять компоновку и базовую палитру как стартовые токены (учесть текущие классы OPUS)
- Цель: не менять DOM-структуру OPUS, только переиспользовать переменные/высоты дорожек/цвета

## Что оставить из OPUS v2 (ядро)

- `core/Timekeeper.ts`: rAF‑луп, playbackRate, loop, события play/pause/tick/ended
- `core/Renderer.ts`: offscreen/canvas, createImageBitmap, requestVideoFrameCallback, маппинг blendMode
- `timeline/TimelineController.ts`: снап (grid/frame/marker/clip‑edge), box‑selection, авто‑скролл, групповая логика
- `effects/EffectsProcessor.ts`: fadeIn/out, blur/brightness/contrast/saturation/dropShadow (перевести на реюз одного процессора, см. ниже)
- `keyframes/KeyframeInterpolator.ts`: easing + интерполяция transform/opacity
- `subtitles/SubtitleManager.ts`: SRT парсер/экспорт/валидация/рендер текста
- `validation/SchemaValidator.ts`: Ajv + миграции версий
- `state/HistoryManager.ts`: лимиты по шагам/памяти, исключения seek/zoom/select

## Точечные задачи (с примерами кода)

### A) Реюзировать EffectsProcessor (не создавать на каждый кадр)
До:
```ts
export function applyEffects(source, effects, time, interpolated) {
  const processor = new EffectsProcessor();
  return processor.applyEffects(source, effects, time, 10000, interpolated);
}
```
После (singleton):
```ts
let processor: EffectsProcessor | null = null;
export function applyEffects(source, effects, time, duration, interpolated) {
  if (!processor) processor = new EffectsProcessor();
  return processor.applyEffects(source, effects, time, duration, interpolated);
}
```

### B) Ajv‑валидация при importJSON
```ts
import { SchemaValidator } from './validation/SchemaValidator';
const validator = new SchemaValidator();

function importJSON(json: string) {
  const tpl = JSON.parse(json);
  const migrated = validator.migrateTemplate(tpl);
  const res = validator.validateTemplate(migrated);
  if (!res.valid) throw new Error('Template validation failed');
  setTemplate(migrated);
}
```

### C) Zoom к курсору в таймлайне (UX)
```ts
function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const { zoom, scroll } = timelineController.zoomToCursor(delta, e.clientX, containerWidth);
    setTimelineZoom(zoom); setTimelineScroll(scroll);
  }
}
```

### D) Blend‑mode маппинг (не прямое присваивание)
```ts
const MAP: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten', 'color-dodge': 'color-dodge', 'color-burn': 'color-burn',
  'hard-light': 'hard-light', 'soft-light': 'soft-light', difference: 'difference', exclusion: 'exclusion'
};
ctx.globalCompositeOperation = MAP[clip.blendMode] || 'source-over';
```

### E) История: не писать шумные действия
- Не пушить в историю: seek/zoom/scroll/selection
- Пушить: add/move/resize clip, track props, effects/keyframes, импорт/экспорт

## Чек‑лист приёмки
- Предпросмотр: 30fps стабильно на 50+ клипах; без рывков видео; правильный seek/loop
- Таймлайн: зум к курсору; снап к кадрам/сетке/маркерам/краям; автоскролл при drag
- Эффекты/кейфреймы: линейка и easing заметны; порядок эффектов соблюдён; blur/brightness и пр. применяются
- Субтитры: импорт/экспорт SRT ↔ без перекрытий; стили сохраняются; позиционирование в превью
- Валидация: importJSON валидирует и мигрирует; ошибки показываются в UI (toast/log)
- История: undo/redo быстрые, лимиты соблюдены; seek/zoom не засоряют истории
- API: совместимость `mountEditor` сохранена; демо показывает сценарии drag/resize/effects/subtitles/import/export

## Что сдать
- Обновлённые исходники, демо `/apps/demo`, README с API
- Ajv‑схема + миграции, 2–3 примера JSON шаблонов, 1–2 SRT
- Скрипты: `dev`, `build`, `test`, `preview`
- Краткий отчёт: что перенесено из SONET (списком) и где используется

## Важно
- Не менять публичный API и имена основных файлов ядра OPUS v2
- Не добавлять внешние трекеры/телеметрию; без сетевых вызовов кроме загрузки ассетов
- Соблюдать CORS для видео ассетов; обеспечивать graceful fallback