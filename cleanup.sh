#!/bin/bash

#######################################################
# СИСТЕМА АВТООЧИСТКИ FANTAPROJEKT
# Версия: 1.0
# Дата: 2025-10-24
#######################################################

set -e

LOG_FILE="/var/log/fantaprojekt-cleanup.log"
WORKSPACE="/home/developer/projects/FantaProjekt/workspace"
N8N_BINARY_DATA="/root/n8n_data/binaryData"

# Логирование
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Получить размер папки в байтах
get_size_bytes() {
    du -sb "$1" 2>/dev/null | cut -f1 || echo "0"
}

# Конвертировать байты в человекочитаемый формат
human_size() {
    numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || echo "$1 bytes"
}

log "========================================="
log "Начало автоочистки"
log "========================================="

#######################################################
# 1. ОЧИСТКА ПО ВОЗРАСТУ (temp, downloads, logs)
#######################################################

log "[1/6] Очистка workspace/temp (файлы старше 1 дня)..."
if [ -d "$WORKSPACE/temp" ]; then
    BEFORE=$(get_size_bytes "$WORKSPACE/temp")
    find "$WORKSPACE/temp" -type f -mtime +1 -delete 2>/dev/null || true
    AFTER=$(get_size_bytes "$WORKSPACE/temp")
    FREED=$((BEFORE - AFTER))
    log "  ✓ Освобождено: $(human_size $FREED)"
else
    log "  ⚠ Папка не существует"
fi

log "[2/6] Очистка workspace/downloads (файлы старше 3 дней)..."
if [ -d "$WORKSPACE/downloads" ]; then
    BEFORE=$(get_size_bytes "$WORKSPACE/downloads")
    find "$WORKSPACE/downloads" -type f -mtime +3 -delete 2>/dev/null || true
    AFTER=$(get_size_bytes "$WORKSPACE/downloads")
    FREED=$((BEFORE - AFTER))
    log "  ✓ Освобождено: $(human_size $FREED)"
else
    log "  ⚠ Папка не существует"
fi

log "[3/6] Очистка workspace/renders (файлы старше 7 дней)..."
if [ -d "$WORKSPACE/renders" ]; then
    BEFORE=$(get_size_bytes "$WORKSPACE/renders")
    find "$WORKSPACE/renders" -type f -mtime +7 -delete 2>/dev/null || true
    AFTER=$(get_size_bytes "$WORKSPACE/renders")
    FREED=$((BEFORE - AFTER))
    log "  ✓ Освобождено: $(human_size $FREED)"
else
    log "  ⚠ Папка не существует"
fi

#######################################################
# 2. ОЧИСТКА ПО РАЗМЕРУ (cache)
#######################################################

log "[4/6] Проверка workspace/cache (лимит: 5GB)..."
if [ -d "$WORKSPACE/cache" ]; then
    CACHE_SIZE=$(get_size_bytes "$WORKSPACE/cache")
    CACHE_LIMIT=$((5 * 1024 * 1024 * 1024)) # 5GB в байтах
    
    log "  Текущий размер: $(human_size $CACHE_SIZE)"
    
    if [ $CACHE_SIZE -gt $CACHE_LIMIT ]; then
        log "  ⚠ Превышен лимит! Удаляю старые файлы..."
        # Удаляем самые старые файлы, оставляем 1000 новейших
        find "$WORKSPACE/cache" -type f -printf '%T@ %p\n' 2>/dev/null | \
            sort -n | head -n -1000 | cut -d' ' -f2- | xargs -r rm -f
        
        AFTER=$(get_size_bytes "$WORKSPACE/cache")
        FREED=$((CACHE_SIZE - AFTER))
        log "  ✓ Освобождено: $(human_size $FREED)"
        log "  Новый размер: $(human_size $AFTER)"
    else
        log "  ✓ Размер в норме"
    fi
else
    log "  ⚠ Папка не существует"
fi

#######################################################
# 3. ОЧИСТКА n8n BINARY DATA (старше 7 дней)
#######################################################

log "[5/6] Очистка n8n binary data (файлы старше 7 дней)..."
if [ -d "$N8N_BINARY_DATA" ]; then
    BEFORE=$(get_size_bytes "$N8N_BINARY_DATA")
    find "$N8N_BINARY_DATA" -type f -mtime +7 -delete 2>/dev/null || true
    AFTER=$(get_size_bytes "$N8N_BINARY_DATA")
    FREED=$((BEFORE - AFTER))
    log "  ✓ Освобождено: $(human_size $FREED)"
else
    log "  ⚠ Папка не существует"
fi

#######################################################
# 4. СИСТЕМНАЯ ОЧИСТКА (раз в неделю в воскресенье)
#######################################################

log "[6/6] Проверка системной очистки..."
DAY_OF_WEEK=$(date +%u) # 1=понедельник, 7=воскресенье

if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "  → Воскресенье: запуск системной очистки"
    
    # Очистка системных логов (старше 30 дней)
    log "    - Системные логи (старше 30 дней)..."
    find /var/log -type f -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
    find /var/log -type f -name "*.gz" -mtime +30 -delete 2>/dev/null || true
    
    # Очистка /tmp (старше 7 дней)
    log "    - /tmp (файлы старше 7 дней)..."
    find /tmp -type f -mtime +7 -delete 2>/dev/null || true
    
    # Очистка Docker
    log "    - Docker dangling images..."
    docker image prune -f 2>&1 | grep "Total reclaimed space" | tee -a "$LOG_FILE" || true
    
    log "    - Docker stopped containers..."
    docker container prune -f 2>&1 | grep "Total reclaimed space" | tee -a "$LOG_FILE" || true
    
    # Очистка npm cache если > 1.5GB
    NPM_CACHE_SIZE=$(get_size_bytes "/root/.npm")
    NPM_LIMIT=$((1536 * 1024 * 1024)) # 1.5GB
    
    if [ $NPM_CACHE_SIZE -gt $NPM_LIMIT ]; then
        log "    - npm cache (размер: $(human_size $NPM_CACHE_SIZE))..."
        npm cache clean --force 2>&1 | tail -3 | tee -a "$LOG_FILE" || true
    else
        log "    - npm cache в норме ($(human_size $NPM_CACHE_SIZE))"
    fi
    
    log "  ✓ Системная очистка завершена"
else
    log "  → Пропуск (системная очистка только по воскресеньям)"
fi

#######################################################
# ИТОГИ
#######################################################

log "========================================="
log "Автоочистка завершена успешно"
log "========================================="

# Показать статистику диска
DISK_USAGE=$(df -h / | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}')
log "Использование диска: $DISK_USAGE"

exit 0
