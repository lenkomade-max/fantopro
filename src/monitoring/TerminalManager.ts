import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger';

const execAsync = promisify(exec);

/**
 * Terminal Command
 */
export interface TerminalCommand {
  id: string;
  name: string;
  category: CommandCategory;
  description: string;
  command: string;
  needsConfirmation: boolean;  // Требует подтверждения для опасных команд
  formatOutput?: (stdout: string) => string;
}

/**
 * Command Category
 */
export type CommandCategory =
  | 'monitoring'      // Мониторинг: htop, free, df, uptime
  | 'processes'       // Процессы: ps, kill, systemctl
  | 'files'          // Файлы: ls, du, find
  | 'network'        // Сеть: netstat, ss, ping
  | 'docker'         // Docker: ps, stats, logs
  | 'fantaprojekt'   // FantaProjekt: workspace, cache, renders
  | 'quick';         // Быстрые команды: топ-20 самых нужных команд

/**
 * TerminalManager - управление терминальными командами
 *
 * Предоставляет 20+ предустановленных команд по категориям
 * для управления сервером через Telegram
 */
export class TerminalManager {
  private commands: Map<string, TerminalCommand> = new Map();

  constructor() {
    this.initializeCommands();
  }

  /**
   * Инициализация всех команд
   */
  private initializeCommands(): void {
    // ===== МОНИТОРИНГ =====
    this.addCommand({
      id: 'mon-free',
      name: '💾 Память (RAM)',
      category: 'monitoring',
      description: 'Использование оперативной памяти',
      command: 'free -h',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'mon-df',
      name: '💿 Диск',
      category: 'monitoring',
      description: 'Использование дискового пространства',
      command: 'df -h /',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'mon-uptime',
      name: '⏱️ Uptime',
      category: 'monitoring',
      description: 'Время работы сервера',
      command: 'uptime',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'mon-top',
      name: '📊 Top процессы (CPU)',
      category: 'monitoring',
      description: 'Топ-10 процессов по CPU',
      command: 'ps aux --sort=-%cpu | head -11',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'mon-top-mem',
      name: '📊 Top процессы (RAM)',
      category: 'monitoring',
      description: 'Топ-10 процессов по памяти',
      command: 'ps aux --sort=-%mem | head -11',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'mon-netstat',
      name: '🌐 Сетевые соединения',
      category: 'monitoring',
      description: 'Активные сетевые подключения',
      command: 'netstat -tuln | grep LISTEN',
      needsConfirmation: false,
    });

    // ===== ПРОЦЕССЫ =====
    this.addCommand({
      id: 'proc-list',
      name: '📋 Список процессов',
      category: 'processes',
      description: 'Все запущенные процессы',
      command: 'ps aux',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'proc-node',
      name: '🟢 Node.js процессы',
      category: 'processes',
      description: 'Все Node.js процессы',
      command: 'ps aux | grep node | grep -v grep',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'proc-docker',
      name: '🐳 Docker процессы',
      category: 'processes',
      description: 'Docker и containerd процессы',
      command: 'ps aux | grep -E "docker|containerd" | grep -v grep',
      needsConfirmation: false,
    });

    // ===== ФАЙЛЫ =====
    this.addCommand({
      id: 'files-workspace',
      name: '📁 Workspace размер',
      category: 'files',
      description: 'Размер папки workspace/',
      command: 'du -sh /app/workspace/* 2>/dev/null || echo "Workspace пуст"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'files-renders',
      name: '🎬 Готовые видео',
      category: 'files',
      description: 'Список готовых видео в renders/',
      command: 'ls -lh /app/workspace/renders/ 2>/dev/null | tail -20 || echo "Нет видео"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'files-temp',
      name: '🗑️ Временные файлы',
      category: 'files',
      description: 'Размер временных файлов',
      command: 'du -sh /app/workspace/temp/ 2>/dev/null || echo "Нет временных файлов"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'files-cache',
      name: '💾 Размер кэша',
      category: 'files',
      description: 'Размер кэша (downloads + cache)',
      command: 'du -sh /app/workspace/downloads/ /app/workspace/cache/ 2>/dev/null || echo "Кэш пуст"',
      needsConfirmation: false,
    });

    // ===== СЕТЬ =====
    this.addCommand({
      id: 'net-ports',
      name: '🔌 Открытые порты',
      category: 'network',
      description: 'Список открытых портов',
      command: 'ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null || echo "Команда недоступна"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'net-connections',
      name: '🌐 Активные соединения',
      category: 'network',
      description: 'Количество соединений',
      command: 'ss -an 2>/dev/null | grep ESTAB | wc -l || netstat -an 2>/dev/null | grep ESTABLISHED | wc -l || echo "0"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'net-ping-google',
      name: '📡 Ping Google',
      category: 'network',
      description: 'Проверка интернет-соединения',
      command: 'ping -c 4 8.8.8.8 2>&1',
      needsConfirmation: false,
    });

    // ===== DOCKER =====
    // NOTE: Docker команды недоступны изнутри контейнера
    // Используйте меню 🐳 Docker вместо этого раздела

    // ===== FANTAPROJEKT =====
    this.addCommand({
      id: 'fanta-status',
      name: '📊 Статус сервера',
      category: 'fantaprojekt',
      description: 'Статус FantaProjekt API',
      command: 'curl -s http://localhost:3123/api/health || echo "Server not responding"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'fanta-renders-count',
      name: '🎬 Количество видео',
      category: 'fantaprojekt',
      description: 'Сколько видео в renders/',
      command: 'ls -1 /app/workspace/renders/ 2>/dev/null | wc -l || echo "0"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'fanta-workspace-size',
      name: '📁 Размер workspace',
      category: 'fantaprojekt',
      description: 'Общий размер workspace/',
      command: 'du -sh /app/workspace/ 2>/dev/null || echo "Недоступно"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'fanta-cleanup',
      name: '🧹 Очистка (dry-run)',
      category: 'fantaprojekt',
      description: 'Показать что будет очищено',
      command: 'find /app/workspace/temp/ -type f -mtime +1 2>/dev/null | head -20 || echo "Нет файлов для очистки"',
      needsConfirmation: false,
    });

    // ===== БЫСТРЫЕ КОМАНДЫ =====
    // Специальная команда для активации режима интерактивного терминала
    this.addCommand({
      id: 'manual-input',
      name: '✍️ Ручной ввод',
      category: 'quick',
      description: 'Активировать режим интерактивного терминала (вводить команды в чате)',
      command: 'echo "TERMINAL_MODE_ACTIVATE"', // Специальная команда-маркер
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-whoami',
      name: '👤 Кто я?',
      category: 'quick',
      description: 'Показать текущего пользователя',
      command: 'whoami && echo "UID: $(id -u)" && echo "Groups: $(id -G -n)"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-pwd',
      name: '📍 Где я?',
      category: 'quick',
      description: 'Показать текущую директорию',
      command: 'pwd && ls -la',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-env',
      name: '🔐 Переменные окружения',
      category: 'quick',
      description: 'Показать важные ENV переменные',
      command: 'env | grep -E "NODE_ENV|PORT|LOG_LEVEL|MONITORING_ENABLED" | sort',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-hostname',
      name: '🖥️ Имя хоста',
      category: 'quick',
      description: 'Показать hostname контейнера',
      command: 'hostname && echo "Container ID: $(hostname)"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-date',
      name: '🕐 Дата и время',
      category: 'quick',
      description: 'Показать текущее время',
      command: 'date && echo "Uptime: $(uptime -p 2>/dev/null || uptime)"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-disk-usage',
      name: '💾 Использование диска',
      category: 'quick',
      description: 'Показать использование диска (/)',
      command: 'df -h / && echo "" && du -sh /app/workspace/* 2>/dev/null || echo "Workspace недоступен"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-memory',
      name: '🧠 Память',
      category: 'quick',
      description: 'Показать использование памяти',
      command: 'free -h 2>/dev/null || echo "free недоступен"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-cpu',
      name: '⚡ CPU информация',
      category: 'quick',
      description: 'Показать информацию о CPU',
      command: 'cat /proc/cpuinfo | grep -E "model name|cpu cores|cpu MHz" | head -6',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-top-cpu',
      name: '🔥 Top 5 CPU процессов',
      category: 'quick',
      description: 'Показать топ-5 процессов по CPU',
      command: 'ps aux --sort=-%cpu | head -6',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-top-mem',
      name: '📊 Top 5 RAM процессов',
      category: 'quick',
      description: 'Показать топ-5 процессов по памяти',
      command: 'ps aux --sort=-%mem | head -6',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-listening-ports',
      name: '🔌 Слушающие порты',
      category: 'quick',
      description: 'Показать открытые порты',
      command: 'ss -tuln 2>/dev/null | grep LISTEN || netstat -tuln 2>/dev/null | grep LISTEN',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-find-large',
      name: '📦 Большие файлы',
      category: 'quick',
      description: 'Найти файлы >100MB',
      command: 'find /app -type f -size +100M 2>/dev/null | head -10 || echo "Нет больших файлов"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-recent-files',
      name: '🆕 Недавние файлы',
      category: 'quick',
      description: 'Показать недавно измененные файлы',
      command: 'find /app/workspace -type f -mtime -1 2>/dev/null | head -10 || echo "Нет недавних файлов"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-node-version',
      name: '🟢 Node.js версия',
      category: 'quick',
      description: 'Показать версию Node.js и npm',
      command: 'node --version && npm --version && echo "NPM global packages:" && npm list -g --depth=0 2>/dev/null | head -10',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-workspace-tree',
      name: '🌳 Структура workspace',
      category: 'quick',
      description: 'Показать структуру workspace/',
      command: 'ls -lh /app/workspace/ 2>/dev/null && echo "" && du -sh /app/workspace/* 2>/dev/null',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-process-count',
      name: '⚙️ Количество процессов',
      category: 'quick',
      description: 'Посчитать запущенные процессы',
      command: 'echo "Total processes: $(ps aux | wc -l)" && echo "Node processes: $(ps aux | grep node | grep -v grep | wc -l)"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-network-test',
      name: '🌐 Тест сети',
      category: 'quick',
      description: 'Проверить доступность сети',
      command: 'ping -c 2 8.8.8.8 2>&1 && echo "" && ping -c 2 1.1.1.1 2>&1',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-api-health',
      name: '🏥 API Health',
      category: 'quick',
      description: 'Проверить health endpoint',
      command: 'curl -s http://localhost:3123/api/health | head -20 || echo "API недоступен"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-logs-tail',
      name: '📜 Последние логи',
      category: 'quick',
      description: 'Показать последние 10 строк логов',
      command: 'echo "Используйте Docker → Контейнеры → fantaprojekt → Логи для просмотра логов"',
      needsConfirmation: false,
    });

    this.addCommand({
      id: 'quick-clear-cache',
      name: '🧹 Очистить кэш',
      category: 'quick',
      description: 'Удалить старые файлы из cache/',
      command: 'find /app/workspace/cache -type f -mtime +7 2>/dev/null | wc -l && echo "файлов старше 7 дней"',
      needsConfirmation: true,
    });

    logger.info({ count: this.commands.size }, 'Initialized terminal commands');
  }

  /**
   * Добавить команду в реестр
   */
  private addCommand(cmd: TerminalCommand): void {
    this.commands.set(cmd.id, cmd);
  }

  /**
   * Получить все команды
   */
  getAllCommands(): TerminalCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Получить команды по категории
   */
  getCommandsByCategory(category: CommandCategory): TerminalCommand[] {
    return this.getAllCommands().filter(cmd => cmd.category === category);
  }

  /**
   * Получить команду по ID
   */
  getCommand(id: string): TerminalCommand | undefined {
    return this.commands.get(id);
  }

  /**
   * Выполнить команду
   */
  async executeCommand(commandId: string): Promise<string> {
    const cmd = this.getCommand(commandId);

    if (!cmd) {
      throw new Error(`Command not found: ${commandId}`);
    }

    try {
      logger.debug({ commandId, command: cmd.command }, 'Executing terminal command');

      const { stdout, stderr } = await execAsync(cmd.command, {
        timeout: 10000, // 10 секунд максимум
        maxBuffer: 1024 * 1024, // 1MB максимум
      });

      const output = stdout || stderr || 'No output';

      // Форматирование вывода если есть кастомный форматтер
      const formatted = cmd.formatOutput ? cmd.formatOutput(output) : output;

      logger.debug({ commandId, outputLength: formatted.length }, 'Command executed successfully');

      return formatted;
    } catch (error) {
      logger.error({ commandId, error }, 'Failed to execute command');
      throw new Error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Выполнить произвольную команду (для кастомных команд из терминала)
   * ⚠️ БЕЗ ЗАЩИТЫ! Выполняет ЛЮБУЮ команду. Это настоящий терминал.
   */
  async executeCustomCommand(command: string): Promise<string> {
    try {
      logger.debug({ command }, 'Executing custom command (no restrictions)');

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 секунд для кастомных команд
        maxBuffer: 2 * 1024 * 1024, // 2MB максимум
      });

      return stdout || stderr || 'No output';
    } catch (error) {
      logger.error({ command, error }, 'Failed to execute custom command');
      throw new Error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Получить категории команд
   */
  getCategories(): Array<{ id: CommandCategory; name: string; emoji: string; count: number }> {
    const categories: Array<{ id: CommandCategory; name: string; emoji: string }> = [
      { id: 'quick', name: 'Быстрые команды', emoji: '⚡' },
      { id: 'monitoring', name: 'Мониторинг', emoji: '📊' },
      { id: 'processes', name: 'Процессы', emoji: '⚙️' },
      { id: 'files', name: 'Файлы', emoji: '📁' },
      { id: 'network', name: 'Сеть', emoji: '🌐' },
      { id: 'docker', name: 'Docker', emoji: '🐳' },
      { id: 'fantaprojekt', name: 'FantaProjekt', emoji: '🎬' },
    ];

    return categories.map(cat => ({
      ...cat,
      count: this.getCommandsByCategory(cat.id).length,
    }));
  }
}
