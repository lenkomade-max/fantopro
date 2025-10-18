# 🎨 FFmpeg Overlay & Chromakey Guide

**Версия**: 2.0.0
**Дата**: 18.10.2025
**Технология**: FFmpeg Post-Processing

---

## 📖 Содержание

1. [Обзор](#обзор)
2. [Blend Overlays (Наложение эффектов)](#blend-overlays)
3. [Chromakey Banners (Зелёный экран)](#chromakey-banners)
4. [Технические детали](#технические-детали)
5. [Примеры использования](#примеры-использования)
6. [Troubleshooting](#troubleshooting)

---

## Обзор

FantaProjekt использует **FFmpeg post-processing** для применения визуальных эффектов ПОСЛЕ рендеринга базового видео в Remotion.

### Архитектура

```
Remotion Render (базовое видео)
    ↓
FFmpeg Blend Overlay #1
    ↓
FFmpeg Blend Overlay #2 (если есть)
    ↓
FFmpeg Chromakey Banner (если есть)
    ↓
Финальное видео
```

### Преимущества

✅ **Правильное наложение** - RGB color space (format=gbrp) для точного blend
✅ **Никакой путаницы** - один способ применения эффектов
✅ **Полная совместимость** - работает с любыми видео форматами
✅ **Chromakey поддержка** - зелёный экран (green screen) баннеры

---

## Blend Overlays

### Что это?

Blend overlays накладывают видео эффект (VHS, снег, блики) поверх основного видео с использованием математических blend modes.

### Поддерживаемые Blend Modes

| Режим | Описание | Лучше для |
|-------|----------|-----------|
| `addition` | Сложение цветов | Яркие блики, световые эффекты |
| `overlay` | Комбинация multiply и screen | Универсальный, VHS эффекты |
| `multiply` | Умножение (затемняет) | Тени, виньетка |
| `screen` | Осветление | Мягкие блики |
| `dodge` | Цветовое осветление | Драматические блики |
| `burn` | Цветовое затемнение | Контрастные тени |
| `darken` | Оставляет более тёмный | Наложение тёмных элементов |
| `lighten` | Оставляет более светлый | Наложение ярких элементов |
| `difference` | Разница цветов | Психоделические эффекты |
| `exclusion` | Мягкая разница | Тонкие цветовые сдвиги |
| `negation` | Инверсия | Абстрактные эффекты |
| `phoenix` | Особая формула | Уникальные эффекты |

### Формат эффекта

```json
{
  "type": "blend",
  "staticEffectPath": "effects/VHS_01_small.mp4",
  "blendMode": "addition",
  "opacity": 0.5,
  "duration": "full"
}
```

### Параметры

- **`type`**: `"blend"` (обязательно)
- **`staticEffectPath`**: путь к эффекту в `static/effects/` (обязательно)
- **`blendMode`**: один из режимов выше (обязательно)
- **`opacity`**: прозрачность 0.0 (невидимо) до 1.0 (100%) (обязательно)
- **`duration`**: `"full"` или `{"start": 0.5, "end": 3.0}` (опционально)

### Пример: VHS эффект

```json
{
  "scenes": [{
    "text": "Amazing vintage video",
    "media": {
      "type": "url",
      "urls": ["https://example.com/video.mp4"]
    },
    "effects": [{
      "type": "blend",
      "staticEffectPath": "effects/VHS_01_small.mp4",
      "blendMode": "addition",
      "opacity": 0.4,
      "duration": "full"
    }]
  }]
}
```

---

## Chromakey Banners

### Что это?

Chromakey позволяет удалить зелёный фон (#00FF00) из баннера и наложить его поверх видео.

### Формат эффекта

```json
{
  "type": "banner_overlay",
  "staticBannerPath": "banner/greenscreenBanner.mp4",
  "chromakey": {
    "color": "0x00FF00",
    "similarity": 0.4,
    "blend": 0.1
  },
  "position": { "x": 0, "y": 0 }
}
```

### Параметры

- **`type`**: `"banner_overlay"` (обязательно)
- **`staticBannerPath`**: путь к баннеру в `static/banner/` (обязательно)
- **`chromakey`**: настройки удаления зелёного фона
  - **`color`**: `"0x00FF00"` (зелёный) или другой hex-код
  - **`similarity`**: 0.0-1.0, насколько похожие цвета удалять (рекомендуется 0.3-0.5)
  - **`blend`**: 0.0-1.0, мягкость краёв (рекомендуется 0.1-0.3)
- **`position`**: позиция баннера на экране
  - **`x`**: 0 = слева, можно указать пиксели
  - **`y`**: 0 = сверху, можно указать пиксели

### Пример: Баннер в верхнем углу

```json
{
  "scenes": [{
    "text": "Check out our product",
    "searchTerms": ["technology"],
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

## Технические детали

### FFmpeg Blend Command

```bash
ffmpeg -i base_video.mp4 -i overlay_video.mp4 -y \
  -filter_complex "
    [0:v]format=gbrp[base];
    [1:v]scale=1080:1920,format=gbrp,loop=loop=0:size=32767[overlay];
    [base][overlay]blend=all_mode='addition':all_opacity=0.5:shortest=1,format=yuv420p[out]
  " \
  -map "[out]" output.mp4
```

**Ключевые моменты:**
- `format=gbrp` - RGB color space для точного blend
- `loop=loop=0:size=32767` - правильный loop overlay видео
- `shortest=1` - остановка когда базовое видео заканчивается
- `all_mode='addition'` - blend mode
- `all_opacity=0.5` - opacity (0.0-1.0)

### FFmpeg Chromakey Command

```bash
ffmpeg -i base_video.mp4 -i banner_video.mp4 -y \
  -filter_complex "
    [1:v]chromakey=0x00FF00:0.4:0.1[banner];
    [0:v][banner]overlay=0:0[out]
  " \
  -map "[out]" output.mp4
```

**Ключевые моменты:**
- `chromakey=0x00FF00:0.4:0.1` - цвет:similarity:blend
- `overlay=0:0` - позиция x:y

### Производительность

- **Blend overlay**: ~15-30 секунд обработки
- **Chromakey overlay**: ~20-40 секунд обработки
- **Несколько эффектов**: последовательная обработка (сумма времени)

---

## Примеры использования

### Пример 1: Простой VHS эффект

```json
{
  "scenes": [{
    "text": "Retro vibes",
    "searchTerms": ["neon", "city"],
    "effects": [{
      "type": "blend",
      "staticEffectPath": "effects/VHS_01_small.mp4",
      "blendMode": "overlay",
      "opacity": 0.6
    }]
  }],
  "config": {
    "voice": "af_heart",
    "orientation": "portrait"
  }
}
```

### Пример 2: Два эффекта + баннер

```json
{
  "scenes": [{
    "text": "Ultimate visual experience",
    "media": {
      "type": "url",
      "urls": ["https://example.com/video.mp4"]
    },
    "effects": [
      {
        "type": "blend",
        "staticEffectPath": "effects/VHS_01_small.mp4",
        "blendMode": "addition",
        "opacity": 0.5
      },
      {
        "type": "banner_overlay",
        "staticBannerPath": "banner/greenscreenBanner.mp4",
        "chromakey": {
          "color": "0x00FF00",
          "similarity": 0.4,
          "blend": 0.1
        },
        "position": { "x": 0, "y": 0 }
      }
    ]
  }]
}
```

### Пример 3: Частичное применение эффекта

```json
{
  "scenes": [{
    "text": "Effect appears mid-scene",
    "searchTerms": ["waves"],
    "effects": [{
      "type": "blend",
      "staticEffectPath": "effects/VHS_01_small.mp4",
      "blendMode": "screen",
      "opacity": 0.7,
      "duration": {
        "start": 2.0,
        "end": 5.0
      }
    }]
  }]
}
```

---

## Troubleshooting

### Эффект не применяется

**Проблема**: Эффект не виден в финальном видео
**Решение**:
1. Проверьте логи на наличие `"Starting FFmpeg post-processing"`
2. Убедитесь что `staticEffectPath` правильный
3. Проверьте что файл эффекта существует в `static/effects/`

### Эффект слишком яркий/тёмный

**Проблема**: Эффект перекрывает основное видео
**Решение**:
- Уменьшите `opacity` (попробуйте 0.3-0.5)
- Попробуйте другой `blendMode` (например, `overlay` вместо `addition`)

### Chromakey оставляет зелёные края

**Проблема**: Видны остатки зелёного фона
**Решение**:
- Увеличьте `similarity` (0.4 → 0.5)
- Увеличьте `blend` для мягких краёв (0.1 → 0.2)

### Долгая обработка

**Проблема**: Видео рендерится более 3 минут
**Решение**:
- Используйте не более 2-3 эффектов на сцену
- Убедитесь что overlay видео короткое (loop автоматически)
- Проверьте логи FFmpeg на зависание

---

## 🚀 Best Practices

1. **Начинайте с малого** - тестируйте с одним эффектом
2. **Используйте правильные blend modes** - каждый подходит для своих задач
3. **Не перегружайте** - более 3 эффектов = долгая обработка
4. **Тестируйте chromakey** - similarity и blend зависят от качества зелёного фона
5. **Кэшируйте эффекты** - OverlayCache автоматически сохраняет скачанные эффекты

---

**FantaProjekt Team** © 2025
