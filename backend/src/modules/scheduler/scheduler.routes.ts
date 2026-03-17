// ===========================================
// NexusWA — مسارات الرسائل المجدولة
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError, ValidationError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';
import { whatsappManager } from '../whatsapp/whatsapp.manager';

const logger = createModuleLogger('scheduler');

const createScheduledSchema = z.object({
  instanceId: z.string().uuid('معرف الجلسة غير صالح'),
  to: z.string().min(8, 'رقم الحادث مطلوب'),
  type: z.enum(['text', 'image']).default('text'),
  content: z.object({
    body: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional(),
  }),
  scheduledAt: z.string().min(1, 'وقت الإرسال مطلوب'),
  repeat: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
});

// Memory store for scheduled tasks (production: use Redis or DB)
const scheduledTimers = new Map<string, NodeJS.Timeout>();

export const schedulerRoutes = async (app: FastifyInstance) => {
  // قائمة الرسائل المجدولة
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const messages = await prisma.message.findMany({
      where: {
        tenantId: request.tenantId!,
        status: { in: ['SCHEDULED', 'QUEUED'] },
        scheduledAt: { not: null },
      },
      include: { instance: { select: { name: true, phoneNumber: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
    return reply.send({ success: true, data: messages });
  });

  // إنشاء رسالة مجدولة
  app.post('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const body = createScheduledSchema.parse(request.body);
    const tenantId = request.tenantId!;

    const scheduledAt = new Date(body.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new ValidationError('وقت الإرسال يجب أن يكون في المستقبل');
    }

    // التحقق من ملكية الجلسة
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: body.instanceId, tenantId },
    });
    if (!instance) throw new NotFoundError('الجلسة');

    const message = await prisma.message.create({
      data: {
        tenantId,
        instanceId: body.instanceId,
        direction: 'OUTBOUND',
        recipient: body.to,
        messageType: body.type.toUpperCase() as any,
        content: body.content as any,
        status: 'SCHEDULED',
        scheduledAt,
      },
    });

    // جدولة الإرسال
    scheduleMessage(message.id, body.instanceId, body.to, body.type, body.content, scheduledAt);

    logger.info({ messageId: message.id, scheduledAt }, '⏰ تم جدولة رسالة');

    return reply.status(201).send({
      success: true,
      data: message,
      message: `ستُرسل في ${scheduledAt.toLocaleString('ar-EG')}`,
    });
  });

  // إلغاء رسالة مجدولة
  app.delete('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const message = await prisma.message.findFirst({
      where: { id, tenantId: request.tenantId!, status: 'SCHEDULED' },
    });
    if (!message) throw new NotFoundError('الرسالة المجدولة');

    // إلغاء التايمر
    const timer = scheduledTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      scheduledTimers.delete(id);
    }

    await prisma.message.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return reply.send({ success: true, message: 'تم إلغاء الرسالة المجدولة' });
  });

  // استعادة الرسائل المجدولة عند بدء السيرفر
  restoreScheduledMessages();
};

// ============================================
// جدولة إرسال رسالة
// ============================================
function scheduleMessage(
  messageId: string,
  instanceId: string,
  to: string,
  type: string,
  content: any,
  scheduledAt: Date
) {
  const delay = scheduledAt.getTime() - Date.now();
  if (delay <= 0) {
    // وقت الإرسال مضى — أرسل فوراً
    executeScheduledMessage(messageId, instanceId, to, type, content);
    return;
  }

  const timer = setTimeout(() => {
    executeScheduledMessage(messageId, instanceId, to, type, content);
    scheduledTimers.delete(messageId);
  }, delay);

  scheduledTimers.set(messageId, timer);
}

async function executeScheduledMessage(
  messageId: string,
  instanceId: string,
  to: string,
  type: string,
  content: any
) {
  try {
    if (!whatsappManager.isConnected(instanceId)) {
      throw new Error('الجلسة غير متصلة');
    }

    await prisma.message.update({ where: { id: messageId }, data: { status: 'SENDING' } });

    if (type === 'text' || type === 'TEXT') {
      await whatsappManager.sendTextMessage(instanceId, to, content.body);
    } else if (type === 'image' || type === 'IMAGE') {
      await whatsappManager.sendImageMessage(instanceId, to, content.mediaUrl, content.caption);
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    logger.info({ messageId, to }, '⏰✅ تم إرسال رسالة مجدولة');
  } catch (error: any) {
    logger.error({ messageId, error: error.message }, '⏰❌ فشل إرسال رسالة مجدولة');
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED', errorReason: error.message },
    });
  }
}

async function restoreScheduledMessages() {
  try {
    const messages = await prisma.message.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { not: null, gte: new Date() } },
    });

    for (const msg of messages) {
      const content = msg.content as any;
      scheduleMessage(msg.id, msg.instanceId, msg.recipient, msg.messageType.toLowerCase(), content, msg.scheduledAt!);
    }

    if (messages.length > 0) {
      logger.info(`⏰ تم استعادة ${messages.length} رسالة مجدولة`);
    }
  } catch (err: any) {
    logger.error({ error: err.message }, '❌ خطأ في استعادة الرسائل المجدولة');
  }
}
