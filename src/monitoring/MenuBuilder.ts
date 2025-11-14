import TelegramBot from 'node-telegram-bot-api';

/**
 * MenuItem - элемент меню
 */
export interface MenuItem {
  text: string; // Текст на кнопке
  callbackData: string; // Данные для callback query
  url?: string; // Опционально: URL для открытия в браузере
}

/**
 * MenuRow - строка кнопок (1-3 кнопки в ряд)
 */
export type MenuRow = MenuItem[];

/**
 * MenuConfig - конфигурация меню
 */
export interface MenuConfig {
  rows: MenuRow[];
  addBackButton?: boolean; // Добавить кнопку "Назад"
  backButtonText?: string; // Текст для кнопки "Назад"
}

/**
 * MenuBuilder - построение многоуровневых inline-меню
 *
 * Возможности:
 * - Создание inline-клавиатур с кнопками
 * - Автоматическое добавление кнопки "Назад"
 * - Поддержка URL-кнопок
 * - Гибкая раскладка (1-3 кнопки в ряд)
 */
export class MenuBuilder {
  /**
   * Создать inline-клавиатуру из конфигурации меню
   */
  static build(config: MenuConfig): TelegramBot.InlineKeyboardMarkup {
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    // Добавить все ряды кнопок
    config.rows.forEach((row) => {
      const buttons: TelegramBot.InlineKeyboardButton[] = row.map((item) => ({
        text: item.text,
        callback_data: item.callbackData,
        ...(item.url && { url: item.url }),
      }));
      keyboard.push(buttons);
    });

    // Добавить кнопку "Назад" если требуется
    if (config.addBackButton) {
      keyboard.push([
        {
          text: config.backButtonText || '⬅️ Назад',
          callback_data: 'nav:back',
        },
      ]);
    }

    return { inline_keyboard: keyboard };
  }

  /**
   * Создать простое вертикальное меню (по одной кнопке в ряд)
   */
  static buildVertical(items: MenuItem[], addBackButton = true): TelegramBot.InlineKeyboardMarkup {
    return MenuBuilder.build({
      rows: items.map((item) => [item]),
      addBackButton,
    });
  }

  /**
   * Создать горизонтальное меню (все кнопки в один ряд)
   */
  static buildHorizontal(items: MenuItem[], addBackButton = true): TelegramBot.InlineKeyboardMarkup {
    return MenuBuilder.build({
      rows: [items],
      addBackButton,
    });
  }

  /**
   * Создать сетку кнопок (2 кнопки в ряд)
   */
  static buildGrid(items: MenuItem[], addBackButton = true): TelegramBot.InlineKeyboardMarkup {
    const rows: MenuRow[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const row = items.slice(i, i + 2);
      rows.push(row);
    }
    return MenuBuilder.build({ rows, addBackButton });
  }

  /**
   * Создать главное меню (фиксированное)
   */
  static buildMainMenu(): TelegramBot.InlineKeyboardMarkup {
    return MenuBuilder.buildGrid(
      [
        { text: '📊 Статус', callbackData: 'main:status' },
        { text: '🎬 Очередь', callbackData: 'main:queue' },
        { text: '⚙️ Процессы', callbackData: 'main:processes' },
        { text: '🏥 Диагностика', callbackData: 'main:health' },
        { text: '🐳 Docker', callbackData: 'main:docker' },
        { text: '💻 Терминал', callbackData: 'main:terminal' },
        { text: '📝 Логи', callbackData: 'main:logs' },
        { text: '⚙️ Настройки', callbackData: 'main:settings' },
      ],
      false, // No back button on main menu
    );
  }

  /**
   * Создать меню Docker
   */
  static buildDockerMenu(): TelegramBot.InlineKeyboardMarkup {
    return MenuBuilder.buildVertical([
      { text: '📋 Список контейнеров', callbackData: 'docker:list' },
      { text: '📊 Docker Stats', callbackData: 'docker:stats' },
      { text: '🔍 Поиск образов', callbackData: 'docker:images' },
      { text: '🧹 Очистка (prune)', callbackData: 'docker:prune' },
    ]);
  }

  /**
   * Создать меню для конкретного Docker контейнера
   */
  static buildContainerMenu(containerName: string): TelegramBot.InlineKeyboardMarkup {
    const prefix = `container:${containerName}`;
    return MenuBuilder.buildGrid([
      { text: '📊 Детали', callbackData: `${prefix}:details` },
      { text: '📝 Логи', callbackData: `${prefix}:logs` },
      { text: '🔄 Рестарт', callbackData: `${prefix}:restart` },
      { text: '⏹️ Остановить', callbackData: `${prefix}:stop` },
      { text: '▶️ Запустить', callbackData: `${prefix}:start` },
      { text: '🔨 Rebuild', callbackData: `${prefix}:rebuild` },
    ]);
  }

  /**
   * Создать меню Terminal (категории команд)
   */
  static buildTerminalMenu(): TelegramBot.InlineKeyboardMarkup {
    return MenuBuilder.buildGrid([
      { text: '📊 Мониторинг', callbackData: 'terminal:monitoring' },
      { text: '⚙️ Процессы', callbackData: 'terminal:processes' },
      { text: '📁 Файлы', callbackData: 'terminal:files' },
      { text: '🌐 Сеть', callbackData: 'terminal:network' },
      { text: '🐳 Docker', callbackData: 'terminal:docker' },
      { text: '🎬 FantaProjekt', callbackData: 'terminal:fanta' },
    ]);
  }

  /**
   * Создать меню подтверждения
   */
  static buildConfirmationMenu(action: string, data?: string): TelegramBot.InlineKeyboardMarkup {
    const confirmData = data ? `confirm:${action}:${data}` : `confirm:${action}`;
    const cancelData = data ? `cancel:${action}:${data}` : `cancel:${action}`;

    return MenuBuilder.build({
      rows: [
        [
          { text: '✅ Да, подтвердить', callbackData: confirmData },
          { text: '❌ Отмена', callbackData: cancelData },
        ],
      ],
      addBackButton: false,
    });
  }

  /**
   * Создать меню с действиями для видео
   */
  static buildVideoActionsMenu(videoId: string): TelegramBot.InlineKeyboardMarkup {
    return MenuBuilder.build({
      rows: [
        [
          { text: '📊 Статус', callbackData: `video:status:${videoId}` },
          { text: '📥 Скачать', callbackData: `video:download:${videoId}` },
        ],
        [{ text: '❌ Отменить', callbackData: `video:cancel:${videoId}` }],
      ],
      addBackButton: false,
    });
  }

  /**
   * Создать меню с действиями для ошибки
   */
  static buildErrorActionsMenu(videoId?: string): TelegramBot.InlineKeyboardMarkup {
    const items: MenuItem[] = [
      { text: '📝 Логи', callbackData: videoId ? `error:logs:${videoId}` : 'error:logs' },
      { text: '🗑️ Очистить', callbackData: videoId ? `error:clear:${videoId}` : 'error:clear' },
    ];

    if (videoId) {
      items.unshift({ text: '🔄 Повторить', callbackData: `error:retry:${videoId}` });
    }

    return MenuBuilder.buildHorizontal(items, false);
  }

  /**
   * Создать постоянное меню внизу (ReplyKeyboard)
   */
  static buildReplyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: [
        [{ text: '📊 Статус' }, { text: '🎬 Очередь' }],
        [{ text: '⚙️ Процессы' }, { text: '🏥 Диагностика' }],
        [{ text: '🐳 Docker' }, { text: '💻 Терминал' }],
        [{ text: '📝 Логи' }, { text: '⚙️ Настройки' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }
}
