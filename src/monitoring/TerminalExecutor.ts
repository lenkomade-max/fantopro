import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger';

const execAsync = promisify(exec);

/**
 * TerminalExecutor - безопасное выполнение shell команд
 */
export class TerminalExecutor {
  private readonly MAX_OUTPUT_LENGTH = 3500; // Telegram limit ~4096
  private readonly TIMEOUT_MS = 30000; // 30 seconds

  // Опасные команды которые нельзя выполнять
  private readonly DANGEROUS_COMMANDS = [
    'rm -rf /',
    'dd if=',
    'mkfs',
    ':(){:|:&};:',  // fork bomb
    '> /dev/sda',
    'mv / ',
  ];

  /**
   * Выполнить shell команду
   */
  async execute(command: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
    // Проверка на опасные команды
    if (this.isDangerous(command)) {
      throw new Error('Отказано: команда содержит опасные операции!');
    }

    logger.info({ command }, 'Executing terminal command');

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.TIMEOUT_MS,
        maxBuffer: 1024 * 1024 * 5, // 5MB
      });

      return {
        stdout: this.truncate(stdout),
        stderr: this.truncate(stderr),
        success: true,
      };
    } catch (error: any) {
      logger.error({ command, error }, 'Terminal command failed');

      return {
        stdout: error.stdout ? this.truncate(error.stdout) : '',
        stderr: error.stderr ? this.truncate(error.stderr) : error.message,
        success: false,
      };
    }
  }

  /**
   * Проверить является ли команда опасной
   */
  private isDangerous(command: string): boolean {
    const lowerCommand = command.toLowerCase();

    for (const dangerous of this.DANGEROUS_COMMANDS) {
      if (lowerCommand.includes(dangerous.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Обрезать вывод если слишком длинный
   */
  private truncate(output: string): string {
    if (output.length <= this.MAX_OUTPUT_LENGTH) {
      return output;
    }

    const half = Math.floor(this.MAX_OUTPUT_LENGTH / 2);
    return (
      output.substring(0, half) +
      '\n\n... (вывод обрезан) ...\n\n' +
      output.substring(output.length - half)
    );
  }

  /**
   * Выполнить Docker команду
   */
  async executeDocker(args: string[]): Promise<string> {
    if (args.length === 0) {
      return this.getDockerHelp();
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'ps':
        return this.dockerPs();
      case 'logs':
        return this.dockerLogs(args.slice(1));
      case 'restart':
        return this.dockerRestart(args.slice(1));
      case 'stats':
        return this.dockerStats();
      case 'stop':
        return this.dockerStop(args.slice(1));
      case 'start':
        return this.dockerStart(args.slice(1));
      default:
        return `❌ Неизвестная Docker команда: ${subcommand}\n\nИспользуйте \`/docker\` для справки.`;
    }
  }

  /**
   * Docker ps - список контейнеров
   */
  private async dockerPs(): Promise<string> {
    const result = await this.execute('docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');

    if (!result.success) {
      return `❌ Ошибка Docker ps:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `🐳 *Docker контейнеры*\n━━━━━━━━━━━━━━━━━━━━\n\n\`\`\`\n${result.stdout}\n\`\`\``;
  }

  /**
   * Docker logs - логи контейнера
   */
  private async dockerLogs(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Укажите имя контейнера!\n\nИспользование: \`/docker logs <container>\`\n\nПример: \`/docker logs n8n\``;
    }

    const container = args[0];
    const lines = args[1] ? parseInt(args[1]) : 50;

    const result = await this.execute(`docker logs ${container} --tail ${lines}`);

    if (!result.success) {
      return `❌ Ошибка получения логов:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `📝 *Логи контейнера ${container}* (последние ${lines} строк)\n━━━━━━━━━━━━━━━━━━━━\n\n\`\`\`\n${result.stdout}\n\`\`\``;
  }

  /**
   * Docker restart - перезапуск контейнера
   */
  private async dockerRestart(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Укажите имя контейнера!\n\nИспользование: \`/docker restart <container>\`\n\nПример: \`/docker restart fantaprojekt\``;
    }

    const container = args[0];
    const result = await this.execute(`docker restart ${container}`);

    if (!result.success) {
      return `❌ Ошибка перезапуска:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `✅ Контейнер \`${container}\` перезапущен!\n\n${result.stdout}`;
  }

  /**
   * Docker stats - использование ресурсов
   */
  private async dockerStats(): Promise<string> {
    const result = await this.execute('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"');

    if (!result.success) {
      return `❌ Ошибка Docker stats:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `📊 *Docker использование ресурсов*\n━━━━━━━━━━━━━━━━━━━━\n\n\`\`\`\n${result.stdout}\n\`\`\``;
  }

  /**
   * Docker stop - остановка контейнера
   */
  private async dockerStop(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Укажите имя контейнера!\n\nИспользование: \`/docker stop <container>\``;
    }

    const container = args[0];
    const result = await this.execute(`docker stop ${container}`);

    if (!result.success) {
      return `❌ Ошибка остановки:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `✅ Контейнер \`${container}\` остановлен!`;
  }

  /**
   * Docker start - запуск контейнера
   */
  private async dockerStart(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Укажите имя контейнера!\n\nИспользование: \`/docker start <container>\``;
    }

    const container = args[0];
    const result = await this.execute(`docker start ${container}`);

    if (!result.success) {
      return `❌ Ошибка запуска:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `✅ Контейнер \`${container}\` запущен!`;
  }

  /**
   * Docker помощь
   */
  private getDockerHelp(): string {
    return `🐳 *Docker команды*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Доступные команды:*\n` +
      `  \`/docker ps\` - Список контейнеров\n` +
      `  \`/docker logs <name> [lines]\` - Логи контейнера\n` +
      `  \`/docker restart <name>\` - Перезапуск\n` +
      `  \`/docker start <name>\` - Запуск\n` +
      `  \`/docker stop <name>\` - Остановка\n` +
      `  \`/docker stats\` - Использование ресурсов\n\n` +
      `*Примеры:*\n` +
      `  \`/docker ps\`\n` +
      `  \`/docker logs n8n 100\`\n` +
      `  \`/docker restart fantaprojekt\``;
  }

  /**
   * Получить использование диска
   */
  async getDiskUsage(): Promise<string> {
    const result = await this.execute('df -h / /home');

    if (!result.success) {
      return `❌ Ошибка получения информации о дисках:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `💾 *Использование дисков*\n━━━━━━━━━━━━━━━━━━━━\n\n\`\`\`\n${result.stdout}\n\`\`\``;
  }

  /**
   * Получить top процессы
   */
  async getTopProcesses(): Promise<string> {
    const result = await this.execute('ps aux --sort=-%cpu | head -n 11');

    if (!result.success) {
      return `❌ Ошибка получения процессов:\n\`\`\`\n${result.stderr}\n\`\`\``;
    }

    return `⚙️ *Top процессы (CPU)*\n━━━━━━━━━━━━━━━━━━━━\n\n\`\`\`\n${result.stdout}\n\`\`\``;
  }
}
