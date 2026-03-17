// ===========================================
// NexusWA — اتصال Redis
// ===========================================

import Redis from 'ioredis';
import { config } from '../config';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('redis');

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    logger.warn(`إعادة محاولة الاتصال بـ Redis... (محاولة ${times})`);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('✅ تم الاتصال بـ Redis بنجاح');
});

redis.on('error', (error) => {
  logger.error({ error: error.message }, '❌ خطأ في Redis');
});

export const connectRedis = async (): Promise<void> => {
  if (redis.status === 'ready') return;

  return new Promise((resolve, reject) => {
    redis.once('ready', resolve);
    redis.once('error', reject);
  });
};
