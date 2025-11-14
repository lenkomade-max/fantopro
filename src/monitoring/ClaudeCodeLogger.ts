import fs from 'fs-extra';
import path from 'path';
import { logger } from '../logger';

/**
 * Task entry for Claude Code integration
 */
export interface ClaudeTask {
  id: string;
  command: string;
  timestamp: string;
  userId: string;
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

/**
 * ClaudeCodeLogger - логирование задач для Claude Code через Telegram
 *
 * Это базовая версия которая сохраняет историю команд.
 * В будущем можно интегрировать с настоящим Claude Code агентом.
 */
export class ClaudeCodeLogger {
  private readonly tasksFile: string;
  private tasks: ClaudeTask[] = [];
  private readonly MAX_TASKS = 100; // Хранить последние 100 задач

  constructor(dataDir: string = './workspace/claude-tasks') {
    this.tasksFile = path.join(dataDir, 'tasks.json');
    this.initializeStorage();
  }

  /**
   * Инициализация хранилища
   */
  private async initializeStorage(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.tasksFile));

      if (await fs.pathExists(this.tasksFile)) {
        const data = await fs.readFile(this.tasksFile, 'utf-8');
        this.tasks = JSON.parse(data);
        logger.info({ count: this.tasks.length }, 'Loaded Claude Code task history');
      } else {
        this.tasks = [];
        await this.saveTasks();
        logger.info('Initialized empty Claude Code task history');
      }
    } catch (error) {
      logger.error(error, 'Failed to initialize Claude Code task storage');
      this.tasks = [];
    }
  }

  /**
   * Сохранить задачи в файл
   */
  private async saveTasks(): Promise<void> {
    try {
      await fs.writeFile(
        this.tasksFile,
        JSON.stringify(this.tasks, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error(error, 'Failed to save Claude Code tasks');
    }
  }

  /**
   * Добавить новую задачу
   */
  async logTask(command: string, userId: string): Promise<ClaudeTask> {
    const task: ClaudeTask = {
      id: `task_${Date.now()}`,
      command,
      timestamp: new Date().toISOString(),
      userId,
      status: 'pending',
    };

    this.tasks.unshift(task); // Добавить в начало

    // Ограничить количество задач
    if (this.tasks.length > this.MAX_TASKS) {
      this.tasks = this.tasks.slice(0, this.MAX_TASKS);
    }

    await this.saveTasks();
    logger.info({ taskId: task.id, command }, 'Logged new Claude Code task');

    return task;
  }

  /**
   * Обновить статус задачи
   */
  async updateTask(
    taskId: string,
    status: 'completed' | 'failed',
    result?: string,
    error?: string
  ): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId);

    if (!task) {
      logger.warn({ taskId }, 'Task not found for update');
      return;
    }

    task.status = status;
    if (result) task.result = result;
    if (error) task.error = error;

    await this.saveTasks();
    logger.info({ taskId, status }, 'Updated Claude Code task status');
  }

  /**
   * Получить последние задачи
   */
  getRecentTasks(limit: number = 10): ClaudeTask[] {
    return this.tasks.slice(0, Math.min(limit, this.tasks.length));
  }

  /**
   * Получить задачу по ID
   */
  getTask(taskId: string): ClaudeTask | undefined {
    return this.tasks.find(t => t.id === taskId);
  }

  /**
   * Получить статистику
   */
  getStats(): {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  } {
    return {
      total: this.tasks.length,
      pending: this.tasks.filter(t => t.status === 'pending').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      failed: this.tasks.filter(t => t.status === 'failed').length,
    };
  }

  /**
   * Очистить старые завершенные задачи
   */
  async cleanup(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const beforeCount = this.tasks.length;

    this.tasks = this.tasks.filter(task => {
      const taskDate = new Date(task.timestamp);
      // Сохранить pending задачи и недавние
      return task.status === 'pending' || taskDate > cutoffDate;
    });

    const removedCount = beforeCount - this.tasks.length;

    if (removedCount > 0) {
      await this.saveTasks();
      logger.info({ removedCount, daysOld }, 'Cleaned up old Claude Code tasks');
    }

    return removedCount;
  }

  /**
   * Форматировать задачу для отображения
   */
  formatTask(task: ClaudeTask): string {
    const statusEmoji = task.status === 'completed' ? '✅' :
                       task.status === 'failed' ? '❌' : '⏳';

    const date = new Date(task.timestamp);
    const timeStr = date.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    let msg = `${statusEmoji} ${task.id}\n`;
    msg += `  • Команда: \`${task.command.substring(0, 50)}${task.command.length > 50 ? '...' : ''}\`\n`;
    msg += `  • Время: ${timeStr}\n`;

    if (task.result) {
      msg += `  • Результат: \`${task.result.substring(0, 100)}${task.result.length > 100 ? '...' : ''}\`\n`;
    }

    if (task.error) {
      msg += `  • Ошибка: \`${task.error.substring(0, 100)}${task.error.length > 100 ? '...' : ''}\`\n`;
    }

    return msg;
  }
}
