// ===========================================
// NexusWA — مسارات Webhooks (محسّنة)
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('webhooks');

const webhookEvents = [
  'message.received',
  'message.sent',
  'message.delivered',
  'message.failed',
  'instance.connected',
  'instance.disconnected',
  'instance.qr',
  'contact.created',
  'contact.updated',
  'campaign.started',
  'campaign.completed',
] as const;

const createWebhookSchema = z.object({
  name: z.string().min(1, 'اسم الـ Webhook مطلوب'),
  url: z.string().url('رابط غير صالح'),
  events: z.array(z.enum(webhookEvents)).min(1, 'حدد حدث واحد على الأقل'),
  headers: z.record(z.string()).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEvents)).min(1).optional(),
  isActive: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
});

export const webhookRoutes = async (app: FastifyInstance) => {
  // إنشاء webhook
  app.post('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const body = createWebhookSchema.parse(request.body);
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        tenantId: request.tenantId!,
        name: body.name,
        url: body.url,
        events: body.events,
        secret,
      },
    });

    logger.info({ tenantId: request.tenantId, webhookId: webhook.id }, '✅ تم إنشاء Webhook');

    return reply.status(201).send({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret,
        isActive: webhook.isActive,
      },
      message: '⚠️ احفظ الـ Secret الآن. لن يتم عرضه مرة أخرى.',
    });
  });

  // قائمة Webhooks
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId: request.tenantId! },
      select: { id: true, name: true, url: true, events: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: webhooks });
  });

  // تعديل webhook
  app.put('/:webhookId', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const body = updateWebhookSchema.parse(request.body);

    const existing = await prisma.webhook.findFirst({ where: { id: webhookId, tenantId: request.tenantId! } });
    if (!existing) throw new NotFoundError('Webhook');

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: body,
      select: { id: true, name: true, url: true, events: true, isActive: true },
    });
    return reply.send({ success: true, data: updated });
  });

  // حذف webhook
  app.delete('/:webhookId', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const existing = await prisma.webhook.findFirst({ where: { id: webhookId, tenantId: request.tenantId! } });
    if (!existing) throw new NotFoundError('Webhook');

    await prisma.webhook.delete({ where: { id: webhookId } });
    return reply.send({ success: true, message: 'تم حذف الـ Webhook بنجاح' });
  });

  // اختبار webhook
  app.post('/:webhookId/test', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, tenantId: request.tenantId! } });
    if (!webhook) throw new NotFoundError('Webhook');

    const testPayload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      data: { message: 'هذا إرسال تجريبي من NexusWA', webhookId },
    };

    try {
      const result = await deliverSingleWebhook(webhook, 'test.ping', testPayload.data);
      return reply.send({
        success: true,
        data: {
          delivered: result.success,
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          error: result.error,
        },
      });
    } catch (err: any) {
      return reply.send({
        success: false,
        error: { code: 'DELIVERY_FAILED', message: err.message },
      });
    }
  });

  // سجل أحداث webhook
  app.get('/:webhookId/logs', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const query = request.query as { page?: string; limit?: string };

    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '20'), 50);

    // نحفظ آخر 50 سجل في الذاكرة (مؤقت حتى نضيف WebhookLog table)
    const logs = webhookDeliveryLogs.get(webhookId) || [];
    const paginatedLogs = logs.slice((page - 1) * limit, page * limit);

    return reply.send({
      success: true,
      data: paginatedLogs,
      pagination: { page, limit, total: logs.length, totalPages: Math.ceil(logs.length / limit) },
    });
  });

  // قائمة الأحداث المتاحة
  app.get('/events/list', { preHandler: [hybridAuthGuard] }, async (_request, reply) => {
    const eventDescriptions: Record<string, string> = {
      'message.received': 'عند استلام رسالة جديدة',
      'message.sent': 'عند إرسال رسالة بنجاح',
      'message.delivered': 'عند تسليم الرسالة للمستلم',
      'message.failed': 'عند فشل إرسال رسالة',
      'instance.connected': 'عند اتصال رقم واتساب',
      'instance.disconnected': 'عند انقطاع اتصال رقم',
      'instance.qr': 'عند توليد QR Code جديد',
      'contact.created': 'عند إضافة جهة اتصال جديدة',
      'contact.updated': 'عند تحديث جهة اتصال',
      'campaign.started': 'عند بدء حملة جماعية',
      'campaign.completed': 'عند اكتمال حملة جماعية',
    };

    return reply.send({
      success: true,
      data: webhookEvents.map(event => ({
        event,
        description: eventDescriptions[event] || event,
      })),
    });
  });
};

// ============================================
// سجل التوصيل في الذاكرة (مؤقت)
// ============================================
interface DeliveryLog {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  responseTime: number;
  error: string | null;
  timestamp: string;
}

const webhookDeliveryLogs = new Map<string, DeliveryLog[]>();

function addDeliveryLog(webhookId: string, log: DeliveryLog) {
  const logs = webhookDeliveryLogs.get(webhookId) || [];
  logs.unshift(log); // الأحدث أولاً
  if (logs.length > 100) logs.pop(); // حد 100 سجل
  webhookDeliveryLogs.set(webhookId, logs);
}

// ============================================
// توصيل Webhook مع Retry
// ============================================
async function deliverSingleWebhook(
  webhook: any,
  event: string,
  payload: any
): Promise<{ success: boolean; statusCode: number | null; responseTime: number; error: string | null }> {
  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(body)
    .digest('hex');

  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NexusWA-Signature': `sha256=${signature}`,
        'X-NexusWA-Event': event,
        'X-NexusWA-Webhook-Id': webhook.id,
        'User-Agent': 'NexusWA/1.0',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;

    return {
      success: response.ok,
      statusCode: response.status,
      responseTime,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error: any) {
    return {
      success: false,
      statusCode: null,
      responseTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

// ============================================
// خدمة توصيل الأحداث للـ Webhooks — مع Retry
// ============================================
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // ms

export const deliverWebhookEvent = async (
  tenantId: string,
  event: string,
  payload: any
) => {
  const webhooks = await prisma.webhook.findMany({
    where: {
      tenantId,
      isActive: true,
      events: { has: event },
    },
  });

  for (const webhook of webhooks) {
    // تشغيل في الخلفية مع retry
    deliverWithRetry(webhook, event, payload).catch(err =>
      logger.error({ webhookId: webhook.id, err: err.message }, '❌ Webhook delivery failed after retries')
    );
  }
};

async function deliverWithRetry(webhook: any, event: string, payload: any) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await deliverSingleWebhook(webhook, event, payload);

    // تسجيل
    addDeliveryLog(webhook.id, {
      id: crypto.randomUUID(),
      event,
      statusCode: result.statusCode,
      success: result.success,
      responseTime: result.responseTime,
      error: result.error,
      timestamp: new Date().toISOString(),
    });

    if (result.success) {
      logger.info({ webhookId: webhook.id, event, attempt }, '✅ Webhook delivered');
      return;
    }

    logger.warn(
      { webhookId: webhook.id, event, attempt, error: result.error },
      `⚠️ Webhook attempt ${attempt + 1} failed`
    );

    // Retry
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  logger.error({ webhookId: webhook.id, event }, '❌ Webhook delivery exhausted all retries');
}
