import { logger } from '../logger';
import fs from 'fs-extra';
import path from 'path';

export type NotificationType =
  | 'server_started'
  | 'server_stopped'
  | 'video_request'
  | 'video_created'
  | 'video_failed'
  | 'dual_processes'
  | 'high_resources'
  | 'uncaught_exception'
  | 'unhandled_rejection'
  | 'server_crashed';

interface NotificationSettings {
  [key: string]: boolean;
}

/**
 * NotificationManager - управление настройками уведомлений
 */
export class NotificationManager {
  private settings: NotificationSettings;
  private settingsPath: string;

  // Критичные уведомления, которые нельзя выключить
  private readonly CRITICAL_NOTIFICATIONS: NotificationType[] = [
    'video_failed',
    'dual_processes',
    'uncaught_exception',
    'unhandled_rejection',
    'server_crashed',
  ];

  // Дефолтные настройки
  private readonly DEFAULT_SETTINGS: NotificationSettings = {
    server_started: true,
    server_stopped: true,
    video_request: true,
    video_created: true,
    video_failed: true, // критичное
    dual_processes: true, // критичное
    high_resources: true,
    uncaught_exception: true, // критичное
    unhandled_rejection: true, // критичное
    server_crashed: true, // критичное
  };

  constructor(settingsPath?: string) {
    this.settingsPath = settingsPath || path.join(process.cwd(), 'workspace', 'notification-settings.json');
    this.settings = this.loadSettings();
  }

  /**
   * Загрузить настройки из файла
   */
  private loadSettings(): NotificationSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const loaded = JSON.parse(data);
        logger.info({ settingsPath: this.settingsPath }, 'Notification settings loaded');
        return { ...this.DEFAULT_SETTINGS, ...loaded };
      }
    } catch (error) {
      logger.warn(error, 'Failed to load notification settings, using defaults');
    }

    return { ...this.DEFAULT_SETTINGS };
  }

  /**
   * Сохранить настройки в файл
   */
  private saveSettings(): void {
    try {
      fs.ensureDirSync(path.dirname(this.settingsPath));
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      logger.info({ settingsPath: this.settingsPath }, 'Notification settings saved');
    } catch (error) {
      logger.error(error, 'Failed to save notification settings');
    }
  }

  /**
   * Проверить, включено ли уведомление
   */
  isEnabled(type: NotificationType): boolean {
    return this.settings[type] !== false; // по умолчанию включено
  }

  /**
   * Включить уведомление
   */
  enable(type: NotificationType): boolean {
    this.settings[type] = true;
    this.saveSettings();
    logger.info({ type }, 'Notification enabled');
    return true;
  }

  /**
   * Выключить уведомление
   */
  disable(type: NotificationType): { success: boolean; reason?: string } {
    // Проверить что это не критичное уведомление
    if (this.CRITICAL_NOTIFICATIONS.includes(type)) {
      return {
        success: false,
        reason: 'Это критичное уведомление, его нельзя выключить',
      };
    }

    this.settings[type] = false;
    this.saveSettings();
    logger.info({ type }, 'Notification disabled');
    return { success: true };
  }

  /**
   * Сбросить все настройки на дефолтные
   */
  reset(): void {
    this.settings = { ...this.DEFAULT_SETTINGS };
    this.saveSettings();
    logger.info('Notification settings reset to defaults');
  }

  /**
   * Получить все настройки
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Получить список всех типов уведомлений с описанием
   */
  getAllTypes(): Array<{ type: NotificationType; description: string; enabled: boolean; critical: boolean }> {
    const types: Array<{ type: NotificationType; description: string; enabled: boolean; critical: boolean }> = [
      { type: 'server_started', description: 'Запуск сервера', enabled: this.isEnabled('server_started'), critical: false },
      { type: 'server_stopped', description: 'Остановка сервера', enabled: this.isEnabled('server_stopped'), critical: false },
      { type: 'video_request', description: 'Новый запрос на видео', enabled: this.isEnabled('video_request'), critical: false },
      { type: 'video_created', description: 'Видео готово', enabled: this.isEnabled('video_created'), critical: false },
      { type: 'video_failed', description: 'Ошибка создания видео', enabled: this.isEnabled('video_failed'), critical: true },
      { type: 'dual_processes', description: 'Два процесса одновременно', enabled: this.isEnabled('dual_processes'), critical: true },
      { type: 'high_resources', description: 'Высокая нагрузка', enabled: this.isEnabled('high_resources'), critical: false },
      { type: 'uncaught_exception', description: 'Необработанная ошибка', enabled: this.isEnabled('uncaught_exception'), critical: true },
      { type: 'unhandled_rejection', description: 'Promise rejection', enabled: this.isEnabled('unhandled_rejection'), critical: true },
      { type: 'server_crashed', description: 'Падение сервера', enabled: this.isEnabled('server_crashed'), critical: true },
    ];

    return types;
  }

  /**
   * Получить человекочитаемое описание типа
   */
  getDescription(type: NotificationType): string {
    const typeObj = this.getAllTypes().find(t => t.type === type);
    return typeObj?.description || type;
  }

  /**
   * Проверить является ли уведомление критичным
   */
  isCritical(type: NotificationType): boolean {
    return this.CRITICAL_NOTIFICATIONS.includes(type);
  }
}
