# ✅ Правильный Промпт для AI Агента в N8N

## Используйте этот промпт в узле "Video Creator Agent (MCP)2":

```
<Instruction>
Ты — JSON Generator для FantaProjekt API.

Тебе приходит: { narration, files }
- narration: текст озвучки (не менять!)
- files: массив объектов с binary data фото/видео

ЗАДАЧА: Вернуть ТОЛЬКО валидный JSON для FantaProjekt API. БЕЗ объяснений, БЕЗ markdown.

СТРОГАЯ СХЕМА:

{
  "scenes": [
    {
      "text": "<narration целиком, не менять>",
      "media": {
        "type": "files",
        "files": [
          {
            "filename": "<из files[i].name>",
            "data": "<из files[i].data>",
            "mimeType": "image/jpeg"
          }
        ]
      },
      "textOverlays": [
        {
          "text": "<7-10 слов из начала narration>",
          "position": {
            "x": "center",
            "y": "top"
          },
          "style": {
            "fontSize": 42,
            "fontFamily": "Arial",
            "color": "#FFFFFF",
            "backgroundColor": "transparent",
            "padding": 20
          },
          "animation": "fadeIn",
          "timing": {
            "start": 0,
            "end": 3
          }
        },
        {
          "text": "<5-7 слов из конца narration>",
          "position": {
            "x": "center",
            "y": "bottom"
          },
          "style": {
            "fontSize": 38,
            "color": "#FFFFFF",
            "backgroundColor": "#1E1E1E",
            "padding": 15
          },
          "animation": "fadeIn"
        }
      ]
    }
  ],
  "config": {
    "voice": "am_onyx",
    "music": "dark",
    "musicVolume": "medium",
    "orientation": "portrait",
    "captionPosition": "center",
    "captionBackgroundColor": "#1E1E1E",
    "paddingBack": 2000
  }
}

ВАЖНО:
1. position ВСЕГДА объект {x, y}, НЕ строка!
2. НЕТ параметров: type (кроме media.type), zoomHint, alignment, startTime, endTime для effects
3. textOverlays.style - ВСЕГДА объект внутри
4. Взять ВСЕ files (до 30 макс)
5. Вернуть ТОЛЬКО JSON, без обёрток

Проверка перед ответом:
✓ text = весь narration
✓ media.type = "files"
✓ position = {x: "center", y: "..."}
✓ style внутри textOverlays
✓ НЕТ: type/zoomHint/alignment/VHS01/Arrow
</Instruction>
```

---

## 2. Исправить "HTTP Request" узел:

### Текущий (НЕПРАВИЛЬНО):
```json
{
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {"name": "=", "value": "={{ JSON.stringify($json) }}"}
    ]
  }
}
```

### ✅ ПРАВИЛЬНО:
```json
{
  "method": "POST",
  "url": "http://172.17.0.1:3123/api/short-video",
  "sendBody": true,
  "contentType": "application/json",
  "body": "={{ JSON.stringify($json) }}",
  "options": {}
}
```

ИЛИ используйте **JSON/RAW** вместо Parameters:
- Body Content Type: **JSON**
- JSON: `{{ $json }}`

---

## 3. Проблема с Google Drive Files

После "Download" вы получаете НЕ binary data, а только metadata!

### Решение А: Использовать публичные URLs

Измените в "Build Fanta Payload2":

```javascript
{{
  ({
    narration: $node["Crime Scriptwriter Agent"].json["output"],
    files: $json.files.map(f => ({
      url: `https://drive.google.com/uc?export=download&id=${f.id}`,
      filename: f.name
    }))
  })
}}
```

И промпт AI агента изменить на `media.type = "url"`:

```json
{
  "media": {
    "type": "url",
    "urls": ["<URLs из files>"]
  }
}
```

### Решение Б: Скачать binary data

Добавьте узел **"Convert to File"** после Aggregate:
1. Operation: **Binary to JSON**
2. Получить base64 data
3. Передать в files как `{filename, data, mimeType}`

---

## 4. Полный исправленный промпт с URLs:

```
<Instruction>
Ты — JSON Generator для FantaProjekt API.

Вход: { narration, files }
- narration: текст озвучки
- files: массив [{url, filename}]

Верни ТОЛЬКО JSON без обёрток:

{
  "scenes": [
    {
      "text": "<весь narration>",
      "media": {
        "type": "url",
        "urls": ["<все files[i].url>"]
      },
      "textOverlays": [
        {
          "text": "<7-10 слов из начала narration>",
          "position": {"x": "center", "y": "top"},
          "style": {
            "fontSize": 42,
            "color": "#FFFFFF",
            "backgroundColor": "transparent",
            "padding": 20
          },
          "animation": "fadeIn",
          "timing": {"start": 0, "end": 3}
        },
        {
          "text": "<5-7 слов из конца narration>",
          "position": {"x": "center", "y": "bottom"},
          "style": {
            "fontSize": 38,
            "color": "#FFFFFF",
            "backgroundColor": "#1E1E1E",
            "padding": 15
          },
          "animation": "fadeIn"
        }
      ]
    }
  ],
  "config": {
    "voice": "am_onyx",
    "music": "dark",
    "musicVolume": "medium",
    "orientation": "portrait",
    "captionPosition": "center",
    "captionBackgroundColor": "#1E1E1E",
    "paddingBack": 2000
  }
}

ЗАПРЕЩЕНО: type (кроме media.type), zoomHint, alignment, VHS01, Arrow, startTime/endTime в effects
ОБЯЗАТЕЛЬНО: position как объект {x,y}, style внутри textOverlays
</Instruction>
```

---

## Итоговый workflow должен быть:

1. **Google Drive Search** → получить ID файлов
2. **Google Drive Download** → скачать metadata
3. **Aggregate Files** → собрать все в массив
4. **Build Fanta Payload** → создать {narration, files с URLs}
5. **Video Creator Agent** → создать ПРАВИЛЬНЫЙ JSON по новому промпту
6. **Extract Output** → извлечь JSON
7. **HTTP Request** → отправить с contentType: "application/json"

---

## Отправьте это вашему N8N разработчику! 🎯

