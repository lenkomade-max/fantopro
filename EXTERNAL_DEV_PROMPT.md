### ТЗ / Промпт для внешнего разработчика (скопируй и делай по нему)

Цель: сделать изолированный модуль “Конструктор видео‑шаблонов” (UI+логика) как отдельный репозиторий, без доступа к нашему коду. Модуль сразу встраивается по единому API и идёт с демо.

#### Что нужно реализовать
- Таймлайн‑редактор: дорожки `video|audio|overlay|subtitle`, клипы, зум/скролл, снап к кадрам/маркерам, drag/resize, рамочное выделение, контекстное меню.
- Предпросмотр (real‑time): play/pause/seek, трансформы (x,y,scale,rotation), opacity, blend‑режимы (normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion).
- Ручное позиционирование в предпросмотре: drag/resize/rotate для overlay/subtitle.
- Эффекты + кейфреймы: минимум `fadeIn`, `fadeOut`, `opacity`, `position`, `scale`, `rotation`.
- Субтитры: импорт/экспорт SRT; позиционирование мышью; стили (шрифт/размер/цвет/обводка/тень/выравнивание/интерлиньяж).
- Шаблоны: CRUD, версии, теги, дубликат; импорт/экспорт JSON; валидация по JSON‑схеме; применение шаблона к новому видео с заменой ассетов/озвучки/субтитров/переменных при сохранении таймингов и эффектов.
- Ассеты: локальный импорт с проверкой URL/MIME/размера/длительности/разрешения; waveform для аудио.
- Хоткеи: Space, J/K/L, +/-, G/U, Ctrl/Cmd+D, Delete, Ctrl/Cmd+S, Ctrl/Cmd+Z / Shift+Z, Shift+drag.
- Производительность: 60fps UI, ~30fps предпросмотр на среднем ноутбуке; виртуализация элементов, батчинг стейта.

#### Публичный API (единственная точка входа)
Файл: `/packages/template-editor/index.ts`
- `mountEditor(el: HTMLElement, options: EditorOptions): EditorHandle`
  - EditorOptions:
    - `initialTemplate?: Template`
    - `assetResolver?: (assetId: string) => string | Promise<string>`
    - `onChange?: (template: Template) => void`
    - `onEvent?: (event: EditorEvent) => void` // 'selectionChanged'|'templateChanged'|'assetMissing'|'validationError'|'playbackTick'|'exportRequested'
    - `readOnly?: boolean`
    - `playbackConfig?: { fps?: number; resolution?: { width: number; height: number } }`
    - `locale?: string`
  - EditorHandle:
    - `destroy()`, `getTemplate()`, `setTemplate(t)`, `exportJSON()`, `importJSON(json)`,
      `loadAssets(list: Asset[])`, `focusClip(id)`, `play()`, `pause()`, `seek(ms)`

Пример встраивания (мы так подключим):
```ts
import { mountEditor } from '@template-editor';
const handle = mountEditor(document.getElementById('editor')!, {
  initialTemplate,
  assetResolver: id => `/assets/${id}`,
  onChange: t => console.log('changed', t),
});
```

#### Формат данных (суммарно)
- `Template`: `{ id, name, fps, width, height, durationMs, tracks: Track[], assets: Asset[], variables?: Record<string, any> }`
- `Track`: `{ id, type: 'video'|'audio'|'overlay'|'subtitle', clips: Clip[], muted?, locked?, hidden?, zIndex? }`
- `Clip`: `{ id, assetId, startMs, endMs, inMs?, outMs?, transform?: { x,y,scaleX,scaleY,rotation,anchorX,anchorY }, opacity?, blendMode?, effects?: Effect[], keyframes?: Keyframe[], metadata? }`
- `Asset`: `{ id, kind: 'video'|'audio'|'image'|'vector'|'generated', src, mime, durationMs?, width?, height?, waveform?, hash? }`
- `Effect`: `{ id, type: string, params?: Record<string, number|string|boolean> }`
- `Keyframe`: `{ id, timeMs, prop: string, value: number|string|boolean, easing?: string }`
- SRT cue: `{ id, text, startMs, endMs, style?, box? }`

JSON‑схема должна быть в проекте: `/packages/template-editor/serialization/schema.ts` и применяться при импорте/экспорте.

#### Структура репозитория (минимум, абсолютные пути внутри модуля)
- `/packages/template-editor/index.ts` — публичный API.
- `/packages/template-editor/App.tsx` — корневой компонент (layout, хоткеи).
- `/packages/template-editor/config/editorConfig.ts` — константы (fps, grid, snap).
- `/packages/template-editor/state/store.ts` — глобальный стейт (templates/tracks/clips/selection/playback/history).
- `/packages/template-editor/state/history.ts` — undo/redo.
- `/packages/template-editor/timeline/Timeline.tsx` — таймлайн (скейл/маркеры/плейхед).
- `/packages/template-editor/timeline/TrackLane.tsx` — дорожка (рендер клипов, drag/resize).
- `/packages/template-editor/timeline/ClipItem.tsx` — клип на таймлайне.
- `/packages/template-editor/preview/PreviewCanvas.tsx` — предпросмотр (Canvas/WebGL, трансформы, blend).
- `/packages/template-editor/preview/OverlayHandles.tsx` — drag/resize/rotate в превью.
- `/packages/template-editor/subtitles/SubtitleEditor.tsx` — субтитры (cue, стили, позиция, SRT импорт/экспорт).
- `/packages/template-editor/panels/Inspector.tsx` — свойства клипа/эффектов/трансформов.
- `/packages/template-editor/panels/AssetsPanel.tsx` — ассеты (импорт, валидация, метаданные).
- `/packages/template-editor/panels/TemplatesPanel.tsx` — шаблоны (CRUD/версии/теги/дубликат).
- `/packages/template-editor/effects/effectsRegistry.ts` — реестр эффектов и UI редактирования.
- `/packages/template-editor/effects/runtime.ts` — применение эффектов/блендинга в превью.
- `/packages/template-editor/shortcuts/shortcuts.ts` — хоткеи.
- `/packages/template-editor/serialization/schema.ts` — JSON‑схема.
- `/packages/template-editor/serialization/io.ts` — импорт/экспорт шаблонов/ассетов/SRT.
- `/packages/template-editor/utils/time.ts` — ms↔frames, снап.
- `/packages/template-editor/utils/geometry.ts` — трансформы/якоря.
- `/packages/template-editor/styles/*.css` — стили.
- `/apps/demo/index.html` и `/apps/demo/main.tsx` — демо (монтирование, мок‑данные).

#### Стек и ограничения
- React 18+, TypeScript, Vite; Zustand/Jotai или Redux Toolkit.
- Preview: Canvas/WebGL; drag: `react-rnd` или `interactjs`.
- Без реального бэкенда: только интерфейсы и мок‑слой (localStorage/IndexedDB).
- Никаких внешних сетевых вызовов/телеметрии, не менять окружения/порты.

#### Критерии приёмки (коротко)
- Плавный предпросмотр, корректные drag/resize/rotate (таймлайн и превью).
- Экспорт/импорт шаблона без потерь + валидация по JSON‑схеме.
- Применение шаблона к новому видео с заменой ассетов/озвучки/субтитров/переменных при сохранении таймингов/эффектов.
- Стабильный undo/redo.

#### Скрипты и демо
- Скрипты: `dev`, `build`, `test`.
- Демо должно показать: таймлайн, предпросмотр, манипуляторы, эффекты, субтитры, импорт/экспорт, шаблоны.

Если чего‑то не хватает для старта — задавай вопросы прямо в Issue репозитория.