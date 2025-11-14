import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../logger';
import type { ShortCreator } from '../short-creator/ShortCreator';
import type { ProcessMonitor } from './ProcessMonitor';
import type { HealthChecker } from './HealthChecker';
import type { AlertManager } from './AlertManager';
import { CommandHandler, type CommandContext } from './CommandHandler';
import { NavigationManager } from './NavigationManager';
import { MenuBuilder } from './MenuBuilder';
import { DockerManager } from './DockerManager';
import { TerminalManager } from './TerminalManager';
import { ConfirmationManager } from './ConfirmationManager';

export interface BotConfig {
  token: string;
  chatId: string;
  enabled: boolean;
  authorizedUserIds?: number[]; // Optional: restrict to specific users
}

/**
 * TelegramBotController - управление ботом для двусторонней связи
 *
 * Возможности:
 * - Прием команд от пользователя
 * - Мониторинг процессов
 * - Управление очередью
 * - Интеграция с Claude Code
 */
export class TelegramBotController {
  private bot: TelegramBot;
  private commandHandler: CommandHandler;
  private navigationManager: NavigationManager;
  private dockerManager: DockerManager;
  private terminalManager: TerminalManager;
  private confirmationManager: ConfirmationManager;
  private processMonitor: ProcessMonitor;
  private healthChecker?: HealthChecker;
  private alertManager?: AlertManager;
  private config: BotConfig;
  private isRunning = false;

  constructor(
    config: BotConfig,
    shortCreator: ShortCreator,
    processMonitor: ProcessMonitor,
    healthChecker?: HealthChecker,
    alertManager?: AlertManager,
  ) {
    this.config = config;
    this.bot = new TelegramBot(config.token, {
      polling: config.enabled ? {
        params: {
          allowed_updates: ['message', 'callback_query'], // CRITICAL: Enable callback_query events!
        },
      } : false,
    });

    this.commandHandler = new CommandHandler(
      shortCreator,
      processMonitor,
      healthChecker,
      alertManager,
    );
    this.navigationManager = new NavigationManager();
    this.dockerManager = new DockerManager();
    this.terminalManager = new TerminalManager();
    this.confirmationManager = new ConfirmationManager();
    this.processMonitor = processMonitor;
    this.healthChecker = healthChecker;
    this.alertManager = alertManager;

    if (config.enabled) {
      this.setupHandlers();
      this.isRunning = true;
      logger.info('Telegram bot handlers configured');

      // Share bot instance with AlertManager to avoid polling conflict
      if (alertManager) {
        alertManager.setBot(this.bot);
      }

      logger.info('TelegramBotController initialized and polling started');
    } else {
      logger.info('TelegramBotController initialized but disabled');
    }
  }

  /**
   * Настроить обработчики сообщений
   */
  private setupHandlers(): void {
    // Handle all commands
    this.bot.onText(/^\/(\w+)(.*)/, async (msg, match) => {
      if (!match) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      // Check authorization
      if (!this.isAuthorized(userId)) {
        logger.warn({ userId, chatId }, 'Unauthorized access attempt');
        await this.bot.sendMessage(
          chatId,
          '❌ У вас нет прав для использования этого бота.'
        );
        return;
      }

      const command = match[1].toLowerCase();
      const argsString = match[2]?.trim() || '';
      const args = argsString ? argsString.split(/\s+/) : [];

      const ctx: CommandContext = {
        command,
        args,
        userId: userId!,
        chatId,
      };

      try {
        const response = await this.commandHandler.handleCommand(ctx);

        // Send ReplyKeyboard on /start command
        if (command === 'start' || command === 'menu') {
          await this.bot.sendMessage(chatId, response, {
            parse_mode: 'Markdown',
            reply_markup: MenuBuilder.buildReplyKeyboard(),
          });
        } else {
          await this.sendMessage(chatId, response);
        }
      } catch (error) {
        logger.error(error, 'Error handling Telegram command');
        await this.sendMessage(
          chatId,
          `❌ Ошибка при выполнении команды: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // Handle plain text messages (for ReplyKeyboard buttons)
    this.bot.on('message', async (msg) => {
      // Skip if it's a command (already handled above)
      if (msg.text?.startsWith('/')) return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      // Check authorization
      if (!this.isAuthorized(userId)) {
        return;
      }

      const text = msg.text?.trim();
      if (!text || !userId) return;

      logger.debug({ userId, chatId, text }, 'Received text message from ReplyKeyboard');

      // Handle ReplyKeyboard button presses
      await this.handleTextMessage(userId, chatId, text);
    });

    // Handle callback queries (inline button presses)
    this.bot.on('callback_query', async (query) => {
      logger.info({ queryId: query.id }, 'Callback query received (raw)');

      const chatId = query.message?.chat.id;
      const userId = query.from.id;
      const messageId = query.message?.message_id;
      const callbackData = query.data;

      if (!chatId || !callbackData) {
        logger.warn({ chatId, callbackData }, 'Invalid callback query - missing chatId or data');
        return;
      }

      // Check authorization
      if (!this.isAuthorized(userId)) {
        logger.warn({ userId }, 'Unauthorized callback query attempt');
        await this.bot.answerCallbackQuery(query.id, {
          text: '❌ У вас нет прав',
          show_alert: true,
        });
        return;
      }

      logger.info({ userId, chatId, callbackData }, 'Processing callback query');

      try {
        await this.handleCallbackQuery(userId, chatId, messageId, callbackData, query.id);
      } catch (error) {
        logger.error(error, 'Error handling callback query');
        await this.bot.answerCallbackQuery(query.id, {
          text: `❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`,
          show_alert: true,
        });
      }
    });

    // Handle errors
    this.bot.on('polling_error', (error) => {
      logger.error(error, 'Telegram polling error');
    });

    logger.info('Telegram bot handlers configured');
  }

  /**
   * Обработать текстовое сообщение (ReplyKeyboard)
   */
  private async handleTextMessage(userId: number, chatId: number, text: string): Promise<void> {
    // Check if terminal mode is active
    if (this.navigationManager.isTerminalModeActive(userId)) {
      await this.handleTerminalCommand(chatId, text);
      return;
    }

    // Map ReplyKeyboard button text to actions
    const actionMap: Record<string, string> = {
      '📊 Статус': 'main:status',
      '🎬 Очередь': 'main:queue',
      '⚙️ Процессы': 'main:processes',
      '🏥 Диагностика': 'main:health',
      '🐳 Docker': 'main:docker',
      '💻 Терминал': 'main:terminal',
      '📝 Логи': 'main:logs',
      '⚙️ Настройки': 'main:settings',
    };

    const action = actionMap[text];
    if (action) {
      // Emulate callback query
      await this.handleCallbackQuery(userId, chatId, undefined, action, undefined);
    } else {
      // Unknown text, show main menu
      await this.showMainMenu(chatId);
    }
  }

  /**
   * Обработать callback query (inline button press)
   */
  private async handleCallbackQuery(
    userId: number,
    chatId: number,
    messageId: number | undefined,
    callbackData: string,
    queryId: string | undefined,
  ): Promise<void> {
    const [category, action, ...params] = callbackData.split(':');

    logger.debug({ userId, category, action, params }, 'Processing callback query');

    // Handle confirmations
    if (category === 'confirm') {
      // User confirmed the dangerous action
      const originalAction = action;
      const originalData = params.join(':');

      if (this.confirmationManager.confirm(userId, originalAction, originalData)) {
        // Confirmation successful, execute the original action
        const [origCategory, origAction, ...origParams] = originalAction.split(':');

        if (queryId) {
          await this.bot.answerCallbackQuery(queryId, { text: '✅ Подтверждено' });
        }

        // Route to the original action handler
        if (origCategory === 'container') {
          const containerName = origAction;
          const containerAction = origParams[0];
          await this.handleContainerAction(chatId, messageId, containerName, containerAction, undefined, true, userId);
        }
      } else {
        if (queryId) {
          await this.bot.answerCallbackQuery(queryId, {
            text: '❌ Подтверждение истекло',
            show_alert: true,
          });
        }
        await this.updateOrSendMessage(
          chatId,
          messageId,
          '❌ Подтверждение истекло или не найдено',
          MenuBuilder.buildGrid([], true),
        );
      }
      return;
    }

    // Handle cancellations
    if (category === 'cancel') {
      const originalAction = action;
      const originalData = params.join(':');

      this.confirmationManager.cancelConfirmation(userId, originalAction, originalData);

      if (queryId) {
        await this.bot.answerCallbackQuery(queryId, { text: '❌ Отменено' });
      }

      await this.updateOrSendMessage(
        chatId,
        messageId,
        '❌ Действие отменено',
        MenuBuilder.buildGrid([], true),
      );
      return;
    }

    // Handle navigation
    if (category === 'nav') {
      if (action === 'back') {
        const previousScreen = this.navigationManager.goBack(userId);
        await this.showScreen(chatId, messageId, previousScreen);
        if (queryId) {
          await this.bot.answerCallbackQuery(queryId, { text: '⬅️ Назад' });
        }
        return;
      }
    }

    // Handle main menu actions
    if (category === 'main') {
      this.navigationManager.navigate(userId, `main:${action}`);
      await this.handleMainMenuAction(chatId, messageId, action);
      if (queryId) {
        await this.bot.answerCallbackQuery(queryId);
      }
      return;
    }

    // Handle Docker actions
    if (category === 'docker') {
      this.navigationManager.navigate(userId, `docker:${action}`, { params });
      await this.handleDockerAction(chatId, messageId, action, params);
      if (queryId) {
        await this.bot.answerCallbackQuery(queryId);
      }
      return;
    }

    // Handle container actions
    if (category === 'container') {
      const containerName = action;
      const containerAction = params[0];
      await this.handleContainerAction(chatId, messageId, containerName, containerAction, queryId, false, userId);
      return;
    }

    // Handle terminal actions
    if (category === 'terminal') {
      // Special handling for terminal:exit - deactivate terminal mode
      if (action === 'exit') {
        this.navigationManager.setTerminalMode(userId, false);

        if (queryId) {
          await this.bot.answerCallbackQuery(queryId, {
            text: '✅ Режим терминала выключен',
          });
        }

        await this.updateOrSendMessage(
          chatId,
          messageId,
          `✅ *Режим терминала выключен*\n\nВы вернулись в обычный режим.`,
          MenuBuilder.buildGrid([{ text: '⬅️ Главное меню', callbackData: 'main:menu' }], false),
        );
        return;
      }

      this.navigationManager.navigate(userId, `terminal:${action}`);
      await this.handleTerminalAction(chatId, messageId, action);
      if (queryId) {
        await this.bot.answerCallbackQuery(queryId);
      }
      return;
    }

    // Handle command execution
    if (category === 'cmd') {
      const commandId = action;
      await this.handleCommandExecution(chatId, messageId, commandId, queryId);
      return;
    }

    // Unknown action
    if (queryId) {
      await this.bot.answerCallbackQuery(queryId, {
        text: '❌ Неизвестное действие',
        show_alert: true,
      });
    }
  }

  /**
   * Показать экран по имени
   */
  private async showScreen(chatId: number, messageId: number | undefined, screen: string): Promise<void> {
    if (screen === 'main') {
      await this.showMainMenu(chatId, messageId);
    } else {
      const [category, action] = screen.split(':');
      if (category === 'main') {
        await this.handleMainMenuAction(chatId, messageId, action);
      } else if (category === 'docker') {
        await this.handleDockerAction(chatId, messageId, action, []);
      }
    }
  }

  /**
   * Показать главное меню
   */
  private async showMainMenu(chatId: number, messageId?: number): Promise<void> {
    const text = `🤖 *FantaProjekt Control Panel*\n\nВыберите раздел:`;
    const keyboard = MenuBuilder.buildMainMenu();

    if (messageId) {
      try {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch {
        // If edit fails, send new message
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } else {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  /**
   * Обработать действие главного меню
   */
  private async handleMainMenuAction(chatId: number, messageId: number | undefined, action: string): Promise<void> {
    switch (action) {
      case 'status':
        const statusResponse = await this.commandHandler.handleCommand({
          command: 'status',
          args: [],
          userId: 0,
          chatId,
        });
        await this.updateOrSendMessage(chatId, messageId, statusResponse, MenuBuilder.buildGrid(
          [{ text: '🔄 Обновить', callbackData: 'main:status' }],
          true,
        ));
        break;

      case 'queue':
        const queueResponse = await this.commandHandler.handleCommand({
          command: 'queue',
          args: [],
          userId: 0,
          chatId,
        });
        await this.updateOrSendMessage(chatId, messageId, queueResponse, MenuBuilder.buildGrid(
          [{ text: '🔄 Обновить', callbackData: 'main:queue' }],
          true,
        ));
        break;

      case 'processes':
        const processesResponse = await this.commandHandler.handleCommand({
          command: 'processes',
          args: [],
          userId: 0,
          chatId,
        });
        await this.updateOrSendMessage(chatId, messageId, processesResponse, MenuBuilder.buildGrid(
          [{ text: '🔄 Обновить', callbackData: 'main:processes' }],
          true,
        ));
        break;

      case 'health':
        const healthResponse = await this.commandHandler.handleCommand({
          command: 'health',
          args: [],
          userId: 0,
          chatId,
        });
        await this.updateOrSendMessage(chatId, messageId, healthResponse, MenuBuilder.buildGrid(
          [
            { text: '🔄 Обновить', callbackData: 'main:health' },
            { text: '💾 Диск', callbackData: 'main:disk' },
          ],
          true,
        ));
        break;

      case 'docker':
        const dockerMenu = MenuBuilder.buildDockerMenu();
        await this.updateOrSendMessage(chatId, messageId, '🐳 *Docker управление*\n\nВыберите действие:', dockerMenu);
        break;

      case 'terminal':
        const terminalMenu = MenuBuilder.buildTerminalMenu();
        await this.updateOrSendMessage(chatId, messageId, '💻 *Терминал*\n\nВыберите категорию:', terminalMenu);
        break;

      case 'logs':
        const logsResponse = await this.commandHandler.handleCommand({
          command: 'logs',
          args: ['20'],
          userId: 0,
          chatId,
        });
        await this.updateOrSendMessage(chatId, messageId, logsResponse, MenuBuilder.buildGrid(
          [
            { text: '🔄 Обновить', callbackData: 'main:logs' },
            { text: '📄 Больше', callbackData: 'main:logs:50' },
          ],
          true,
        ));
        break;

      case 'settings':
        await this.updateOrSendMessage(
          chatId,
          messageId,
          '⚙️ *Настройки*\n\n🚧 В разработке...',
          MenuBuilder.buildGrid([], true),
        );
        break;

      default:
        await this.showMainMenu(chatId, messageId);
    }
  }

  /**
   * Обработать Docker действие
   */
  private async handleDockerAction(
    chatId: number,
    messageId: number | undefined,
    action: string,
    params: string[],
  ): Promise<void> {
    switch (action) {
      case 'list':
        try {
          const containers = await this.dockerManager.getAllContainers();

          if (containers.length === 0) {
            await this.updateOrSendMessage(
              chatId,
              messageId,
              '🐳 *Список контейнеров*\n\n✅ Контейнеры не найдены',
              MenuBuilder.buildGrid([], true),
            );
            return;
          }

          let message = `🐳 *Список контейнеров (${containers.length})*\n\n`;

          // Create buttons for each container
          const buttons = containers.map(c => ({
            text: `${c.status === 'running' ? '🟢' : '🔴'} ${c.name}`,
            callbackData: `container:${c.name}:menu`,
          }));

          // Add summary
          const running = containers.filter(c => c.status === 'running').length;
          const stopped = containers.length - running;
          message += `Running: ${running} | Stopped: ${stopped}\n\n`;
          message += `Выберите контейнер для управления:`;

          await this.updateOrSendMessage(
            chatId,
            messageId,
            message,
            MenuBuilder.buildVertical(buttons),
          );
        } catch (error) {
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `❌ Ошибка получения списка:\n${error instanceof Error ? error.message : String(error)}`,
            MenuBuilder.buildDockerMenu(),
          );
        }
        break;

      case 'stats':
        try {
          const stats = await this.dockerManager.getAllContainersStats();
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `📊 *Docker Stats*\n\n\`\`\`\n${stats}\n\`\`\``,
            MenuBuilder.buildGrid(
              [{ text: '🔄 Обновить', callbackData: 'docker:stats' }],
              true,
            ),
          );
        } catch (error) {
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `❌ Ошибка получения статистики:\n${error instanceof Error ? error.message : String(error)}`,
            MenuBuilder.buildDockerMenu(),
          );
        }
        break;

      default:
        await this.updateOrSendMessage(
          chatId,
          messageId,
          '🚧 В разработке...',
          MenuBuilder.buildDockerMenu(),
        );
    }
  }

  /**
   * Обработать действие контейнера
   */
  private async handleContainerAction(
    chatId: number,
    messageId: number | undefined,
    containerName: string,
    action: string,
    queryId: string | undefined,
    confirmed = false,
    userId = 0,
  ): Promise<void> {
    try {
      switch (action) {
        case 'menu':
          // Show container menu with buttons
          const menu = MenuBuilder.buildContainerMenu(containerName);
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `🐳 *Контейнер: ${containerName}*\n\nВыберите действие:`,
            menu,
          );
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId);
          }
          break;

        case 'details':
          // Show detailed container info
          const details = await this.dockerManager.getContainerDetails(containerName);
          if (!details) {
            await this.updateOrSendMessage(
              chatId,
              messageId,
              `❌ Контейнер ${containerName} не найден`,
              MenuBuilder.buildGrid([], true),
            );
            return;
          }

          let detailsMsg = `🐳 *Детали контейнера: ${details.name}*\n\n`;
          detailsMsg += `📊 *Статус:* ${details.status === 'running' ? '🟢 Running' : '🔴 Stopped'}\n`;
          detailsMsg += `🏷️ *Image:* ${details.image}\n`;
          detailsMsg += `🕐 *State:* ${details.state}\n`;
          detailsMsg += `🔄 *Restarts:* ${details.restartCount}\n\n`;

          if (details.status === 'running') {
            detailsMsg += `📈 *Ресурсы:*\n`;
            detailsMsg += `  • CPU: ${details.cpuPercent}\n`;
            detailsMsg += `  • Memory: ${details.memoryUsage} / ${details.memoryLimit}\n\n`;
          }

          if (details.ports.length > 0) {
            detailsMsg += `🌐 *Порты:* ${details.ports.join(', ')}\n\n`;
          }

          if (details.networks.length > 0) {
            detailsMsg += `🔌 *Networks:* ${details.networks.join(', ')}\n`;
          }

          await this.updateOrSendMessage(
            chatId,
            messageId,
            detailsMsg,
            MenuBuilder.buildContainerMenu(containerName),
          );
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId);
          }
          break;

        case 'logs':
          // Show container logs
          const logs = await this.dockerManager.getContainerLogs(containerName, 30);
          const logsMsg = `📝 *Логи контейнера: ${containerName}*\n\n\`\`\`\n${logs.slice(-3000)}\n\`\`\``;

          await this.updateOrSendMessage(
            chatId,
            messageId,
            logsMsg,
            MenuBuilder.buildGrid(
              [
                { text: '🔄 Обновить', callbackData: `container:${containerName}:logs` },
                { text: '⬅️ Назад', callbackData: `container:${containerName}:menu` },
              ],
              false,
            ),
          );
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId);
          }
          break;

        case 'start':
          await this.dockerManager.startContainer(containerName);
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `✅ Контейнер ${containerName} запущен!`,
            MenuBuilder.buildContainerMenu(containerName),
          );
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId, { text: '✅ Запущен!' });
          }
          break;

        case 'stop':
          // Dangerous action - require confirmation
          if (!confirmed) {
            const actionKey = `container:${containerName}:stop`;
            this.confirmationManager.createConfirmation(userId, actionKey, containerName);

            const warning = ConfirmationManager.getActionWarning(actionKey, containerName);
            const timeRemaining = this.confirmationManager.getTimeRemaining(userId, actionKey, containerName);

            await this.updateOrSendMessage(
              chatId,
              messageId,
              `${warning}\n\n⏱️ Подтверждение истекает через ${timeRemaining} секунд.\n\nВы уверены?`,
              MenuBuilder.buildConfirmationMenu(actionKey, containerName),
            );
            if (queryId) {
              await this.bot.answerCallbackQuery(queryId);
            }
            break;
          }

          // Confirmed - execute action
          await this.dockerManager.stopContainer(containerName);
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `⏹️ Контейнер ${containerName} остановлен!`,
            MenuBuilder.buildContainerMenu(containerName),
          );
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId, { text: '⏹️ Остановлен!' });
          }
          break;

        case 'restart':
          // Dangerous action - require confirmation
          if (!confirmed) {
            const actionKey = `container:${containerName}:restart`;
            this.confirmationManager.createConfirmation(userId, actionKey, containerName);

            const warning = ConfirmationManager.getActionWarning(actionKey, containerName);
            const timeRemaining = this.confirmationManager.getTimeRemaining(userId, actionKey, containerName);

            await this.updateOrSendMessage(
              chatId,
              messageId,
              `${warning}\n\n⏱️ Подтверждение истекает через ${timeRemaining} секунд.\n\nВы уверены?`,
              MenuBuilder.buildConfirmationMenu(actionKey, containerName),
            );
            if (queryId) {
              await this.bot.answerCallbackQuery(queryId);
            }
            break;
          }

          // Confirmed - execute action
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId, { text: '🔄 Перезапуск...' });
          }
          await this.dockerManager.restartContainer(containerName);
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `🔄 Контейнер ${containerName} перезапущен!`,
            MenuBuilder.buildContainerMenu(containerName),
          );
          break;

        case 'rebuild':
          // Dangerous action - require confirmation
          if (!confirmed) {
            const actionKey = `container:${containerName}:rebuild`;
            this.confirmationManager.createConfirmation(userId, actionKey, containerName);

            const warning = ConfirmationManager.getActionWarning(actionKey, containerName);
            const timeRemaining = this.confirmationManager.getTimeRemaining(userId, actionKey, containerName);

            await this.updateOrSendMessage(
              chatId,
              messageId,
              `${warning}\n\n⏱️ Подтверждение истекает через ${timeRemaining} секунд.\n\nВы уверены?`,
              MenuBuilder.buildConfirmationMenu(actionKey, containerName),
            );
            if (queryId) {
              await this.bot.answerCallbackQuery(queryId);
            }
            break;
          }

          // Confirmed - execute action
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId, { text: '🔨 Пересборка...' });
          }
          await this.dockerManager.rebuildContainer(containerName);
          await this.updateOrSendMessage(
            chatId,
            messageId,
            `🔨 Контейнер ${containerName} пересобран!`,
            MenuBuilder.buildContainerMenu(containerName),
          );
          break;

        default:
          if (queryId) {
            await this.bot.answerCallbackQuery(queryId, { text: '❌ Неизвестное действие' });
          }
      }
    } catch (error) {
      const errorMsg = `❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`;
      await this.updateOrSendMessage(
        chatId,
        messageId,
        errorMsg,
        MenuBuilder.buildContainerMenu(containerName),
      );
      if (queryId) {
        await this.bot.answerCallbackQuery(queryId, { text: errorMsg, show_alert: true });
      }
    }
  }

  /**
   * Обработать Terminal действие
   */
  private async handleTerminalAction(chatId: number, messageId: number | undefined, action: string): Promise<void> {
    // Map category aliases to full category names
    const categoryMap: Record<string, import('./TerminalManager').CommandCategory> = {
      'monitoring': 'monitoring',
      'processes': 'processes',
      'files': 'files',
      'network': 'network',
      'docker': 'docker',
      'fanta': 'fantaprojekt',
    };

    const category = categoryMap[action];

    if (!category) {
      // Show category selection menu
      await this.updateOrSendMessage(
        chatId,
        messageId,
        '💻 *Терминал*\n\nВыберите категорию команд:',
        MenuBuilder.buildTerminalMenu(),
      );
      return;
    }

    // Show commands for this category
    const commands = this.terminalManager.getCommandsByCategory(category);

    if (commands.length === 0) {
      await this.updateOrSendMessage(
        chatId,
        messageId,
        `❌ Нет команд в категории ${category}`,
        MenuBuilder.buildGrid([], true),
      );
      return;
    }

    // Create buttons for each command
    const buttons = commands.map(cmd => ({
      text: cmd.name,
      callbackData: `cmd:${cmd.id}`,
    }));

    const categoryNames: Record<string, string> = {
      'monitoring': '📊 Мониторинг',
      'processes': '⚙️ Процессы',
      'files': '📁 Файлы',
      'network': '🌐 Сеть',
      'docker': '🐳 Docker',
      'fantaprojekt': '🎬 FantaProjekt',
    };

    const categoryName = categoryNames[category] || category;
    const message = `💻 *${categoryName}*\n\nДоступно команд: ${commands.length}\n\nВыберите команду для выполнения:`;

    await this.updateOrSendMessage(
      chatId,
      messageId,
      message,
      MenuBuilder.buildVertical(buttons),
    );
  }

  /**
   * Выполнить терминальную команду
   */
  private async handleCommandExecution(
    chatId: number,
    messageId: number | undefined,
    commandId: string,
    queryId: string | undefined,
  ): Promise<void> {
    try {
      const command = this.terminalManager.getCommand(commandId);

      if (!command) {
        await this.updateOrSendMessage(
          chatId,
          messageId,
          `❌ Команда ${commandId} не найдена`,
          MenuBuilder.buildGrid([], true),
        );
        return;
      }

      // Special handling for manual-input: activate terminal mode
      if (commandId === 'manual-input') {
        this.navigationManager.setTerminalMode(chatId, true);

        if (queryId) {
          await this.bot.answerCallbackQuery(queryId, {
            text: '✅ Режим терминала активирован',
          });
        }

        await this.updateOrSendMessage(
          chatId,
          messageId,
          `🖥 *Режим интерактивного терминала активирован*\n\n` +
            `Теперь вы можете вводить команды прямо в чат.\n` +
            `Каждая команда будет выполнена и результат отправлен вам.\n\n` +
            `_Для выхода нажмите кнопку "🚪 Выйти"_`,
          MenuBuilder.buildGrid(
            [
              { text: '🚪 Выйти из терминала', callbackData: 'terminal:exit' },
            ],
            false,
          ),
        );
        return;
      }

      // Show "executing..." notification
      if (queryId) {
        await this.bot.answerCallbackQuery(queryId, {
          text: `⏳ Выполняется: ${command.name}`,
        });
      }

      // Execute the command
      const output = await this.terminalManager.executeCommand(commandId);

      // Limit output to 3000 characters (Telegram limit is ~4096)
      const truncatedOutput = output.length > 3000 ? output.slice(0, 3000) + '\n...\n(truncated)' : output;

      const message = `💻 *${command.name}*\n\n\`\`\`\n${truncatedOutput}\n\`\`\``;

      await this.updateOrSendMessage(
        chatId,
        messageId,
        message,
        MenuBuilder.buildGrid(
          [
            { text: '🔄 Повторить', callbackData: `cmd:${commandId}` },
            { text: '⬅️ Назад', callbackData: `terminal:${command.category}` },
          ],
          false,
        ),
      );
    } catch (error) {
      const errorMsg = `❌ Ошибка выполнения команды:\n\n${error instanceof Error ? error.message : String(error)}`;

      await this.updateOrSendMessage(
        chatId,
        messageId,
        errorMsg,
        MenuBuilder.buildGrid([], true),
      );

      if (queryId) {
        await this.bot.answerCallbackQuery(queryId, {
          text: '❌ Ошибка',
          show_alert: true,
        });
      }
    }
  }

  /**
   * Обновить или отправить новое сообщение
   */
  private async updateOrSendMessage(
    chatId: number,
    messageId: number | undefined,
    text: string,
    replyMarkup?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<void> {
    if (messageId) {
      try {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      } catch {
        // If edit fails, send new message
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      }
    } else {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    }
  }

  /**
   * Проверить авторизацию пользователя
   */
  private isAuthorized(userId?: number): boolean {
    if (!userId) return false;

    // If no specific users configured, allow the configured chat ID
    if (!this.config.authorizedUserIds || this.config.authorizedUserIds.length === 0) {
      return true; // Trust chat ID from config
    }

    return this.config.authorizedUserIds.includes(userId);
  }

  /**
   * Отправить сообщение в Telegram
   */
  async sendMessage(chatId: number | string, text: string): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('Bot disabled, message not sent');
      return;
    }

    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
      });
      logger.debug({ chatId, textLength: text.length }, 'Message sent to Telegram');
    } catch (error) {
      logger.error(error, 'Failed to send Telegram message');
    }
  }

  /**
   * Отправить сообщение в основной чат
   */
  async sendToMainChat(text: string): Promise<void> {
    await this.sendMessage(this.config.chatId, text);
  }

  /**
   * Остановить бота
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.bot.stopPolling();
      this.isRunning = false;
      logger.info('TelegramBotController stopped');
    } catch (error) {
      logger.error(error, 'Error stopping TelegramBotController');
    }
  }

  /**
   * Проверить работает ли бот
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Обработать команду в режиме интерактивного терминала
   */
  private async handleTerminalCommand(chatId: number, command: string): Promise<void> {
    try {
      logger.debug({ chatId, command }, 'Executing terminal command in interactive mode');

      // Execute custom command via TerminalManager
      const output = await this.terminalManager.executeCustomCommand(command);

      // Limit output to 3000 characters (Telegram limit is ~4096)
      const truncatedOutput = output.length > 3000 ? output.slice(0, 3000) + '\n...\n(truncated)' : output;

      const message = `💻 \`$ ${command}\`\n\n\`\`\`\n${truncatedOutput}\n\`\`\``;

      // Send result with "Exit terminal" button
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🚪 Выйти из терминала', callback_data: 'terminal:exit' }]],
        },
      });
    } catch (error) {
      const errorMsg = `❌ Ошибка выполнения команды:\n\n${error instanceof Error ? error.message : String(error)}`;

      await this.bot.sendMessage(chatId, errorMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🚪 Выйти из терминала', callback_data: 'terminal:exit' }]],
        },
      });

      logger.error({ chatId, command, error }, 'Failed to execute terminal command');
    }
  }

  /**
   * Получить информацию о боте
   */
  async getBotInfo(): Promise<TelegramBot.User | null> {
    if (!this.config.enabled) return null;

    try {
      return await this.bot.getMe();
    } catch (error) {
      logger.error(error, 'Failed to get bot info');
      return null;
    }
  }
}
