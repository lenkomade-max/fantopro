import { logger } from '../logger';

/**
 * NavigationState - состояние навигации для пользователя
 */
export interface NavigationState {
  currentScreen: string;
  history: string[]; // Stack of previous screens
  data?: Record<string, any>; // Additional data for current screen
  terminalModeActive?: boolean; // Interactive terminal mode
}

/**
 * NavigationManager - управление многоуровневой навигацией
 *
 * Возможности:
 * - История переходов (стек)
 * - Кнопка "Назад"
 * - Хранение данных для каждого экрана
 * - Поддержка множества пользователей
 */
export class NavigationManager {
  private states: Map<number, NavigationState> = new Map();

  /**
   * Получить текущее состояние пользователя
   */
  getState(userId: number): NavigationState {
    if (!this.states.has(userId)) {
      this.states.set(userId, {
        currentScreen: 'main',
        history: [],
      });
    }
    return this.states.get(userId)!;
  }

  /**
   * Перейти на новый экран
   */
  navigate(userId: number, screen: string, data?: Record<string, any>): void {
    const state = this.getState(userId);

    // Добавить текущий экран в историю
    if (state.currentScreen !== screen) {
      state.history.push(state.currentScreen);
    }

    state.currentScreen = screen;
    state.data = data;

    logger.debug({ userId, screen, historyLength: state.history.length }, 'Navigation: navigate');
  }

  /**
   * Вернуться на предыдущий экран
   */
  goBack(userId: number): string {
    const state = this.getState(userId);

    if (state.history.length === 0) {
      logger.debug({ userId }, 'Navigation: already at root, returning to main');
      state.currentScreen = 'main';
      state.data = undefined;
      return 'main';
    }

    const previousScreen = state.history.pop()!;
    state.currentScreen = previousScreen;
    state.data = undefined;

    logger.debug({ userId, screen: previousScreen, historyLength: state.history.length }, 'Navigation: go back');
    return previousScreen;
  }

  /**
   * Сбросить навигацию к главному экрану
   */
  reset(userId: number): void {
    this.states.set(userId, {
      currentScreen: 'main',
      history: [],
    });
    logger.debug({ userId }, 'Navigation: reset to main');
  }

  /**
   * Проверить, можно ли вернуться назад
   */
  canGoBack(userId: number): boolean {
    const state = this.getState(userId);
    return state.history.length > 0;
  }

  /**
   * Получить текущий экран
   */
  getCurrentScreen(userId: number): string {
    return this.getState(userId).currentScreen;
  }

  /**
   * Получить данные текущего экрана
   */
  getData(userId: number): Record<string, any> | undefined {
    return this.getState(userId).data;
  }

  /**
   * Обновить данные текущего экрана
   */
  updateData(userId: number, data: Record<string, any>): void {
    const state = this.getState(userId);
    state.data = { ...state.data, ...data };
  }

  /**
   * Очистить состояния неактивных пользователей (вызывается периодически)
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    // В будущем можно добавить timestamp последнего действия
    // и удалять устаревшие состояния
    logger.debug({ statesCount: this.states.size }, 'Navigation: cleanup check');
  }

  /**
   * Активировать режим интерактивного терминала
   */
  setTerminalMode(userId: number, active: boolean): void {
    const state = this.getState(userId);
    state.terminalModeActive = active;
    logger.debug({ userId, active }, 'Navigation: terminal mode changed');
  }

  /**
   * Проверить, активен ли режим терминала
   */
  isTerminalModeActive(userId: number): boolean {
    const state = this.getState(userId);
    return state.terminalModeActive === true;
  }
}
