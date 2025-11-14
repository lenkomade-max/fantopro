import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger';

const execAsync = promisify(exec);

/**
 * Docker Container Info
 */
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string; // "running", "exited", "created", etc.
  state: string; // "Up 2 hours", "Exited (0) 3 days ago", etc.
  ports: string[];
  created: string;
}

/**
 * Docker Container Details
 */
export interface DockerContainerDetails extends DockerContainer {
  uptime: string;
  restartCount: number;
  cpuPercent: string;
  memoryUsage: string;
  memoryLimit: string;
  networks: string[];
}

/**
 * DockerManager - управление Docker контейнерами
 *
 * Возможности:
 * - Сканирование всех контейнеров в системе
 * - Получение детальной информации
 * - Управление контейнерами (start, stop, restart)
 * - Логи контейнеров
 * - Статистика ресурсов
 */
export class DockerManager {
  /**
   * Получить список всех контейнеров
   */
  async getAllContainers(includeStopped = true): Promise<DockerContainer[]> {
    try {
      const cmd = includeStopped
        ? 'docker ps -a --format "{{json .}}"'
        : 'docker ps --format "{{json .}}"';

      const { stdout } = await execAsync(cmd);

      if (!stdout.trim()) {
        return [];
      }

      const containers: DockerContainer[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          containers.push({
            id: data.ID,
            name: data.Names,
            image: data.Image,
            status: data.State,
            state: data.Status,
            ports: data.Ports ? data.Ports.split(',').map((p: string) => p.trim()) : [],
            created: data.CreatedAt,
          });
        } catch (error) {
          logger.warn({ line, error }, 'Failed to parse container line');
        }
      }

      logger.debug({ count: containers.length }, 'Retrieved Docker containers');
      return containers;
    } catch (error) {
      logger.error(error, 'Failed to get Docker containers');
      throw new Error(`Failed to get Docker containers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Получить детальную информацию о контейнере
   */
  async getContainerDetails(nameOrId: string): Promise<DockerContainerDetails | null> {
    try {
      // Get basic info
      const containers = await this.getAllContainers();
      const container = containers.find(c => c.name === nameOrId || c.id.startsWith(nameOrId));

      if (!container) {
        return null;
      }

      // Get detailed inspect data
      const { stdout: inspectData } = await execAsync(`docker inspect ${container.id}`);
      const inspect = JSON.parse(inspectData)[0];

      // Get stats (single sample)
      let cpuPercent = 'N/A';
      let memoryUsage = 'N/A';
      let memoryLimit = 'N/A';

      if (container.status === 'running') {
        try {
          const { stdout: statsData } = await execAsync(
            `docker stats ${container.id} --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}"`
          );
          const [cpu, mem] = statsData.trim().split('|');
          cpuPercent = cpu;
          const [usage, limit] = mem.split(' / ');
          memoryUsage = usage;
          memoryLimit = limit;
        } catch (error) {
          logger.warn({ containerId: container.id, error }, 'Failed to get container stats');
        }
      }

      const details: DockerContainerDetails = {
        ...container,
        uptime: inspect.State.Status === 'running' ? inspect.State.StartedAt : 'N/A',
        restartCount: inspect.RestartCount || 0,
        cpuPercent,
        memoryUsage,
        memoryLimit,
        networks: Object.keys(inspect.NetworkSettings.Networks || {}),
      };

      return details;
    } catch (error) {
      logger.error({ nameOrId, error }, 'Failed to get container details');
      return null;
    }
  }

  /**
   * Получить логи контейнера
   */
  async getContainerLogs(nameOrId: string, lines = 50): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs ${nameOrId} --tail ${lines} 2>&1`);
      return stdout;
    } catch (error) {
      logger.error({ nameOrId, error }, 'Failed to get container logs');
      throw new Error(`Failed to get logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Запустить контейнер
   */
  async startContainer(nameOrId: string): Promise<void> {
    try {
      await execAsync(`docker start ${nameOrId}`);
      logger.info({ container: nameOrId }, 'Container started');
    } catch (error) {
      logger.error({ nameOrId, error }, 'Failed to start container');
      throw new Error(`Failed to start container: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Остановить контейнер
   */
  async stopContainer(nameOrId: string): Promise<void> {
    try {
      await execAsync(`docker stop ${nameOrId}`);
      logger.info({ container: nameOrId }, 'Container stopped');
    } catch (error) {
      logger.error({ nameOrId, error }, 'Failed to stop container');
      throw new Error(`Failed to stop container: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Перезапустить контейнер
   */
  async restartContainer(nameOrId: string): Promise<void> {
    try {
      await execAsync(`docker restart ${nameOrId}`);
      logger.info({ container: nameOrId }, 'Container restarted');
    } catch (error) {
      logger.error({ nameOrId, error }, 'Failed to restart container');
      throw new Error(`Failed to restart container: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Пересобрать контейнер (docker-compose rebuild)
   */
  async rebuildContainer(serviceName: string, composePath = '/home/developer/projects'): Promise<void> {
    try {
      // Используем docker-compose для пересборки
      const cmd = `cd ${composePath} && docker-compose build ${serviceName}`;
      await execAsync(cmd);
      logger.info({ service: serviceName }, 'Container rebuilt');
    } catch (error) {
      logger.error({ serviceName, error }, 'Failed to rebuild container');
      throw new Error(`Failed to rebuild container: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Получить статистику всех running контейнеров
   */
  async getAllContainersStats(): Promise<string> {
    try {
      const { stdout } = await execAsync('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}"');
      return stdout;
    } catch (error) {
      logger.error(error, 'Failed to get containers stats');
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Проверить доступность Docker
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }
}
