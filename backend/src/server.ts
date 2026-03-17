// ===========================================
// NexusWA — السيرفر الرئيسي
// ===========================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config';
import { createModuleLogger } from './common/logger';
import { connectDatabase, disconnectDatabase } from './common/database';
import { redis } from './common/redis';
import { AppError } from './common/errors';
import { whatsappManager } from './modules/whatsapp/whatsapp.manager';

// المسارات
import { authRoutes } from './modules/auth/auth.routes';
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes';
import { messageRoutes } from './modules/messages/messages.routes';
import { webhookRoutes } from './modules/webhooks/webhooks.routes';
import { contactRoutes } from './modules/contacts/contacts.routes';
import { templateRoutes } from './modules/templates/templates.routes';
import { autoReplyRoutes } from './modules/auto-reply/auto-reply.routes';
import { campaignRoutes } from './modules/campaigns/campaigns.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { schedulerRoutes } from './modules/scheduler/scheduler.routes';
import { conversationRoutes } from './modules/conversations/conversation.routes';
import { blacklistRoutes } from './modules/blacklist/blacklist.routes';

const logger = createModuleLogger('server');

// ============================================
// إنشاء التطبيق
// ============================================
const app = Fastify({
  logger: false, // نستخدم Pino مباشرة
});

// ============================================
// تسجيل الإضافات
// ============================================
async function registerPlugins() {
  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  // Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'NexusWA API',
        description: 'منصة ربط واتساب عبر الويب — API Documentation',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'خادم التطوير',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'مفتاح API بتنسيق: Bearer nwa_xxxxx',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}

// ============================================
// تسجيل المسارات
// ============================================
async function registerRoutes() {
  // مسار الصحة
  app.get('/health', async () => ({
    status: 'ok',
    service: 'NexusWA',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // مسارات API
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(whatsappRoutes, { prefix: '/api/v1/instances' });
  app.register(messageRoutes, { prefix: '/api/v1/messages' });
  app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  app.register(contactRoutes, { prefix: '/api/v1/contacts' });
  app.register(templateRoutes, { prefix: '/api/v1/templates' });
  app.register(autoReplyRoutes, { prefix: '/api/v1/auto-reply' });
  app.register(campaignRoutes, { prefix: '/api/v1/campaigns' });
  app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  app.register(schedulerRoutes, { prefix: '/api/v1/scheduled' });
  app.register(conversationRoutes, { prefix: '/api/v1/conversations' });
  app.register(blacklistRoutes, { prefix: '/api/v1/blacklist' });
}

// ============================================
// معالجة الأخطاء العامة
// ============================================
function setupErrorHandler() {
  app.setErrorHandler((error: any, request, reply) => {
    // أخطاء Zod
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'بيانات غير صالحة',
          details: (error as any).issues,
        },
      });
    }

    // أخطاء التطبيق
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // أخطاء Rate Limit
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'تم تجاوز عدد الطلبات المسموح. حاول مرة أخرى لاحقاً.',
        },
      });
    }

    // أخطاء غير متوقعة
    logger.error({ error: error.message, stack: error.stack }, '❌ خطأ غير متوقع');
    console.error('❌ FULL ERROR:', error);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: config.NODE_ENV === 'production'
          ? 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.'
          : `${error.message} | ${error.stack?.split('\n')[1]?.trim() || ''}`,
      },
    });
  });
}

// ============================================
// تشغيل السيرفر
// ============================================
async function start() {
  try {
    // الاتصال بالخدمات
    await connectDatabase();
    logger.info('✅ قاعدة البيانات جاهزة');

    // تسجيل الإضافات والمسارات
    await registerPlugins();
    await registerRoutes();
    setupErrorHandler();

    // تشغيل السيرفر
    await app.listen({ port: config.PORT, host: config.HOST });

    logger.info('='.repeat(50));
    logger.info(`🚀 NexusWA يعمل على http://localhost:${config.PORT}`);
    logger.info(`📚 التوثيق: http://localhost:${config.PORT}/docs`);
    logger.info(`🏥 الصحة: http://localhost:${config.PORT}/health`);
    logger.info('='.repeat(50));

    // إعادة اتصال الجلسات النشطة
    whatsappManager.restoreActiveSessions();
  } catch (error) {
    logger.error({ error }, '❌ فشل في تشغيل السيرفر');
    process.exit(1);
  }
}

// ============================================
// إيقاف آمن
// ============================================
async function shutdown() {
  logger.info('🛑 جاري الإيقاف الآمن...');
  await whatsappManager.shutdown();
  await disconnectDatabase();
  await redis.quit();
  await app.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// البدء
start();
