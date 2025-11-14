import os from 'os';
import type { HealthCheckResult } from './types';

/**
 * HealthChecker - проверка состояния сервера
 */
export class HealthChecker {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Получить полную информацию о здоровье сервера
   */
  getHealthStatus(): HealthCheckResult {
    const memUsed = os.totalmem() - os.freemem();
    const memTotal = os.totalmem();
    const memPercentage = (memUsed / memTotal) * 100;

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Определяем статус на основе использования памяти
    let status: HealthCheckResult['status'] = 'healthy';
    if (memPercentage > 90) {
      status = 'unhealthy';
    } else if (memPercentage > 75) {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      timestamp: new Date().toISOString(),
      checks: {
        memory: {
          used: Math.round(memUsed / 1024 / 1024), // MB
          total: Math.round(memTotal / 1024 / 1024), // MB
          percentage: Math.round(memPercentage * 100) / 100,
        },
        cpu: {
          model: os.cpus()[0]?.model || 'Unknown',
          cores: os.cpus().length,
        },
      },
    };
  }

  /**
   * Простая проверка жив ли сервер
   */
  isAlive(): boolean {
    return true;
  }
}
