#!/bin/bash
# MCP Servers Monitoring Script
# Проверяет количество запущенных MCP серверов и предупреждает о дублях

set -e

# Цвета для вывода
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=== MCP Servers Monitor ==="
echo "Date: $(date)"
echo ""

# Подсчёт MCP процессов
MCP_COUNT=$(ps aux | grep -E "(npm exec.*mcp|mcp-server-|context7-mcp)" | grep -v grep | wc -l)
CLAUDE_COUNT=$(ps aux | grep "claude" | grep -v grep | wc -l)

echo "Active processes:"
echo "- MCP servers: $MCP_COUNT"
echo "- Claude sessions: $CLAUDE_COUNT"
echo ""

# Расчёт памяти MCP серверов
MCP_MEMORY=$(ps aux | grep -E "(npm exec.*mcp|mcp-server-|context7-mcp)" | grep -v grep | awk '{sum+=$6} END {print sum/1024}')
echo "MCP memory usage: ${MCP_MEMORY} MB"
echo ""

# Нормальное количество: 12-18 процессов на одну сессию Claude
# (6 MCP серверов × 3 процесса = 18)
# Для 2 сессий = 36 процессов
EXPECTED_MAX=40

if [ "$MCP_COUNT" -gt "$EXPECTED_MAX" ]; then
    echo -e "${RED}⚠️  WARNING: Too many MCP servers detected!${NC}"
    echo -e "${YELLOW}Expected: <$EXPECTED_MAX, Found: $MCP_COUNT${NC}"
    echo ""
    echo "Possible duplicate sessions. Run cleanup script:"
    echo "  /home/developer/projects/FantaProjekt/scripts/cleanup-mcp-duplicates.sh"
    echo ""

    # Показать группы процессов по времени старта
    echo "MCP server groups by start time:"
    ps aux | grep -E "(npm exec.*mcp|mcp-server-|context7-mcp)" | grep -v grep | awk '{print $2, $9, $11, $12}' | sort -k2
    exit 1
else
    echo -e "${GREEN}✅ MCP servers count is normal${NC}"
fi

# Проверка памяти
if (( $(echo "$MCP_MEMORY > 800" | bc -l) )); then
    echo -e "${YELLOW}⚠️  MCP servers using too much memory: ${MCP_MEMORY} MB${NC}"
    echo "Consider restarting Claude Code sessions"
    exit 1
fi

echo -e "${GREEN}✅ Memory usage is normal${NC}"
