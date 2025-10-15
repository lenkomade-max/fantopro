# ⚡ MCP Быстрый гид - Исправление ошибки в n8n

## 🔴 ПРОБЛЕМА

На вашем скриншоте в n8n MCP Client1:

```
❌ Указано: http://178.156.142.35:3123/api/short-video
```

Это **НЕПРАВИЛЬНО**! Это REST API endpoint, а не MCP endpoint.

---

## ✅ РЕШЕНИЕ

### Измените SSE Endpoint на:

```
✅ Правильно: http://178.156.142.35:3123/mcp/sse
```

---

## 🎯 Визуальная инструкция

### До (неправильно):
```
┌────────────────────────────────────────┐
│ MCP Client1 - Parameters               │
├────────────────────────────────────────┤
│ SSE Endpoint:                          │
│ http://178.156.142.35:3123/           │
│ ❌ /api/short-video                    │ ← Это REST API!
│                                        │
│ ⚠️  Credential for Bearer Auth ⚠️       │
└────────────────────────────────────────┘
```

### После (правильно):
```
┌────────────────────────────────────────┐
│ MCP Client1 - Parameters               │
├────────────────────────────────────────┤
│ SSE Endpoint:                          │
│ http://178.156.142.35:3123/           │
│ ✅ /mcp/sse                            │ ← MCP endpoint!
│                                        │
│ Authentication: None (или Bearer)      │
│ Tools to Include: Selected             │
│   ✓ create-short-video                 │
│   ✓ get-video-status                   │
└────────────────────────────────────────┘
```

---

## 📝 Пошаговая инструкция

1. **Откройте n8n workflow**
2. **Кликните на узел "MCP Client1"**
3. **В поле "SSE Endpoint" замените**:
   ```
   Было: http://178.156.142.35:3123/api/short-video
   Стало: http://178.156.142.35:3123/mcp/sse
   ```
4. **Если Authentication = "Bearer Auth"** и нет credential:
   - Измените на **"None"**
   - ИЛИ создайте Bearer credential, если у вас настроен токен
5. **Нажмите "Execute node"** для проверки
6. **После успешного подключения**:
   - В "Tools to Include" выберите "Selected"
   - Выберите инструменты: `create-short-video` и `get-video-status`

---

## 🔍 Как проверить, что работает?

### Тест подключения:
```bash
curl http://178.156.142.35:3123/mcp/sse
```

Если сервер работает, начнется SSE stream.

### Проверка сервера:
```bash
curl http://178.156.142.35:3123/health
# Ответ: {"status":"ok"}
```

---

## 🆚 Разница endpoint'ов

| Endpoint | Тип | Назначение | Использование |
|----------|-----|------------|---------------|
| `/api/short-video` | REST API | HTTP POST запрос | HTTP Request узел в n8n |
| `/mcp/sse` | MCP Protocol | AI Agent инструмент | MCP Client узел в n8n |

**Для работы с AI агентами** (Claude, GPT) → используйте `/mcp/sse`  
**Для прямых HTTP запросов** → используйте `/api/short-video`

---

## 💡 Почему это важно?

### MCP (`/mcp/sse`):
- ✅ AI агент сам формирует правильные параметры
- ✅ Автоматическая типизация
- ✅ Работает с естественным языком
- ✅ AI может вызывать функции по необходимости

### REST API (`/api/short-video`):
- ❌ Нужно вручную формировать JSON
- ❌ AI не может напрямую вызывать
- ❌ Нет автоматической типизации

---

## 🎬 Пример использования после исправления

### В n8n workflow:

```
1. [Manual Trigger]
   ↓
2. [OpenAI Chat Model]
   • Промпт: "Create a dramatic crime video about a mysterious case"
   • Tools: MCP Client1 подключен
   ↓
3. [MCP Client1] автоматически вызовет create-short-video
   • Параметры сформирует AI
   • SSE Endpoint: http://178.156.142.35:3123/mcp/sse ✅
   ↓
4. [Result] videoId готов
```

AI автоматически:
1. Поймет, что нужно создать видео
2. Вызовет `create-short-video` через MCP
3. Передаст правильные параметры
4. Получит videoId

---

## ✅ Checklist

- [ ] Изменил `/api/short-video` на `/mcp/sse`
- [ ] Настроил Authentication (None или Bearer)
- [ ] Проверил подключение (Execute node)
- [ ] Увидел доступные Tools
- [ ] Выбрал нужные инструменты
- [ ] Подключил к AI Agent
- [ ] Протестировал workflow

---

**После исправления все красные ошибки исчезнут!** ✅

Полная документация: `MCP_НАСТРОЙКА_N8N.md`

