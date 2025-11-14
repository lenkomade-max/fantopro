# Модуль мониторинга и уведомлений

## Описание

Модуль для отслеживания состояния сервера и отправки уведомлений о критических событиях в Telegram.

## Структура модуля

```
src/monitoring/
├── AlertManager.ts      # Управление уведомлениями в Telegram
├── HealthChecker.ts     # Проверка состояния сервера
├── types.ts             # TypeScript типы для модуля
├── index.ts             # Экспорты модуля
└── README.md            # Документация (этот файл)
```

## Компоненты

### AlertManager

Класс для отправки уведомлений в Telegram о критических событиях.

**Возможности:**
- Уведомления о запуске/падении сервера
- Уведомления об uncaught exceptions
- Уведомления об unhandled promise rejections
- Cooldown система для предотвращения спама
- Форматирование сообщений с системной информацией

**Пример использования:**
```typescript
import { AlertManager } from './monitoring';

const alertManager = new AlertManager({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  enabled: true,
  serverName: 'FantaProjekt API',
  port: 3123,
});

// Отправить уведомление о запуске
await alertManager.sendServerStarted();

// Отправить кастомное уведомление
await alertManager.sendAlert({
  type: 'error',
  message: 'Произошла ошибка при обработке запроса',
  error: new Error('Database connection failed'),
  context: { userId: 123, endpoint: '/api/video' },
});
```

### HealthChecker

Класс для проверки состояния сервера и системных ресурсов.

**Возможности:**
- Проверка использования памяти
- Информация о CPU
- Uptime сервера
- Статус здоровья (healthy/degraded/unhealthy)

**Пример использования:**
```typescript
import { HealthChecker } from './monitoring';

const healthChecker = new HealthChecker();

// Получить полную информацию о здоровье
const health = healthChecker.getHealthStatus();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'

// Простая проверка
const isAlive = healthChecker.isAlive(); // true
```

## Настройка

### Переменные окружения

Добавьте в `.env`:

```env
# Мониторинг и уведомления
MONITORING_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### Получение Telegram Bot Token

1. Откройте Telegram и найдите [@BotFather](https://t.me/botfather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте токен, который даст BotFather
5. Добавьте токен в `.env` как `TELEGRAM_BOT_TOKEN`

### Получение Chat ID

1. Найдите вашего бота в Telegram и отправьте ему любое сообщение
2. Откройте в браузере: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Найдите поле `"chat":{"id":...}` - это ваш Chat ID
4. Добавьте его в `.env` как `TELEGRAM_CHAT_ID`

Или используйте [@get_id_bot](https://t.me/get_id_bot) для получения Chat ID.

## Интеграция в проект

В `src/index.ts`:

```typescript
import { AlertManager, HealthChecker } from './monitoring';

// Создать instances
const alertManager = new AlertManager({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  enabled: process.env.MONITORING_ENABLED === 'true',
  serverName: 'FantaProjekt API',
  port: config.port,
});

const healthChecker = new HealthChecker();

// Обработчики критических событий
process.on('uncaughtException', async (error) => {
  await alertManager.sendUncaughtException(error);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  await alertManager.sendUnhandledRejection(reason);
});

// Уведомление о запуске
await alertManager.sendServerStarted();
```

В `src/server/server.ts`:

```typescript
// Health check endpoint
this.app.get('/health', (req, res) => {
  const health = healthChecker.getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

## Типы уведомлений

- **critical** 🚨 - Критическая ошибка (падение сервера, uncaught exception)
- **error** ❌ - Ошибка в работе приложения
- **warning** ⚠️ - Предупреждение (высокое использование памяти)
- **info** ℹ️ - Информационное сообщение (запуск сервера)

## Cooldown система

Модуль автоматически предотвращает спам одинаковых уведомлений. Между одинаковыми алертами должно пройти минимум 60 секунд.

## Тестирование

Для проверки работы системы уведомлений:

```typescript
await alertManager.sendTestAlert();
```

Вы должны получить тестовое сообщение в Telegram.
