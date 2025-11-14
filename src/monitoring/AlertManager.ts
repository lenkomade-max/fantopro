import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../logger';
import os from 'os';
import type { AlertConfig, AlertData, AlertType } from './types';
import { NotificationManager, type NotificationType } from './NotificationManager';

/**
 * AlertManager - система уведомлений о критических событиях
 * Отправляет уведомления в Telegram при падении сервера или критических ошибках
 */
export class AlertManager {
  private bot?: TelegramBot;
  private chatId?: string;
  private config: AlertConfig;
  private lastAlertTime: Map<string, number> = new Map();
  private readonly ALERT_COOLDOWN_MS = 60000; // 1 минута между одинаковыми алертами
  private notificationManager: NotificationManager;

  constructor(config: AlertConfig, notificationManager?: NotificationManager) {
    this.config = config;
    this.notificationManager = notificationManager || new NotificationManager();

    if (config.enabled && config.telegramChatId) {
      this.chatId = config.telegramChatId;
      logger.info('AlertManager initialized (bot will be set by TelegramBotController)');
    } else {
      logger.info('AlertManager initialized without notifications (disabled or missing config)');
    }
  }

  /**
   * Set the Telegram bot instance (called by TelegramBotController)
   */
  setBot(bot: TelegramBot): void {
    this.bot = bot;
    logger.info('AlertManager: Telegram bot instance set');
  }

  /**
   * Получить NotificationManager
   */
  getNotificationManager(): NotificationManager {
    return this.notificationManager;
  }

  /**
   * Отправить алерт
   */
  async sendAlert(data: AlertData, notificationType?: NotificationType): Promise<void> {
    if (!this.bot || !this.chatId) {
      logger.debug('Alert not sent: notifications disabled');
      return;
    }

    // Проверить настройки уведомлений
    if (notificationType && !this.notificationManager.isEnabled(notificationType)) {
      logger.debug({ type: notificationType }, 'Alert not sent: notification type disabled');
      return;
    }

    // Проверка cooldown для предотвращения спама
    const alertKey = `${data.type}-${data.message}`;
    const lastTime = this.lastAlertTime.get(alertKey);
    if (lastTime && Date.now() - lastTime < this.ALERT_COOLDOWN_MS) {
      logger.debug(`Alert cooldown active for: ${alertKey}`);
      return;
    }

    try {
      const message = this.formatAlertMessage(data);
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });

      this.lastAlertTime.set(alertKey, Date.now());
      logger.info({ type: data.type, message: data.message, notificationType }, 'Alert sent successfully');
    } catch (error) {
      logger.error(error, 'Failed to send Telegram alert');
    }
  }

  /**
   * Форматирование сообщения для Telegram
   */
  private formatAlertMessage(data: AlertData): string {
    const emoji = this.getEmojiForType(data.type);
    const timestamp = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const hostname = os.hostname();

    // Компактный заголовок - сразу суть сообщения
    let message = `${emoji} ${this.escapeMarkdown(data.message)}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🖥 *Сервер:* ${this.config.serverName}\n`;
    message += `📍 *Хост:* ${hostname}:${this.config.port}\n`;
    message += `🕐 *Время:* ${timestamp}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Информация об ошибке
    if (data.error) {
      message += `\n❌ *Детали ошибки:*\n`;
      message += `\`${this.escapeMarkdown(data.error.message)}\`\n`;

      if (data.error.stack) {
        const stackLines = data.error.stack.split('\n').slice(0, 3);
        const cleanStack = stackLines
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');

        if (cleanStack) {
          message += `\n📍 *Где произошла ошибка:*\n`;
          message += `\`\`\`\n${this.escapeMarkdown(cleanStack)}\n\`\`\`\n`;
        }
      }
    }

    // Контекст (если есть) - без лишнего заголовка
    if (data.context && Object.keys(data.context).length > 0) {
      for (const [key, value] of Object.entries(data.context)) {
        const keyRu = this.translateContextKey(key);
        message += `  • ${keyRu}: \`${this.escapeMarkdown(String(value))}\`\n`;
      }
      message += `\n`;
    }

    // Информация о системе (компактно)
    const totalMemGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
    const freeMemGB = Math.round(os.freemem() / 1024 / 1024 / 1024);
    const usedMemGB = totalMemGB - freeMemGB;
    const memPercent = Math.round((usedMemGB / totalMemGB) * 100);
    const uptimeHours = Math.round(os.uptime() / 3600);

    message += `\n💻 *Состояние системы:*\n`;
    message += `  • Память: ${usedMemGB}/${totalMemGB}GB (${memPercent}%)\n`;
    message += `  • Процессор: ${os.cpus().length} ядер\n`;
    message += `  • Работает: ${uptimeHours}ч\n`;

    return message;
  }

  /**
   * Получить человекопонятное название типа алерта
   */
  private getTypeLabelRu(type: AlertType): string {
    switch (type) {
      case 'critical':
        return 'КРИТИЧЕСКАЯ ОШИБКА';
      case 'error':
        return 'ОШИБКА';
      case 'warning':
        return 'ПРЕДУПРЕЖДЕНИЕ';
      case 'info':
        return 'ИНФОРМАЦИЯ';
      default:
        return 'УВЕДОМЛЕНИЕ';
    }
  }

  /**
   * Перевод ключей контекста на русский
   */
  private translateContextKey(key: string): string {
    const translations: Record<string, string> = {
      'port': 'Порт',
      'nodeVersion': 'Версия Node.js',
      'platform': 'Платформа',
      'pid': 'ID процесса',
      'uptime': 'Работает',
      'videoId': 'ID видео',
      'userId': 'ID пользователя',
      'endpoint': 'API endpoint',
      'duration': 'Длительность',
      'test': 'Тестовый режим',
      'timestamp': 'Время события',
      'scenesCount': 'Количество сцен',
    };

    return translations[key] || key;
  }

  /**
   * Получить эмодзи для типа алерта
   */
  private getEmojiForType(type: AlertType): string {
    switch (type) {
      case 'critical':
        return '🚨';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  }

  /**
   * Экранирование специальных символов Markdown
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * Отправить уведомление о запуске сервера
   */
  async sendServerStarted(): Promise<void> {
    await this.sendAlert({
      type: 'info',
      message: `🚀 Сервер успешно запущен и готов к работе! 🚀`,
      context: {
        'Порт': this.config.port,
        'Версия Node.js': process.version,
        'Платформа': process.platform,
      },
    }, 'server_started');
  }

  /**
   * Отправить уведомление о падении сервера
   */
  async sendServerCrashed(error: Error): Promise<void> {
    await this.sendAlert({
      type: 'critical',
      message: `Сервер неожиданно остановился и требует перезапуска! Необходимо проверить логи и устранить проблему.`,
      error,
      context: {
        pid: process.pid,
        uptime: `${Math.round(process.uptime() / 60)} минут`,
      },
    }, 'server_crashed');
  }

  /**
   * Отправить уведомление об unhandled rejection
   */
  async sendUnhandledRejection(reason: unknown): Promise<void> {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    await this.sendAlert({
      type: 'critical',
      message: `Обнаружена необработанная ошибка в асинхронном коде (Promise). Это может привести к нестабильной работе сервера.`,
      error,
    }, 'unhandled_rejection');
  }

  /**
   * Отправить уведомление об uncaught exception
   */
  async sendUncaughtException(error: Error): Promise<void> {
    await this.sendAlert({
      type: 'critical',
      message: `Произошла критическая необработанная ошибка! Сервер будет автоматически перезапущен.`,
      error,
    }, 'uncaught_exception');
  }

  /**
   * Тестовое уведомление для проверки работы
   */
  async sendTestAlert(): Promise<void> {
    await this.sendAlert({
      type: 'info',
      message: `Система мониторинга работает исправно! Все уведомления приходят корректно.`,
      context: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Отправить уведомление о новом запросе на создание видео
   */
  async sendVideoRequestReceived(videoId: string, scenesCount: number): Promise<void> {
    await this.sendAlert({
      type: 'info',
      message: `🎬 Получен новый запрос на создание видео!`,
      context: {
        'ID видео': videoId,
        'Количество сцен': `${scenesCount} сцен${scenesCount === 1 ? 'а' : scenesCount < 5 ? 'ы' : ''}`,
      },
    }, 'video_request');
  }

  /**
   * Отправить уведомление об успешном создании видео
   */
  async sendVideoCreated(videoId: string, duration: number, scenesCount: number): Promise<void> {
    const durationMin = Math.floor(duration / 60);
    const durationSec = Math.round(duration % 60);
    const durationStr = durationMin > 0
      ? `${durationMin}м ${durationSec}с`
      : `${durationSec}с`;

    await this.sendAlert({
      type: 'info',
      message: `✅ Видео успешно создано! 🎉`,
      context: {
        'ID видео': videoId,
        'Длительность': durationStr,
        'Количество сцен': `${scenesCount} сцен${scenesCount === 1 ? 'а' : scenesCount < 5 ? 'ы' : ''}`,
      },
    }, 'video_created');
  }

  /**
   * Отправить уведомление об ошибке при создании видео
   */
  async sendVideoCreationFailed(videoId: string, error: Error, scenesCount: number): Promise<void> {
    await this.sendAlert({
      type: 'error',
      message: `❌ Не удалось создать видео! Произошла ошибка в процессе генерации.`,
      error,
      context: {
        'ID видео': videoId,
        'Количество сцен': `${scenesCount} сцен${scenesCount === 1 ? 'а' : scenesCount < 5 ? 'ы' : ''}`,
      },
    }, 'video_failed');
  }
}
