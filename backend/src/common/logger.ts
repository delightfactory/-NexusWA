// ===========================================
// NexusWA — نظام التسجيل (Logger)
// ===========================================

import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};
