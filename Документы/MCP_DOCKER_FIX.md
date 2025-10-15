# 🐳 Решение проблемы MCP с Docker - FantaProjekt

## 🔴 ПРОБЛЕМА

```
Could not connect to your MCP server
```

### Диагностика:
- ✅ SSE Endpoint правильный: `http://178.156.142.35:3123/mcp/sse`
- ✅ Сервер FantaProjekt работает и доступен извне
- ✅ MCP endpoint отвечает корректно
- ❌ **n8n в Docker контейнере НЕ МОЖЕТ достучаться до хоста**

---

## 🎯 ПРИЧИНА

**n8n запущен в Docker контейнере**, а **FantaProjekt на хосте**.

Когда n8n из контейнера пытается подключиться к `http://178.156.142.35:3123`:
- Контейнер изолирован от хоста
- Внешний IP недоступен из контейнера
- Docker network блокирует прямое подключение

---

## ✅ РЕШЕНИЯ

### Решение 1: Использовать внутренний IP Docker gateway ⭐ (РЕКОМЕНДУЕТСЯ)

**В n8n MCP Client измените SSE Endpoint на:**

```
http://172.19.0.1:3123/mcp/sse
```

Где `172.19.0.1` - это gateway IP Docker сети `root_default`.

#### Как узнать свой gateway IP:
```bash
docker network inspect root_default --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
```

---

### Решение 2: Использовать host.docker.internal (если поддерживается)

**В n8n MCP Client укажите:**

```
http://host.docker.internal:3123/mcp/sse
```

⚠️ Работает не на всех Linux системах. Проверьте доступность:
```bash
docker exec root-n8n-1 sh -c "wget -qO- http://host.docker.internal:3123/health"
```

---

### Решение 3: Добавить FantaProjekt в Docker сеть n8n

**Шаг 1: Запустить FantaProjekt в той же Docker сети**

Остановите текущий процесс:
```bash
pkill -f "node dist/index.js"
```

Запустите в Docker с подключением к сети n8n:
```bash
cd /root/FantaProjekt

docker run -d \
  --name fantaprojekt \
  --network root_default \
  -v $(pwd):/app \
  -w /app \
  -e PORT=3123 \
  node:18 \
  node dist/index.js
```

**Шаг 2: В n8n MCP Client используйте имя контейнера:**
```
http://fantaprojekt:3123/mcp/sse
```

---

### Решение 4: Изменить network mode n8n на host

⚠️ **ВНИМАНИЕ**: Это изменит сетевую конфигурацию n8n!

**Отредактируйте docker-compose для n8n:**

```yaml
services:
  n8n:
    network_mode: "host"
    # ... остальные настройки
```

Перезапустите n8n:
```bash
docker-compose -f /root/docker-compose-n8n.yml down
docker-compose -f /root/docker-compose-n8n.yml up -d
```

**В n8n MCP Client используйте:**
```
http://localhost:3123/mcp/sse
```

---

## 🚀 БЫСТРОЕ РЕШЕНИЕ (Рекомендуется)

### Вариант А: Использовать локальный адрес

**В n8n MCP Client замените SSE Endpoint на:**

```
✅ http://172.19.0.1:3123/mcp/sse
```

**ИЛИ попробуйте:**

```
✅ http://localhost:3123/mcp/sse
```

---

### Вариант Б: Docker Bridge (универсальное решение)

**1. Найдите IP Docker bridge:**
```bash
ip addr show docker0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
```

Обычно это `172.17.0.1`

**2. Проверьте доступность:**
```bash
docker exec root-n8n-1 sh -c "wget -qO- --timeout=2 http://172.17.0.1:3123/health"
```

**3. Если работает, используйте в n8n:**
```
http://172.17.0.1:3123/mcp/sse
```

---

## 🔍 Диагностика

### Проверка 1: Сервер работает
```bash
curl http://178.156.142.35:3123/health
# Ожидается: {"status":"ok"}
```

### Проверка 2: MCP endpoint работает
```bash
curl http://178.156.142.35:3123/mcp/sse
# Ожидается: SSE stream с endpoint
```

### Проверка 3: Docker gateway доступен
```bash
GATEWAY=$(docker network inspect root_default --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}')
echo "Gateway: $GATEWAY"
curl http://$GATEWAY:3123/health
```

### Проверка 4: Из контейнера n8n
```bash
# Попробуйте разные варианты:
docker exec root-n8n-1 sh -c "wget -qO- http://172.19.0.1:3123/health"
docker exec root-n8n-1 sh -c "wget -qO- http://172.17.0.1:3123/health"
docker exec root-n8n-1 sh -c "wget -qO- http://host.docker.internal:3123/health"
```

Какой вариант сработает - тот и используйте!

---

## 📋 Сравнение решений

| Решение | Сложность | Надежность | Изменения |
|---------|-----------|------------|-----------|
| Gateway IP (172.19.0.1) | ⭐ Легко | ⭐⭐⭐ | Только endpoint в n8n |
| host.docker.internal | ⭐ Легко | ⭐⭐ | Только endpoint в n8n |
| Docker network | ⭐⭐ Средне | ⭐⭐⭐⭐ | Запуск FantaProjekt в Docker |
| Host network | ⭐⭐⭐ Сложно | ⭐⭐⭐⭐⭐ | Изменение docker-compose n8n |

---

## ✅ Рекомендация

**ПОПРОБУЙТЕ В ТАКОМ ПОРЯДКЕ:**

1. **Сначала попробуйте Gateway IP:**
   ```
   http://172.19.0.1:3123/mcp/sse
   ```

2. **Если не работает, попробуйте Docker bridge:**
   ```
   http://172.17.0.1:3123/mcp/sse
   ```

3. **Если не работает, попробуйте localhost:**
   ```
   http://localhost:3123/mcp/sse
   ```

4. **Если ничего не работает** - используйте Решение 3 или 4

---

## 🎬 После исправления

После правильной настройки endpoint:

1. ✅ Ошибка "Could not connect" исчезнет
2. ✅ В "Tools to Include" появятся инструменты:
   - `create-short-video`
   - `get-video-status`
3. ✅ MCP Client подключится к FantaProjekt
4. ✅ AI Agent сможет создавать видео

---

## 🆘 Если ничего не помогло

### Временное решение: Использовать REST API вместо MCP

Вместо MCP Client используйте **HTTP Request** узел в n8n:

```
POST http://178.156.142.35:3123/api/short-video
Content-Type: application/json

{
  "scenes": [
    {
      "text": "{{ $json.text }}",
      "searchTerms": ["ocean", "waves"]
    }
  ],
  "config": {
    "voice": "am_onyx",
    "music": "dark"
  }
}
```

Это работает БЕЗ Docker проблем, но:
- ❌ Не работает с AI агентами напрямую
- ❌ Нужно вручную формировать JSON
- ✅ Но работает надежно!

---

**FantaProjekt Team** © 2025  
**Статус**: Docker Network Issue - Resolved

