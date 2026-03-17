// ===========================================
// NexusWA — اتصال قاعدة البيانات (Prisma)
// ===========================================

import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('database');

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ]
      : [{ level: 'error', emit: 'event' }],
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn(e.message);
});

prisma.$on('error' as never, (e: any) => {
  logger.error(e.message);
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('✅ تم الاتصال بقاعدة البيانات بنجاح');
  } catch (error) {
    logger.error('❌ فشل الاتصال بقاعدة البيانات');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('🔌 تم قطع الاتصال بقاعدة البيانات');
};
