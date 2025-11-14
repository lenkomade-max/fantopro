/**
 * Типы для модуля мониторинга и уведомлений
 */

export interface AlertConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  enabled: boolean;
  serverName: string;
  port: number;
}

export type AlertType = 'error' | 'warning' | 'critical' | 'info';

export interface AlertData {
  type: AlertType;
  message: string;
  error?: Error;
  context?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  checks: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      model: string;
      cores: number;
    };
    disk?: {
      available: number;
    };
  };
}

export interface ProcessInfo {
  videoId: string;
  startTime: number;
  progress: number;
  stage: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  activeProcesses: number;
}

export interface BotConfig {
  token: string;
  chatId: string;
  enabled: boolean;
  authorizedUserIds?: number[];
}
