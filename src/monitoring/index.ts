/**
 * Модуль мониторинга и уведомлений
 *
 * Этот модуль отвечает за:
 * - Отправку уведомлений в Telegram о критических событиях
 * - Health check сервера
 * - Мониторинг системных ресурсов
 * - Двустороннюю связь через Telegram бота
 * - Управление процессами рендеринга
 */

export { AlertManager } from './AlertManager';
export { HealthChecker } from './HealthChecker';
export { ProcessMonitor } from './ProcessMonitor';
export { TelegramBotController } from './TelegramBotController';
export { CommandHandler } from './CommandHandler';
export { NotificationManager } from './NotificationManager';
export { TerminalExecutor } from './TerminalExecutor';
export type { NotificationType } from './NotificationManager';
export type {
  AlertConfig,
  AlertData,
  AlertType,
  HealthCheckResult,
  ProcessInfo,
  ResourceMetrics,
  BotConfig,
} from './types';
