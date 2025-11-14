import { logger } from '../logger';
import type { ShortCreator } from '../short-creator/ShortCreator';
import type { AlertManager } from './AlertManager';
import os from 'os';

export interface ProcessInfo {
  videoId: string;
  startTime: number;
  progress: number;
  stage: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface ResourceMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  memoryUsedMB: number;
  memoryTotalMB: number;
  activeProcesses: number;
}

/**
 * ProcessMonitor - отслеживание процессов рендеринга и системных ресурсов
 */
export class ProcessMonitor {
  private processes: Map<string, ProcessInfo> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private lastDualProcessAlert: number = 0;
  private lastHighResourceAlert: number = 0;
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 минут между алертами

  constructor(
    private shortCreator: ShortCreator,
    private alertManager?: AlertManager,
  ) {}

  /**
   * Запустить мониторинг процессов
   */
  start(): void {
    if (this.checkInterval) {
      logger.warn('ProcessMonitor already started');
      return;
    }

    logger.info('Starting ProcessMonitor');

    // Проверка каждые 30 секунд
    this.checkInterval = setInterval(() => {
      this.checkProcesses();
      this.checkResources();
    }, 30000);
  }

  /**
   * Остановить мониторинг
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      logger.info('ProcessMonitor stopped');
    }
  }

  /**
   * Зарегистрировать новый процесс
   */
  registerProcess(videoId: string): void {
    this.processes.set(videoId, {
      videoId,
      startTime: Date.now(),
      progress: 0,
      stage: 'Initializing',
      status: 'queued',
    });

    logger.debug({ videoId }, 'Process registered');
  }

  /**
   * Обновить информацию о процессе
   */
  updateProcess(videoId: string, progress: number, stage: string, status: ProcessInfo['status']): void {
    const process = this.processes.get(videoId);
    if (process) {
      process.progress = progress;
      process.stage = stage;
      process.status = status;

      logger.debug({ videoId, progress, stage, status }, 'Process updated');
    }
  }

  /**
   * Удалить процесс из мониторинга
   */
  removeProcess(videoId: string): void {
    this.processes.delete(videoId);
    logger.debug({ videoId }, 'Process removed from monitoring');
  }

  /**
   * Получить список активных процессов
   */
  getActiveProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(
      p => p.status === 'processing' || p.status === 'queued'
    );
  }

  /**
   * Получить метрики системных ресурсов
   */
  getResourceMetrics(): ResourceMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    // CPU usage approximation (simplified)
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    return {
      cpuUsage: Math.round(cpuUsage * 10) / 10,
      memoryUsage: Math.round(memoryUsage * 10) / 10,
      memoryUsedMB: Math.round(usedMem / 1024 / 1024),
      memoryTotalMB: Math.round(totalMem / 1024 / 1024),
      activeProcesses: this.getActiveProcesses().length,
    };
  }

  /**
   * Проверить процессы на аномалии
   */
  private checkProcesses(): void {
    const activeProcesses = this.getActiveProcesses();

    // Алерт если два или более процесса одновременно
    if (activeProcesses.length >= 2) {
      const now = Date.now();
      if (now - this.lastDualProcessAlert > this.ALERT_COOLDOWN_MS) {
        this.sendDualProcessAlert(activeProcesses);
        this.lastDualProcessAlert = now;
      }
    }
  }

  /**
   * Проверить системные ресурсы
   */
  private checkResources(): void {
    const metrics = this.getResourceMetrics();
    const now = Date.now();

    // Алерт если память > 85% или CPU > 90%
    if ((metrics.memoryUsage > 85 || metrics.cpuUsage > 90)
        && now - this.lastHighResourceAlert > this.ALERT_COOLDOWN_MS) {
      this.sendHighResourceAlert(metrics);
      this.lastHighResourceAlert = now;
    }
  }

  /**
   * Отправить алерт о двух процессах
   */
  private async sendDualProcessAlert(processes: ProcessInfo[]): Promise<void> {
    if (!this.alertManager) return;

    const processInfo = processes.map(p =>
      `• ${p.videoId.substring(0, 8)}: ${p.stage} (${p.progress}%)`
    ).join('\n');

    await this.alertManager.sendAlert({
      type: 'warning',
      message: `⚠️ Обнаружено ${processes.length} одновременных процессов рендеринга!\n\nЭто может привести к перегрузке сервера и зависанию.\n\nАктивные процессы:\n${processInfo}`,
      context: {
        activeProcesses: processes.length,
        processes: processes.map(p => p.videoId.substring(0, 8)).join(', '),
      },
    }, 'dual_processes');
  }

  /**
   * Отправить алерт о высокой нагрузке
   */
  private async sendHighResourceAlert(metrics: ResourceMetrics): Promise<void> {
    if (!this.alertManager) return;

    await this.alertManager.sendAlert({
      type: 'warning',
      message: `⚠️ Высокая нагрузка на сервер!\n\n` +
        `CPU: ${metrics.cpuUsage}%\n` +
        `Память: ${metrics.memoryUsedMB}MB / ${metrics.memoryTotalMB}MB (${metrics.memoryUsage}%)\n` +
        `Активных процессов: ${metrics.activeProcesses}`,
      context: {
        cpuUsage: `${metrics.cpuUsage}%`,
        memoryUsage: `${metrics.memoryUsage}%`,
        activeProcesses: metrics.activeProcesses,
      },
    }, 'high_resources');
  }

  /**
   * Получить информацию о конкретном процессе
   */
  getProcess(videoId: string): ProcessInfo | undefined {
    return this.processes.get(videoId);
  }

  /**
   * Получить все процессы (включая завершенные)
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }
}
