import { logger } from '../logger';
import type { ShortCreator } from '../short-creator/ShortCreator';
import type { ProcessMonitor } from './ProcessMonitor';
import type { HealthChecker } from './HealthChecker';
import type { AlertManager } from './AlertManager';
import { TerminalExecutor } from './TerminalExecutor';
import { ClaudeCodeLogger } from './ClaudeCodeLogger';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';

export type CommandName =
  | 'start'
  | 'menu'
  | 'status'
  | 'queue'
  | 'processes'
  | 'kill'
  | 'logs'
  | 'health'
  | 'help'
  | 'restart'
  | 'notifications'
  | 'exec'
  | 'docker'
  | 'disk'
  | 'top'
  | 'claude'
  | 'claude-tasks'
  | 'claude-stats';

export interface CommandContext {
  command: string;
  args: string[];
  userId: number;
  chatId: number;
}

/**
 * CommandHandler - обработчик команд Telegram бота
 */
export class CommandHandler {
  private terminalExecutor: TerminalExecutor;
  private claudeLogger: ClaudeCodeLogger;

  constructor(
    private shortCreator: ShortCreator,
    private processMonitor: ProcessMonitor,
    private healthChecker?: HealthChecker,
    private alertManager?: AlertManager,
  ) {
    this.terminalExecutor = new TerminalExecutor();
    this.claudeLogger = new ClaudeCodeLogger();
  }

  /**
   * Обработать команду
   */
  async handleCommand(ctx: CommandContext): Promise<string> {
    const { command, args } = ctx;

    logger.info({ command, args, userId: ctx.userId }, 'Processing Telegram command');

    try {
      switch (command) {
        case 'start':
        case 'menu':
          return this.handleStart();
        case 'status':
          return this.handleStatus();
        case 'queue':
          return this.handleQueue();
        case 'processes':
          return this.handleProcesses();
        case 'kill':
          return this.handleKill(args);
        case 'logs':
          return this.handleLogs(args);
        case 'health':
          return this.handleHealth();
        case 'notifications':
          return this.handleNotifications(args);
        case 'exec':
          return await this.handleExec(args);
        case 'docker':
          return await this.handleDocker(args);
        case 'disk':
          return await this.handleDisk();
        case 'top':
          return await this.handleTop();
        case 'help':
          return this.handleHelp();
        case 'restart':
          return this.handleRestart();
        default:
          return `❌ Неизвестная команда: /${command}\n\nИспользуйте /help для списка команд.`;
      }
    } catch (error) {
      logger.error(error, 'Error handling command');
      return `❌ Ошибка при выполнении команды: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * /start - приветствие и главное меню
   */
  private handleStart(): string {
    return `👋 *Добро пожаловать в FantaProjekt Control Panel!*\n\n` +
      `🤖 Это система управления сервером через Telegram.\n\n` +
      `*Доступные функции:*\n` +
      `• Мониторинг состояния сервера\n` +
      `• Управление очередью рендеринга\n` +
      `• Контроль Docker контейнеров\n` +
      `• Выполнение терминальных команд\n` +
      `• Настройка уведомлений\n\n` +
      `Используйте кнопки меню внизу 👇 или команду /help для списка команд.`;
  }

  /**
   * /status - общее состояние сервера
   */
  private async handleStatus(): Promise<string> {
    const metrics = this.processMonitor.getResourceMetrics();
    const activeProcesses = this.processMonitor.getActiveProcesses();
    const uptime = Math.round(process.uptime() / 60); // minutes

    let message = `📊 *Состояние сервера*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // System resources
    message += `💻 *Ресурсы:*\n`;
    message += `  • CPU: ${metrics.cpuUsage}%\n`;
    message += `  • Память: ${metrics.memoryUsedMB}/${metrics.memoryTotalMB}MB (${metrics.memoryUsage}%)\n`;
    message += `  • Uptime: ${uptime} минут\n\n`;

    // Queue status
    message += `🎬 *Рендеринг:*\n`;
    message += `  • Активных процессов: ${activeProcesses.length}\n`;

    if (activeProcesses.length > 0) {
      const current = activeProcesses[0];
      message += `  • Текущий: ${current.videoId.substring(0, 8)}...\n`;
      message += `  • Прогресс: ${current.progress}%\n`;
      message += `  • Стадия: ${current.stage}\n`;
    }

    // Warning if multiple processes
    if (activeProcesses.length > 1) {
      message += `\n⚠️ *Внимание:* Одновременно обрабатывается ${activeProcesses.length} видео!\n`;
    }

    return message;
  }

  /**
   * /queue - текущая очередь
   */
  private async handleQueue(): Promise<string> {
    const activeProcesses = this.processMonitor.getActiveProcesses();

    let message = `📋 *Очередь рендеринга*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (activeProcesses.length === 0) {
      message += `✅ Очередь пуста!\n\nВсе задачи выполнены.`;
      return message;
    }

    message += `Всего задач: ${activeProcesses.length}\n\n`;

    activeProcesses.forEach((process, index) => {
      const elapsed = Math.round((Date.now() - process.startTime) / 1000 / 60); // minutes
      message += `${index + 1}. ${process.videoId.substring(0, 8)}...\n`;
      message += `   • Статус: ${this.getStatusEmoji(process.status)} ${this.getStatusLabel(process.status)}\n`;
      message += `   • Прогресс: ${process.progress}%\n`;
      message += `   • Стадия: ${process.stage}\n`;
      message += `   • Время: ${elapsed} мин\n\n`;
    });

    return message;
  }

  /**
   * /processes - детальная информация о процессах
   */
  private async handleProcesses(): Promise<string> {
    const activeProcesses = this.processMonitor.getActiveProcesses();

    let message = `⚙️ *Активные процессы*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (activeProcesses.length === 0) {
      message += `✅ Нет активных процессов\n\nСервер свободен и готов к новым задачам.`;
      return message;
    }

    activeProcesses.forEach((process, index) => {
      const elapsed = Math.round((Date.now() - process.startTime) / 1000); // seconds
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;

      message += `*${index + 1}. Video ID:* \`${process.videoId}\`\n`;
      message += `   • Прогресс: ${this.getProgressBar(process.progress)} ${process.progress}%\n`;
      message += `   • Стадия: ${process.stage}\n`;
      message += `   • Время: ${minutes}м ${seconds}с\n`;
      message += `   • Статус: ${this.getStatusEmoji(process.status)} ${this.getStatusLabel(process.status)}\n\n`;
    });

    message += `\n💡 Используйте \`/kill <videoId>\` для остановки процесса`;

    return message;
  }

  /**
   * /kill <videoId> - остановить процесс
   */
  private async handleKill(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Укажите ID видео!\n\nИспользование: \`/kill <videoId>\`\n\nПример: \`/kill cmgzf7q\``;
    }

    const videoId = args[0];
    const process = this.processMonitor.getProcess(videoId);

    if (!process) {
      return `❌ Процесс с ID \`${videoId}\` не найден!\n\nИспользуйте \`/processes\` для списка активных процессов.`;
    }

    // Mark process as failed and remove from monitoring
    this.processMonitor.updateProcess(videoId, process.progress, 'Killed by user', 'failed');
    this.processMonitor.removeProcess(videoId);

    logger.warn({ videoId }, 'Process killed by Telegram command');

    return `✅ Процесс \`${videoId}\` остановлен!\n\n` +
      `• Был на стадии: ${process.stage}\n` +
      `• Прогресс: ${process.progress}%\n\n` +
      `⚠️ *Внимание:* Временные файлы могут остаться на диске.`;
  }

  /**
   * /logs [lines] - последние строки логов
   */
  private async handleLogs(args: string[]): Promise<string> {
    return `📝 *Просмотр логов*\n\n` +
      `Используйте кнопки меню:\n` +
      `• 🐳 *Docker* → Контейнеры → fantaprojekt → Логи\n\n` +
      `_Логи сервера хранятся в stdout/stderr контейнера_`;
  }

  /**
   * /health - полная диагностика
   */
  private async handleHealth(): Promise<string> {
    const health = this.healthChecker?.getHealthStatus();
    const metrics = this.processMonitor.getResourceMetrics();
    const activeProcesses = this.processMonitor.getActiveProcesses();

    let message = `🏥 *Диагностика сервера*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Overall status
    const statusEmoji = health?.status === 'healthy' ? '✅' : health?.status === 'degraded' ? '⚠️' : '❌';
    message += `*Общий статус:* ${statusEmoji} ${health?.status || 'unknown'}\n\n`;

    // System info
    message += `💻 *Система:*\n`;
    message += `  • OS: ${os.platform()} ${os.release()}\n`;
    message += `  • Hostname: ${os.hostname()}\n`;
    message += `  • Node.js: ${process.version}\n`;
    message += `  • Uptime: ${Math.round(os.uptime() / 3600)}ч\n\n`;

    // Resources
    message += `📊 *Ресурсы:*\n`;
    message += `  • CPU: ${metrics.cpuUsage}% (${os.cpus().length} cores)\n`;
    message += `  • Memory: ${metrics.memoryUsedMB}/${metrics.memoryTotalMB}MB (${metrics.memoryUsage}%)\n`;
    message += `  • Load Average: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}\n\n`;

    // Processes
    message += `🎬 *Рендеринг:*\n`;
    message += `  • Активных процессов: ${activeProcesses.length}\n`;

    if (activeProcesses.length > 0) {
      message += `  • Процессы:\n`;
      activeProcesses.forEach(p => {
        message += `    - ${p.videoId.substring(0, 8)}: ${p.progress}%\n`;
      });
    }

    // Warnings
    if (metrics.memoryUsage > 85) {
      message += `\n⚠️ *Предупреждение:* Высокое использование памяти!\n`;
    }
    if (metrics.cpuUsage > 90) {
      message += `\n⚠️ *Предупреждение:* Высокая нагрузка CPU!\n`;
    }
    if (activeProcesses.length > 1) {
      message += `\n⚠️ *Предупреждение:* Множественные процессы!\n`;
    }

    return message;
  }

  /**
   * /notifications - управление уведомлениями
   */
  private handleNotifications(args: string[]): string {
    if (!this.alertManager) {
      return `❌ Система уведомлений не настроена!`;
    }

    const notificationManager = this.alertManager.getNotificationManager();

    // Без аргументов - показать текущие настройки
    if (args.length === 0) {
      const types = notificationManager.getAllTypes();
      const enabled = types.filter(t => t.enabled && !t.critical);
      const disabled = types.filter(t => !t.enabled && !t.critical);
      const critical = types.filter(t => t.critical);

      let message = `🔔 *Управление уведомлениями*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      message += `*Включены (${enabled.length}):*\n`;
      enabled.forEach(t => {
        message += `  ✅ \`${t.type}\` - ${t.description}\n`;
      });

      if (disabled.length > 0) {
        message += `\n*Выключены (${disabled.length}):*\n`;
        disabled.forEach(t => {
          message += `  ⏸ \`${t.type}\` - ${t.description}\n`;
        });
      }

      message += `\n*Всегда включены (критичные):*\n`;
      critical.forEach(t => {
        message += `  🔒 \`${t.type}\` - ${t.description}\n`;
      });

      message += `\n*Команды:*\n`;
      message += `  \`/notifications disable <type>\` - Выключить\n`;
      message += `  \`/notifications enable <type>\` - Включить\n`;
      message += `  \`/notifications reset\` - Сбросить\n\n`;

      message += `*Пример:* \`/notifications disable video_created\``;

      return message;
    }

    const action = args[0].toLowerCase();
    const type = args[1];

    // Reset
    if (action === 'reset') {
      notificationManager.reset();
      return `✅ Настройки уведомлений сброшены на defaults!\n\nВсе уведомления включены.`;
    }

    // Enable/Disable
    if (action === 'enable' || action === 'disable') {
      if (!type) {
        return `❌ Укажите тип уведомления!\n\n` +
          `Использование: \`/notifications ${action} <type>\`\n\n` +
          `Пример: \`/notifications ${action} video_created\`\n\n` +
          `Используйте \`/notifications\` для списка доступных типов.`;
      }

      if (action === 'enable') {
        notificationManager.enable(type as any);
        const description = notificationManager.getDescription(type as any);
        return `✅ Уведомление \`${type}\` включено!\n\n${description}`;
      } else {
        const result = notificationManager.disable(type as any);
        if (!result.success) {
          return `❌ Ошибка: ${result.reason}`;
        }
        const description = notificationManager.getDescription(type as any);
        return `✅ Уведомление \`${type}\` выключено!\n\n` +
          `${description}\n\n` +
          `Включить: \`/notifications enable ${type}\``;
      }
    }

    return `❌ Неизвестная команда!\n\n` +
      `Использование:\n` +
      `  \`/notifications\` - Показать настройки\n` +
      `  \`/notifications enable <type>\`\n` +
      `  \`/notifications disable <type>\`\n` +
      `  \`/notifications reset\``;
  }

  /**
   * /help - список команд
   */
  private handleHelp(): string {
    let message = `🤖 *Команды FantaProjekt Bot*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    message += `📊 *Мониторинг:*\n`;
    message += `  /status - Состояние сервера\n`;
    message += `  /queue - Очередь рендеринга\n`;
    message += `  /processes - Активные процессы\n`;
    message += `  /health - Полная диагностика\n\n`;

    message += `⚙️ *Управление:*\n`;
    message += `  /kill <videoId> - Остановить процесс\n`;
    message += `  /logs [lines] - Последние логи (default: 20)\n`;
    message += `  /notifications - Управление уведомлениями\n`;
    message += `  /restart - Перезапуск сервера\n\n`;

    message += `🐳 *Docker (весь /root):*\n`;
    message += `  /docker ps - Статус контейнеров\n`;
    message += `  /docker logs <service> - Логи контейнера\n`;
    message += `  /docker restart <service> - Перезапуск\n`;
    message += `  /docker stats - Использование ресурсов\n\n`;

    message += `💻 *Система:*\n`;
    message += `  /exec <command> - Выполнить команду\n`;
    message += `  /disk - Использование диска\n`;
    message += `  /top - Процессы CPU/RAM\n\n`;

    message += `❓ *Помощь:*\n`;
    message += `  /help - Это сообщение\n\n`;

    message += `💡 *Примеры:*\n`;
    message += `  \`/kill cmgzf7q\`\n`;
    message += `  \`/logs 50\`\n`;
    message += `  \`/docker restart n8n\`\n`;
    message += `  \`/exec ls -la /root\`\n`;

    return message;
  }

  /**
   * /exec - выполнить shell команду
   */
  private async handleExec(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Укажите команду для выполнения!\n\n` +
        `Использование: \`/exec <command>\`\n\n` +
        `Примеры:\n` +
        `  \`/exec ls -la /root\`\n` +
        `  \`/exec df -h\`\n` +
        `  \`/exec free -h\`\n\n` +
        `⚠️ *Внимание:* Опасные команды заблокированы!`;
    }

    const command = args.join(' ');

    try {
      const result = await this.terminalExecutor.execute(command);

      let message = `💻 *Выполнение команды*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `\`${command}\`\n\n`;

      if (result.success) {
        if (result.stdout) {
          message += `*Результат:*\n\`\`\`\n${result.stdout}\n\`\`\`\n`;
        }
        if (result.stderr) {
          message += `\n*Предупреждения:*\n\`\`\`\n${result.stderr}\n\`\`\``;
        }
      } else {
        message += `❌ *Ошибка выполнения:*\n\`\`\`\n${result.stderr}\n\`\`\``;
      }

      return message;
    } catch (error) {
      return `❌ *Ошибка:* ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * /docker - управление Docker контейнерами
   */
  private async handleDocker(args: string[]): Promise<string> {
    try {
      return await this.terminalExecutor.executeDocker(args);
    } catch (error) {
      return `❌ *Ошибка:* ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * /disk - использование диска
   */
  private async handleDisk(): Promise<string> {
    try {
      return await this.terminalExecutor.getDiskUsage();
    } catch (error) {
      return `❌ *Ошибка:* ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * /top - процессы CPU/RAM
   */
  private async handleTop(): Promise<string> {
    try {
      return await this.terminalExecutor.getTopProcesses();
    } catch (error) {
      return `❌ *Ошибка:* ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * /restart - перезапуск сервера
   */
  private handleRestart(): string {
    // This is a placeholder - actual implementation depends on deployment
    return `⚠️ *Перезапуск сервера*\n\n` +
      `Эта команда требует ручного подтверждения.\n\n` +
      `Для перезапуска используйте:\n` +
      `\`/docker restart fantaprojekt\`\n\n` +
      `Или через systemd:\n` +
      `\`sudo systemctl restart fantaprojekt\``;
  }

  /**
   * Получить эмодзи для статуса
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'queued':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  }

  /**
   * Получить лейбл для статуса
   */
  private getStatusLabel(status: string): string {
    switch (status) {
      case 'queued':
        return 'В очереди';
      case 'processing':
        return 'Обработка';
      case 'completed':
        return 'Завершено';
      case 'failed':
        return 'Ошибка';
      default:
        return 'Неизвестно';
    }
  }

  /**
   * Создать прогресс бар
   */
  private getProgressBar(progress: number): string {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
