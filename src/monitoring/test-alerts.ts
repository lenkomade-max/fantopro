#!/usr/bin/env ts-node
/**
 * Скрипт для тестирования системы уведомлений
 * Использование: ts-node src/monitoring/test-alerts.ts
 */

import dotenv from 'dotenv';
import { AlertManager } from './AlertManager';

// Load environment variables
dotenv.config();

async function testAlerts() {
  console.log('🧪 Тестирование системы уведомлений...\n');

  const config = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    enabled: process.env.MONITORING_ENABLED === 'true',
    serverName: 'FantaProjekt TEST',
    port: 3123,
  };

  console.log('Конфигурация:');
  console.log(`  - Monitoring enabled: ${config.enabled}`);
  console.log(`  - Bot token: ${config.telegramBotToken ? '✓ Set' : '✗ Not set'}`);
  console.log(`  - Chat ID: ${config.telegramChatId ? '✓ Set' : '✗ Not set'}`);
  console.log('');

  if (!config.enabled) {
    console.log('⚠️  Мониторинг отключен (MONITORING_ENABLED=false)');
    console.log('   Установите MONITORING_ENABLED=true в .env для включения');
    return;
  }

  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log('❌ Ошибка: TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не установлены');
    console.log('\nИнструкция по настройке:');
    console.log('1. Создайте бота в @BotFather (Telegram)');
    console.log('2. Скопируйте токен и добавьте в .env как TELEGRAM_BOT_TOKEN');
    console.log('3. Узнайте ваш Chat ID через @get_id_bot');
    console.log('4. Добавьте Chat ID в .env как TELEGRAM_CHAT_ID');
    console.log('5. Установите MONITORING_ENABLED=true');
    return;
  }

  const alertManager = new AlertManager(config);

  console.log('Отправка тестового уведомления...');
  try {
    await alertManager.sendTestAlert();
    console.log('✅ Тестовое уведомление отправлено успешно!');
    console.log('   Проверьте ваш Telegram');
  } catch (error) {
    console.log('❌ Ошибка при отправке:', error);
  }

  console.log('\nОтправка примера error алерта...');
  try {
    await alertManager.sendAlert({
      type: 'error',
      message: 'Тестовая ошибка - проверка форматирования',
      error: new Error('Sample error for testing'),
      context: {
        testMode: true,
        timestamp: new Date().toISOString(),
      },
    });
    console.log('✅ Error алерт отправлен!');
  } catch (error) {
    console.log('❌ Ошибка при отправке:', error);
  }

  console.log('\nТестирование завершено!');
}

testAlerts().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
