#!/bin/bash
# Install MCP monitoring cron job
# Автоматически проверяет MCP серверы каждый час

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Installing MCP Monitoring Cron Job ==="
echo ""

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

# Создать директорию для логов если не существует
mkdir -p /var/log/fantaprojekt

# Добавить cron job (проверка каждый час)
CRON_JOB="0 * * * * /home/developer/projects/FantaProjekt/scripts/check-mcp-servers.sh >> /var/log/fantaprojekt/mcp-monitoring.log 2>&1"

# Проверить есть ли уже такой cron job
if crontab -l 2>/dev/null | grep -q "check-mcp-servers.sh"; then
    echo -e "${YELLOW}Cron job already exists. Skipping.${NC}"
else
    # Добавить новый cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}✅ Cron job installed successfully!${NC}"
fi

echo ""
echo "Monitoring schedule:"
echo "- Frequency: Every hour"
echo "- Script: /home/developer/projects/FantaProjekt/scripts/check-mcp-servers.sh"
echo "- Log: /var/log/fantaprojekt/mcp-monitoring.log"
echo ""
echo "To view logs:"
echo "  tail -f /var/log/fantaprojekt/mcp-monitoring.log"
echo ""
echo "To manually check MCP servers:"
echo "  /home/developer/projects/FantaProjekt/scripts/check-mcp-servers.sh"
echo ""
echo "To cleanup duplicates:"
echo "  sudo /home/developer/projects/FantaProjekt/scripts/cleanup-mcp-duplicates.sh"
