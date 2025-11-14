#!/bin/bash
# Auto-cleanup duplicate MCP servers
# Убивает дублированные/старые MCP серверы, оставляя только активные сессии

set -e

# Цвета
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== MCP Servers Auto-Cleanup ==="
echo "Date: $(date)"
echo ""

# Проверяем запущен ли скрипт с правами root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo $0${NC}"
    exit 1
fi

# Функция безопасного убийства процессов
safe_kill() {
    local pids="$1"
    local description="$2"

    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing: $description${NC}"
        echo "$pids" | xargs -r kill 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Done${NC}"
        return 0
    else
        echo "Nothing to kill for: $description"
        return 1
    fi
}

# 1. Найти активные терминалы с Claude
echo "Step 1: Finding active Claude sessions..."
ACTIVE_CLAUDE_PIDS=$(ps aux | grep "claude$" | grep -v grep | awk '{print $2}' || true)

if [ -z "$ACTIVE_CLAUDE_PIDS" ]; then
    echo -e "${YELLOW}No active Claude sessions found${NC}"
    ACTIVE_PPIDS=""
else
    echo "Active Claude PIDs: $ACTIVE_CLAUDE_PIDS"
    ACTIVE_PPIDS=$ACTIVE_CLAUDE_PIDS
fi

# 2. Найти старые фоновые Claude процессы (старше 1 дня)
echo ""
echo "Step 2: Finding old background Claude processes..."
OLD_CLAUDE=$(ps -eo pid,etimes,cmd | grep "claude" | grep -v grep | awk '$2 > 86400 {print $1}' || true)
if safe_kill "$OLD_CLAUDE" "old Claude processes (>1 day)"; then
    KILLED_COUNT=$((KILLED_COUNT + $(echo "$OLD_CLAUDE" | wc -l)))
fi

# 3. Найти все MCP процессы
echo ""
echo "Step 3: Finding all MCP server processes..."
ALL_MCP=$(ps aux | grep -E "(npm exec.*mcp|mcp-server-|context7-mcp|sequential-thinking)" | grep -v grep | awk '{print $2, $3}')
echo "Total MCP processes found: $(echo "$ALL_MCP" | wc -l)"

# 4. Определить какие MCP серверы принадлежат активным сессиям
echo ""
echo "Step 4: Identifying MCP servers to keep..."
KEEP_PIDS=""
for pid in $ACTIVE_PPIDS; do
    # Найти дочерние процессы активных Claude сессий
    CHILDREN=$(pgrep -P "$pid" 2>/dev/null || true)
    KEEP_PIDS="$KEEP_PIDS $CHILDREN"

    # Рекурсивно найти внуков (MCP серверы запускаются через npm exec)
    for child in $CHILDREN; do
        GRANDCHILDREN=$(pgrep -P "$child" 2>/dev/null || true)
        KEEP_PIDS="$KEEP_PIDS $GRANDCHILDREN"

        # Правнуки (node процессы MCP)
        for grandchild in $GRANDCHILDREN; do
            GREATGRANDCHILDREN=$(pgrep -P "$grandchild" 2>/dev/null || true)
            KEEP_PIDS="$KEEP_PIDS $GREATGRANDCHILDREN"
        done
    done
done

echo "Protected PIDs (active sessions): $(echo $KEEP_PIDS | wc -w)"

# 5. Убить MCP процессы, которые НЕ в списке защищённых
echo ""
echo "Step 5: Killing orphaned MCP servers..."
KILLED_COUNT=0

# Найти MCP процессы для удаления
for line in $(ps aux | grep -E "(npm exec.*mcp|mcp-server-|context7-mcp)" | grep -v grep | awk '{print $2}'); do
    pid=$line
    # Проверить есть ли PID в списке защищённых
    if ! echo "$KEEP_PIDS" | grep -qw "$pid"; then
        echo "Killing orphaned MCP: $pid"
        kill "$pid" 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
done

# 6. Убить serena MCP если нет активных сессий
echo ""
echo "Step 6: Checking Serena MCP server..."
if [ -z "$ACTIVE_CLAUDE_PIDS" ]; then
    SERENA_PIDS=$(ps aux | grep "serena.*mcp" | grep -v grep | awk '{print $2}' || true)
    if safe_kill "$SERENA_PIDS" "Serena MCP (no active sessions)"; then
        KILLED_COUNT=$((KILLED_COUNT + $(echo "$SERENA_PIDS" | wc -l)))
    fi
fi

echo ""
echo "=== Cleanup Summary ==="
echo "Processes killed: $KILLED_COUNT"

# Финальная статистика
sleep 2
REMAINING_MCP=$(ps aux | grep -E "(npm exec.*mcp|mcp-server-|context7-mcp)" | grep -v grep | wc -l)
REMAINING_CLAUDE=$(ps aux | grep "claude" | grep -v grep | wc -l)

echo "Remaining:"
echo "- MCP servers: $REMAINING_MCP"
echo "- Claude sessions: $REMAINING_CLAUDE"

if [ "$REMAINING_MCP" -lt 40 ]; then
    echo -e "${GREEN}✅ Cleanup successful!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Still too many MCP servers. Manual check required.${NC}"
    exit 1
fi
