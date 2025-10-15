# 🔌 N8N API Документация - FantaProjekt

## 📋 Оглавление
1. [Обзор API](#обзор-api)
2. [Основной Endpoint](#основной-endpoint)
3. [Структура JSON](#структура-json)
4. [Все Параметры и Опции](#все-параметры-и-опции)
5. [Примеры для N8N](#примеры-для-n8n)
6. [Дополнительные Endpoints](#дополнительные-endpoints)

---

## 🎯 Обзор API

**FantaProjekt** - это REST API для автоматического создания коротких видео (TikTok, Reels, Shorts).

**Base URL:** `http://localhost:3123/api`

**Основной метод:** `POST /api/short-video`

---

## 🚀 Основной Endpoint

### POST /api/short-video

Создает короткое видео на основе сцен и конфигурации.

**URL:** `http://localhost:3123/api/short-video`

**Method:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Response (успех):**
```json
{
  "videoId": "cuid_generated_id"
}
```

**Response (ошибка валидации):**
```json
{
  "error": "Validation failed",
  "message": "Validation failed for 2 field(s): scenes, config.voice",
  "missingFields": {
    "scenes": "Required",
    "config.voice": "Invalid enum value"
  }
}
```

---

## 📦 Структура JSON

### Минимальный Валидный JSON

```json
{
  "scenes": [
    {
      "text": "Your text here",
      "searchTerms": ["keyword1", "keyword2"]
    }
  ],
  "config": {
    "voice": "af_sarah"
  }
}
```

### Полная Структура

```json
{
  "scenes": [
    {
      "text": "string (обязательно)",
      "searchTerms": ["array", "of", "strings"] | null,
      "media": {
        "type": "pexels" | "url" | "files",
        "searchTerms": ["..."] | null,
        "urls": ["..."] | null,
        "files": [{...}] | null
      } | null,
      "effects": [
        {
          "type": "blend",
          "overlayUrl": "string",
          "overlayFile": {...},
          "blendMode": "normal" | "screen" | "multiply" | "overlay" | "add",
          "opacity": 0.0 - 1.0,
          "duration": "full" | { "start": number, "end": number }
        }
      ] | null,
      "textOverlays": [
        {
          "text": "string",
          "position": {
            "x": "left" | "center" | "right" | number,
            "y": "top" | "center" | "bottom" | number
          },
          "style": {
            "fontSize": number,
            "fontFamily": "string",
            "color": "string",
            "backgroundColor": "string",
            "padding": number,
            "opacity": 0.0 - 1.0
          },
          "animation": "fadeIn" | "slideIn" | "typewriter" | "bounce" | "pulse" | "none",
          "timing": {
            "start": number,
            "end": number
          }
        }
      ] | null
    }
  ],
  "config": {
    "voice": "голос из списка (обязательно)",
    "orientation": "portrait" | "landscape",
    "music": "музыкальное настроение",
    "musicVolume": "muted" | "low" | "medium" | "high",
    "captionPosition": "top" | "center" | "bottom",
    "captionBackgroundColor": "CSS цвет",
    "paddingBack": number
  }
}
```

---

## 🔧 Все Параметры и Опции

### 1. Scenes (Сцены) - ОБЯЗАТЕЛЬНО

Массив объектов сцен. Минимум 1 сцена.

#### Scene Object:

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `text` | string | ✅ Да | Текст для озвучки |
| `searchTerms` | string[] | ⚠️ Да* | Legacy формат - поисковые термины Pexels |
| `media` | MediaSource | ⚠️ Да* | Новый формат - источник медиа |
| `effects` | Effect[] | ❌ Нет | Визуальные эффекты |
| `textOverlays` | TextOverlay[] | ❌ Нет | Текстовые оверлеи |

**\*Важно:** Нужно указать ЛИБО `searchTerms` ЛИБО `media`!

---

### 2. Media Source (Источник Медиа)

Три типа источников:

#### A) Pexels (поиск видео)
```json
{
  "type": "pexels",
  "searchTerms": ["ocean", "sunset", "beach"]
}
```

#### B) URL (скачивание с интернета)
```json
{
  "type": "url",
  "urls": [
    "https://example.com/video.mp4",
    "https://example.com/photo.jpg"
  ]
}
```

**Поддерживаемые форматы:**
- Видео: MP4, MOV, AVI, WebM
- Изображения: JPG, PNG, WebP
- Максимальный размер: 500 MB

#### C) Files (прямая загрузка)
```json
{
  "type": "files",
  "files": [
    {
      "filename": "myvideo.mp4",
      "data": "base64_string_or_buffer",
      "mimeType": "video/mp4"
    }
  ]
}
```

---

### 3. Effects (Эффекты)

Массив визуальных эффектов (blend overlays).

```json
{
  "type": "blend",
  "overlayUrl": "https://example.com/fire.mp4",
  "blendMode": "screen",
  "opacity": 0.7,
  "duration": "full"
}
```

| Параметр | Тип | Значения | Описание |
|----------|-----|----------|----------|
| `type` | string | "blend" | Тип эффекта |
| `overlayUrl` | string | URL | URL оверлея (опционально) |
| `overlayFile` | FileUpload | {...} | Прямая загрузка (опционально) |
| `blendMode` | string | normal, screen, multiply, overlay, add | Режим смешивания |
| `opacity` | number | 0.0 - 1.0 | Прозрачность |
| `duration` | string/object | "full" или {start: 0, end: 5} | Длительность эффекта |

**Blend Modes:**
- `normal` - обычное наложение
- `screen` - осветление (для огня, света)
- `multiply` - затемнение
- `overlay` - комбинированный
- `add` - сложение цветов

---

### 4. Text Overlays (Текстовые Оверлеи)

Массив текстовых наложений.

```json
{
  "text": "BREAKING NEWS",
  "position": {
    "x": "center",
    "y": "top"
  },
  "style": {
    "fontSize": 48,
    "fontFamily": "Impact",
    "color": "#FF0000",
    "backgroundColor": "#000000",
    "padding": 15,
    "opacity": 0.9
  },
  "animation": "fadeIn",
  "timing": {
    "start": 0,
    "end": 3
  }
}
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `text` | string | Текст для отображения |
| `position.x` | string/number | "left", "center", "right" или пиксели |
| `position.y` | string/number | "top", "center", "bottom" или пиксели |
| `style.fontSize` | number | Размер шрифта в пикселях |
| `style.fontFamily` | string | Название шрифта |
| `style.color` | string | CSS цвет текста |
| `style.backgroundColor` | string | CSS цвет фона |
| `style.padding` | number | Отступ в пикселях |
| `style.opacity` | number | Прозрачность (0.0 - 1.0) |
| `animation` | string | Тип анимации |
| `timing.start` | number | Начало в секундах |
| `timing.end` | number | Конец в секундах |

**Анимации:**
- `fadeIn` - плавное появление
- `slideIn` - скольжение снизу
- `typewriter` - печатная машинка
- `bounce` - прыгающий эффект
- `pulse` - пульсация
- `none` - без анимации

---

### 5. Config (Конфигурация) - ОБЯЗАТЕЛЬНО

| Параметр | Тип | Обязательно | Значения | Описание |
|----------|-----|-------------|----------|----------|
| `voice` | string | ✅ Да | См. список голосов | Голос для озвучки |
| `orientation` | string | ❌ Нет | "portrait", "landscape" | Ориентация видео |
| `music` | string | ❌ Нет | См. список настроений | Фоновая музыка |
| `musicVolume` | string | ❌ Нет | "muted", "low", "medium", "high" | Громкость музыки |
| `captionPosition` | string | ❌ Нет | "top", "center", "bottom" | Позиция субтитров |
| `captionBackgroundColor` | string | ❌ Нет | CSS цвет | Цвет фона субтитров |
| `paddingBack` | number | ❌ Нет | миллисекунды | Задержка после озвучки |

---

### 6. Доступные Голоса (Voices)

72+ голоса Kokoro TTS:

**Женские (American):**
- `af_heart`, `af_alloy`, `af_aoede`, `af_bella`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky`

**Мужские (American):**
- `am_adam`, `am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx`, `am_puck`, `am_santa`

**Женские (British):**
- `bf_emma`, `bf_isabella`, `bf_alice`, `bf_lily`

**Мужские (British):**
- `bm_george`, `bm_lewis`, `bm_daniel`, `bm_fable`

**Получить список:** `GET /api/voices`

---

### 7. Музыкальные Настроения (Music Moods)

12 настроений:

- `sad` - грустная
- `melancholic` - меланхоличная
- `happy` - радостная
- `euphoric/high` - эйфоричная
- `excited` - возбужденная
- `chill` - спокойная
- `uneasy` - тревожная
- `angry` - гневная
- `dark` - темная
- `hopeful` - надежда
- `contemplative` - созерцательная
- `funny/quirky` - смешная/странная

**Получить список:** `GET /api/music-tags`

---

## 💡 Примеры для N8N

### Пример 1: Простое Видео (Legacy)

```json
{
  "scenes": [
    {
      "text": "Добро пожаловать на наш канал! Подписывайтесь, чтобы не пропустить новые видео!",
      "searchTerms": ["welcome", "hello", "intro"]
    }
  ],
  "config": {
    "orientation": "portrait",
    "voice": "af_sarah",
    "music": "happy",
    "musicVolume": "low",
    "captionPosition": "bottom"
  }
}
```

### Пример 2: Видео с URL

```json
{
  "scenes": [
    {
      "text": "Смотрите это невероятное видео!",
      "media": {
        "type": "url",
        "urls": ["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"]
      }
    }
  ],
  "config": {
    "orientation": "landscape",
    "voice": "am_adam",
    "music": "excited",
    "musicVolume": "medium"
  }
}
```

### Пример 3: С Эффектами и Текстом

```json
{
  "scenes": [
    {
      "text": "Эпический игровой момент!",
      "media": {
        "type": "pexels",
        "searchTerms": ["gaming", "action"]
      },
      "effects": [
        {
          "type": "blend",
          "overlayUrl": "https://example.com/fire-effect.mp4",
          "blendMode": "screen",
          "opacity": 0.6,
          "duration": "full"
        }
      ],
      "textOverlays": [
        {
          "text": "LEGENDARY!",
          "position": {
            "x": "center",
            "y": "top"
          },
          "style": {
            "fontSize": 64,
            "fontFamily": "Impact",
            "color": "#FFD700",
            "backgroundColor": "#000000AA",
            "padding": 20
          },
          "animation": "bounce",
          "timing": {
            "start": 0.5,
            "end": 3
          }
        }
      ]
    }
  ],
  "config": {
    "orientation": "portrait",
    "voice": "am_michael",
    "music": "dark",
    "musicVolume": "medium"
  }
}
```

### Пример 4: Несколько Сцен (Смешанные Источники)

```json
{
  "scenes": [
    {
      "text": "Первая сцена из Pexels",
      "media": {
        "type": "pexels",
        "searchTerms": ["city", "urban", "night"]
      }
    },
    {
      "text": "Вторая сцена с вашим видео",
      "media": {
        "type": "url",
        "urls": ["https://example.com/custom-video.mp4"]
      }
    },
    {
      "text": "Третья сцена снова из Pexels",
      "searchTerms": ["nature", "forest"]
    }
  ],
  "config": {
    "orientation": "portrait",
    "voice": "af_bella",
    "music": "contemplative",
    "musicVolume": "low",
    "captionPosition": "bottom"
  }
}
```

### Пример 5: Максимально Полный (Все Функции)

```json
{
  "scenes": [
    {
      "text": "Добро пожаловать в наш потрясающий канал!",
      "media": {
        "type": "pexels",
        "searchTerms": ["welcome", "celebration", "confetti"]
      },
      "effects": [
        {
          "type": "blend",
          "overlayUrl": "https://example.com/particles.mp4",
          "blendMode": "screen",
          "opacity": 0.5,
          "duration": "full"
        },
        {
          "type": "blend",
          "overlayUrl": "https://example.com/light-leak.mp4",
          "blendMode": "overlay",
          "opacity": 0.3,
          "duration": {
            "start": 1,
            "end": 4
          }
        }
      ],
      "textOverlays": [
        {
          "text": "ПОДПИСЫВАЙТЕСЬ!",
          "position": {
            "x": "center",
            "y": "top"
          },
          "style": {
            "fontSize": 56,
            "fontFamily": "Impact",
            "color": "#FFFFFF",
            "backgroundColor": "#FF0000",
            "padding": 20,
            "opacity": 0.95
          },
          "animation": "bounce",
          "timing": {
            "start": 0.5,
            "end": 2.5
          }
        },
        {
          "text": "👇 Жми на колокольчик",
          "position": {
            "x": "center",
            "y": "bottom"
          },
          "style": {
            "fontSize": 36,
            "color": "#FFD700",
            "padding": 15
          },
          "animation": "fadeIn",
          "timing": {
            "start": 2,
            "end": 5
          }
        }
      ]
    },
    {
      "text": "Смотрите наш эксклюзивный контент прямо сейчас!",
      "media": {
        "type": "url",
        "urls": ["https://example.com/promo-video.mp4"]
      },
      "textOverlays": [
        {
          "text": "ЭКСКЛЮЗИВ",
          "position": {
            "x": "right",
            "y": 100
          },
          "style": {
            "fontSize": 48,
            "color": "#00FF00",
            "backgroundColor": "#000000CC",
            "padding": 10
          },
          "animation": "pulse"
        }
      ]
    }
  ],
  "config": {
    "orientation": "portrait",
    "voice": "af_sarah",
    "music": "euphoric/high",
    "musicVolume": "medium",
    "captionPosition": "bottom",
    "captionBackgroundColor": "#0000FF",
    "paddingBack": 1500
  }
}
```

---

## 📡 Дополнительные Endpoints

### 1. Проверка Статуса Видео

**GET** `/api/short-video/:videoId/status`

**Response:**
```json
{
  "status": "processing" | "ready" | "failed"
}
```

### 2. Скачать Видео

**GET** `/api/short-video/:videoId`

**Response:** MP4 file

### 3. Список Голосов

**GET** `/api/voices`

**Response:**
```json
[
  "af_heart",
  "af_alloy",
  "af_aoede",
  // ... все голоса
]
```

### 4. Список Музыкальных Тегов

**GET** `/api/music-tags`

**Response:**
```json
[
  "sad",
  "melancholic",
  "happy",
  // ... все теги
]
```

### 5. Список Всех Видео

**GET** `/api/short-videos`

**Response:**
```json
{
  "videos": [
    {
      "id": "video_id",
      "status": "ready",
      "createdAt": "timestamp"
    }
  ]
}
```

### 6. Удалить Видео

**DELETE** `/api/short-video/:videoId`

**Response:**
```json
{
  "success": true
}
```

---

## 🔄 Workflow для N8N

### Типичный Flow:

1. **HTTP Request Node** → POST `/api/short-video`
   - Body: JSON с scenes и config
   - Получить `videoId`

2. **Wait/Delay Node** → Подождать обработку

3. **HTTP Request Node** → GET `/api/short-video/:videoId/status`
   - Проверить статус
   - Если "processing" → повторить через 5-10 сек

4. **HTTP Request Node** → GET `/api/short-video/:videoId`
   - Скачать готовое видео
   - Сохранить или отправить дальше

### N8N HTTP Request Node - Настройки:

```
Method: POST
URL: http://localhost:3123/api/short-video
Authentication: None
Body Content Type: JSON
Body:
{
  "scenes": [...],
  "config": {...}
}
```

---

## ⚠️ Важные Замечания

### Валидация:

1. **Обязательно указать `text` в каждой сцене**
2. **Обязательно указать ЛИБО `searchTerms` ЛИБО `media`**
3. **Обязательно указать `voice` в config**
4. **URLs должны быть валидными HTTP/HTTPS**
5. **Blend modes - только из списка**
6. **Opacity - от 0.0 до 1.0**

### Лимиты:

- Максимальный размер загружаемого файла: **500 MB**
- Поддерживаемые форматы видео: MP4, MOV, AVI, WebM
- Поддерживаемые форматы изображений: JPG, PNG, WebP

### Обратная Совместимость:

✅ **100% обратная совместимость** - все старые запросы с `searchTerms` продолжают работать!

---

## 🎯 Быстрая Шпаргалка для N8N

### Минимальный запрос:
```json
{
  "scenes": [{"text": "...", "searchTerms": ["..."]}],
  "config": {"voice": "af_sarah"}
}
```

### С эффектами:
```json
{
  "scenes": [{
    "text": "...",
    "media": {"type": "pexels", "searchTerms": ["..."]},
    "effects": [{"type": "blend", "overlayUrl": "...", "blendMode": "screen", "opacity": 0.7}]
  }],
  "config": {"voice": "af_sarah", "orientation": "portrait"}
}
```

### С текстом:
```json
{
  "scenes": [{
    "text": "...",
    "searchTerms": ["..."],
    "textOverlays": [{
      "text": "...",
      "position": {"x": "center", "y": "top"},
      "style": {"fontSize": 48, "color": "#FF0000"},
      "animation": "fadeIn"
    }]
  }],
  "config": {"voice": "af_sarah"}
}
```

---

## 📞 Поддержка

- **Порт по умолчанию:** 3123
- **Логи:** Все запросы логируются в консоль
- **Ошибки:** Возвращаются с детальным описанием

**Версия:** 2.0.0  
**Дата:** Октябрь 2025  
**Статус:** ✅ Production Ready

---

**FantaProjekt Team** © 2025

