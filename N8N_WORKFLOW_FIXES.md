# 🔧 Исправления N8N Workflow - FantaProjekt

## 🚨 3 ГЛАВНЫЕ ПРОБЛЕМЫ:

### 1. ❌ AI Агент генерирует НЕПРАВИЛЬНЫЙ JSON
- Использует `type: "VHS01"`, `type: "Arrow"` (НЕТ в API!)
- Использует `position: "top"` (должно быть `{x: "center", y: "top"}`)
- Использует `zoomHint`, `alignment` (НЕТ в API!)

### 2. ❌ Google Drive возвращает только metadata (id, name), НЕ файлы
- Нужно получить URLs или binary data

### 3. ❌ HTTP Request отправляет неправильный формат
- Использует bodyParameters вместо JSON body

---

## ✅ ИСПРАВЛЕНИЯ:

### ИСПРАВЛЕНИЕ 1: Промпт AI Агента

**Узел:** "Video Creator Agent (MCP)2"

**Заменить весь systemMessage на:**

```
Ты — JSON Generator для FantaProjekt API.

Вход: { narration, files } где files = [{url, filename}]

Верни ТОЛЬКО валидный JSON БЕЗ обёрток и объяснений:

{
  "scenes": [{
    "text": "<весь narration без изменений>",
    "media": {
      "type": "url",
      "urls": ["<URL1>", "<URL2>", "..."]
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
  }],
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

ПРАВИЛА:
✅ media.type ВСЕГДА "url"
✅ position ВСЕГДА объект: {x: "center", y: "top"/"bottom"}
✅ style ВСЕГДА внутри textOverlays
✅ animation: "fadeIn", "slideIn", "bounce", "pulse" или "none"

❌ ЗАПРЕЩЕНО:
- type: "VHS01", "VHS02", "Arrow"
- zoomHint
- alignment
- position как строка
- любые параметры кроме указанных

Вернуть ТОЛЬКО JSON, без markdown и текста.
```

---

### ИСПРАВЛЕНИЕ 2: Build Fanta Payload

**Узел:** "Build Fanta Payload2"

**Текущий код:**
```javascript
{{ ({
  narration: $node["Crime Scriptwriter Agent"].json["output"],
  files: $json.files
}) }}
```

**✅ ЗАМЕНИТЬ НА:**
```javascript
{{ ({
  narration: $node["Crime Scriptwriter Agent"].json["output"],
  files: $json.files.map(f => ({
    url: `https://drive.google.com/uc?export=download&id=${f.id}`,
    filename: f.name
  }))
}) }}
```

**Что изменилось:**
- Теперь создаем URLs из Google Drive ID
- Каждый файл = {url, filename}

---

### ИСПРАВЛЕНИЕ 3: HTTP Request

**Узел:** "HTTP Request"

**Удалить:**
```json
"bodyParameters": {
  "parameters": [
    {"name": "=", "value": "={{ JSON.stringify($json) }}"}
  ]
}
```

**✅ ЗАМЕНИТЬ НА:**

**Вариант А (через настройки UI):**
1. Method: **POST**
2. URL: `http://172.17.0.1:3123/api/short-video`
3. Send Body: **✓ ВКЛ**
4. Body Content Type: **JSON**
5. Specify Body: **Using JSON**
6. JSON/RAW: `{{ $json }}`

**Вариант Б (через JSON config):**
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

---

### ИСПРАВЛЕНИЕ 4: Google Drive - сделать файлы публичными

**Опционально** (если URLs не работают):

1. Сделайте папку Google Drive публичной для чтения
2. ИЛИ используйте shared link URLs:
   ```javascript
   url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1920`
   ```

---

## 📋 ЧЕКЛИСТ ПРОВЕРКИ:

После исправлений проверьте:

### 1. Выход AI Агента должен быть:
```json
{
  "scenes": [{
    "text": "...",
    "media": {
      "type": "url",
      "urls": ["https://drive.google.com/uc?export=download&id=..."]
    },
    "textOverlays": [{
      "text": "...",
      "position": {"x": "center", "y": "top"},
      "style": {...},
      "animation": "fadeIn",
      "timing": {"start": 0, "end": 3}
    }]
  }],
  "config": {...}
}
```

### 2. НЕТ в JSON:
- ❌ `type: "VHS01"`, `type: "Arrow"`
- ❌ `zoomHint`
- ❌ `alignment`
- ❌ `position: "top"` (строка)
- ❌ `startTime`, `endTime` для effects

### 3. ЕСТЬ в JSON:
- ✅ `media.type = "url"`
- ✅ `media.urls = [...]` (массив)
- ✅ `position = {x: ..., y: ...}` (объект)
- ✅ `style = {...}` внутри textOverlays
- ✅ `config.voice` (обязательно!)

---

## 🧪 ТЕСТ:

### 1. Запустите workflow
### 2. Проверьте узел "Extract Output for API":

**Должен быть такой JSON:**
```json
{
  "scenes": [{
    "text": "In 1971, New York City's subway became a grisly stage. The city waits, never fully safe again.",
    "media": {
      "type": "url",
      "urls": [
        "https://drive.google.com/uc?export=download&id=1mfXP97eU41QepQLhM1O8JrcB3ImL3Nx7",
        "https://drive.google.com/uc?export=download&id=1WHYdp1u16JAecU2Bo_GokIeoyb2otr_A"
      ]
    },
    "textOverlays": [
      {
        "text": "In 1971, New York City's subway became a grisly stage",
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
        "text": "The city waits, never fully safe again.",
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
  }],
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
```

### 3. Если HTTP Request возвращает ошибку:
- Проверьте что FantaProjekt API запущен на http://172.17.0.1:3123
- Проверьте формат JSON выше
- Проверьте логи API сервера

---

## ⚡ БЫСТРЫЕ ФИКСЫ:

### Если AI агент все равно добавляет VHS/Arrow:
Добавьте в конец промпта:
```
КРИТИЧЕСКИ ВАЖНО: Если ты добавишь type: "VHS01", type: "Arrow", zoomHint или другие несуществующие параметры - запрос провалится! Используй ТОЛЬКО параметры из примера выше!
```

### Если position все равно строка:
Добавьте:
```
position ОБЯЗАТЕЛЬНО объект вида {"x": "center", "y": "top"} - НЕ строка!
```

---

## 📞 Поддержка:

Если после исправлений не работает:
1. Проверьте логи FantaProjekt: `docker logs <container_name>`
2. Проверьте response HTTP Request узла в N8N
3. Сверьте JSON с примером выше
4. Проверьте что API на http://172.17.0.1:3123 доступен

---

**Версия исправлений:** 1.0  
**Дата:** Октябрь 2025  
**Статус:** ✅ Готово к применению

