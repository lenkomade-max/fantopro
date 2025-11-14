import { logger } from '../logger';

/**
 * Confirmation Request
 */
export interface ConfirmationRequest {
  userId: number;
  action: string;
  data?: string;
  expiresAt: number; // timestamp when confirmation expires
  createdAt: number;
}

/**
 * ConfirmationManager - управление подтверждениями для опасных действий
 *
 * Возможности:
 * - Двухэтапное подтверждение
 * - Timeout 30 секунд (автоматическая отмена)
 * - Защита от случайных нажатий
 * - Подтверждение для: docker restart, docker rebuild, kill process, rm files
 */
export class ConfirmationManager {
  private confirmations: Map<string, ConfirmationRequest> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Создать запрос на подтверждение
   */
  createConfirmation(userId: number, action: string, data?: string, timeout = this.DEFAULT_TIMEOUT): string {
    const key = this.getKey(userId, action, data);
    const now = Date.now();

    const request: ConfirmationRequest = {
      userId,
      action,
      data,
      createdAt: now,
      expiresAt: now + timeout,
    };

    this.confirmations.set(key, request);

    logger.debug({ userId, action, data, timeout }, 'Confirmation request created');

    // Автоматическая очистка после timeout
    setTimeout(() => {
      this.cancelConfirmation(userId, action, data);
    }, timeout);

    return key;
  }

  /**
   * Проверить и подтвердить действие
   */
  confirm(userId: number, action: string, data?: string): boolean {
    const key = this.getKey(userId, action, data);
    const request = this.confirmations.get(key);

    if (!request) {
      logger.warn({ userId, action, data }, 'Confirmation not found');
      return false;
    }

    // Проверить что не истёк timeout
    if (Date.now() > request.expiresAt) {
      logger.warn({ userId, action, data }, 'Confirmation expired');
      this.confirmations.delete(key);
      return false;
    }

    // Подтверждение успешно
    this.confirmations.delete(key);
    logger.info({ userId, action, data }, 'Action confirmed');
    return true;
  }

  /**
   * Отменить подтверждение
   */
  cancelConfirmation(userId: number, action: string, data?: string): void {
    const key = this.getKey(userId, action, data);
    const request = this.confirmations.get(key);

    if (request) {
      this.confirmations.delete(key);
      logger.debug({ userId, action, data }, 'Confirmation cancelled');
    }
  }

  /**
   * Проверить существует ли запрос на подтверждение
   */
  hasConfirmation(userId: number, action: string, data?: string): boolean {
    const key = this.getKey(userId, action, data);
    const request = this.confirmations.get(key);

    if (!request) {
      return false;
    }

    // Проверить что не истёк timeout
    if (Date.now() > request.expiresAt) {
      this.confirmations.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Получить запрос на подтверждение
   */
  getConfirmation(userId: number, action: string, data?: string): ConfirmationRequest | null {
    const key = this.getKey(userId, action, data);
    const request = this.confirmations.get(key);

    if (!request) {
      return null;
    }

    // Проверить что не истёк timeout
    if (Date.now() > request.expiresAt) {
      this.confirmations.delete(key);
      return null;
    }

    return request;
  }

  /**
   * Получить время до истечения подтверждения (в секундах)
   */
  getTimeRemaining(userId: number, action: string, data?: string): number {
    const request = this.getConfirmation(userId, action, data);
    if (!request) {
      return 0;
    }

    const remaining = Math.max(0, request.expiresAt - Date.now());
    return Math.ceil(remaining / 1000);
  }

  /**
   * Проверить требует ли действие подтверждения
   */
  static requiresConfirmation(action: string): boolean {
    const dangerousActions = [
      // Docker actions
      'docker:restart',
      'docker:stop',
      'docker:rebuild',
      'docker:prune',
      'container:restart',
      'container:stop',
      'container:rebuild',

      // Process management
      'process:kill',
      'process:killall',
      'process:pkill',

      // File operations
      'file:delete',
      'file:cleanup',

      // System operations
      'system:reboot',
      'system:shutdown',
    ];

    return dangerousActions.includes(action);
  }

  /**
   * Получить описание опасного действия
   */
  static getActionWarning(action: string, data?: string): string {
    const warnings: Record<string, string> = {
      'docker:restart': '⚠️ Перезапуск Docker service',
      'docker:stop': '⚠️ Остановка Docker service',
      'docker:rebuild': '⚠️ Пересборка Docker контейнеров',
      'docker:prune': '⚠️ Удаление неиспользуемых Docker ресурсов',
      'container:restart': `⚠️ Перезапуск контейнера ${data || ''}`,
      'container:stop': `⚠️ Остановка контейнера ${data || ''}`,
      'container:rebuild': `⚠️ Пересборка контейнера ${data || ''}`,
      'process:kill': `⚠️ Завершение процесса ${data || ''}`,
      'process:killall': `⚠️ Завершение всех процессов ${data || ''}`,
      'process:pkill': `⚠️ Завершение процессов по имени ${data || ''}`,
      'file:delete': `⚠️ Удаление файлов ${data || ''}`,
      'file:cleanup': '⚠️ Очистка временных файлов',
      'system:reboot': '⚠️ ПЕРЕЗАГРУЗКА СЕРВЕРА',
      'system:shutdown': '⚠️ ВЫКЛЮЧЕНИЕ СЕРВЕРА',
    };

    return warnings[action] || `⚠️ Опасное действие: ${action}`;
  }

  /**
   * Получить ключ для хранения подтверждения
   */
  private getKey(userId: number, action: string, data?: string): string {
    return `${userId}:${action}${data ? `:${data}` : ''}`;
  }

  /**
   * Очистить все истекшие подтверждения
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, request] of this.confirmations.entries()) {
      if (now > request.expiresAt) {
        this.confirmations.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up expired confirmations');
    }
  }

  /**
   * Получить количество активных подтверждений
   */
  getActiveCount(): number {
    this.cleanup();
    return this.confirmations.size;
  }
}
