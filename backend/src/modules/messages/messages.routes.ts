// ===========================================
// NexusWA — مسارات الرسائل
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { whatsappManager } from '../whatsapp/whatsapp.manager';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError, ValidationError, PlanLimitError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('messages');

// ============================================
// مخططات التحقق
// ============================================
const sendMessageSchema = z.object({
  instanceId: z.string().uuid('معرف الجلسة غير صالح'),
  to: z.string().min(10, 'رقم الهاتف مطلوب'),
  type: z.enum(['text', 'image', 'document']).default('text'),
  content: z.object({
    body: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional(),
    filename: z.string().optional(),
    mimetype: z.string().optional(),
  }),
  externalId: z.string().optional(),
});

const sendBulkSchema = z.object({
  instanceId: z.string().uuid('معرف الجلسة غير صالح'),
  recipients: z.array(z.string().min(10)).min(1, 'المستلمين مطلوبين'),
  type: z.enum(['text', 'image', 'document']).default('text'),
  content: z.object({
    body: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional(),
    filename: z.string().optional(),
    mimetype: z.string().optional(),
  }),
});

export const messageRoutes = async (app: FastifyInstance) => {
  // ============================================
  // إرسال رسالة واحدة (Queue-based)
  // ============================================
  app.post(
    '/send',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const body = sendMessageSchema.parse(request.body);
      const tenantId = request.tenantId!;

      // التحقق من ملكية الجلسة
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: body.instanceId, tenantId },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      if (!whatsappManager.isConnected(body.instanceId)) {
        throw new ValidationError('الجلسة غير متصلة. قم بالاتصال أولاً.');
      }

      // التحقق من حد الرسائل اليومي
      await checkDailyLimit(tenantId);

      // التحقق من المحتوى قبل الحفظ
      if (body.type === 'text' && !body.content.body) {
        throw new ValidationError('نص الرسالة مطلوب');
      }

      // حفظ الرسالة بحالة "في الطابور"
      const message = await prisma.message.create({
        data: {
          tenantId,
          instanceId: body.instanceId,
          direction: 'OUTBOUND',
          recipient: body.to,
          messageType: body.type.toUpperCase() as any,
          content: body.content as any,
          status: 'QUEUED',
          externalId: body.externalId,
        },
      });

      // ✅ الرد فوراً — الإرسال في الخلفية
      reply.send({
        success: true,
        data: {
          messageId: message.id,
          status: 'QUEUED',
          message: 'تم وضع الرسالة في الطابور وجاري الإرسال.',
        },
      });

      // إرسال الرسالة في الخلفية
      processMessage(message.id, body.instanceId, body.to, body.type, body.content, tenantId)
        .catch((err: any) => logger.error({ messageId: message.id, error: err.message }, '❌ خطأ في معالجة الرسالة'));
    }
  );

  // ============================================
  // إرسال رسائل جماعية
  // ============================================
  app.post(
    '/send-bulk',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const body = sendBulkSchema.parse(request.body);
      const tenantId = request.tenantId!;

      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: body.instanceId, tenantId },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      if (!whatsappManager.isConnected(body.instanceId)) {
        throw new ValidationError('الجلسة غير متصلة');
      }

      // إنشاء رسائل في الطابور
      const messages = await prisma.message.createManyAndReturn({
        data: body.recipients.map((recipient) => ({
          tenantId,
          instanceId: body.instanceId,
          direction: 'OUTBOUND' as const,
          recipient,
          messageType: body.type.toUpperCase() as any,
          content: body.content as any,
          status: 'QUEUED' as const,
        })),
      });

      // إرسال الرسائل في الخلفية (بدون انتظار)
      processBulkMessages(body.instanceId, body.type, body.content, messages).catch(
        (err) => logger.error({ error: err }, '❌ خطأ في الإرسال الجماعي')
      );

      return reply.send({
        success: true,
        data: {
          totalQueued: messages.length,
          messageIds: messages.map((m) => m.id),
        },
        message: 'تم وضع الرسائل في الطابور. سيتم إرسالها تدريجياً.',
      });
    }
  );

  // ============================================
  // سجل الرسائل
  // ============================================
  app.get(
    '/',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        instanceId?: string;
        status?: string;
        direction?: string;
      };

      const page = parseInt(query.page || '1');
      const limit = Math.min(parseInt(query.limit || '50'), 100);
      const skip = (page - 1) * limit;

      const where: any = { tenantId: request.tenantId! };
      if (query.instanceId) where.instanceId = query.instanceId;
      if (query.status) where.status = query.status.toUpperCase();
      if (query.direction) where.direction = query.direction.toUpperCase();

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where,
          select: {
            id: true,
            direction: true,
            recipient: true,
            messageType: true,
            content: true,
            status: true,
            externalId: true,
            errorReason: true,
            createdAt: true,
            sentAt: true,
            deliveredAt: true,
            instance: {
              select: { name: true, phoneNumber: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.message.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // ============================================
  // حالة رسالة
  // ============================================
  app.get(
    '/:messageId/status',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { messageId } = request.params as { messageId: string };

      const message = await prisma.message.findFirst({
        where: { id: messageId, tenantId: request.tenantId! },
        select: {
          id: true,
          status: true,
          errorReason: true,
          createdAt: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
        },
      });

      if (!message) throw new NotFoundError('الرسالة');

      return reply.send({
        success: true,
        data: message,
      });
    }
  );
};

// ============================================
// دوال مساعدة
// ============================================
async function checkDailyLimit(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant?.plan?.maxMessagesPerDay) return; // لا حد

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.message.count({
    where: {
      tenantId,
      direction: 'OUTBOUND',
      createdAt: { gte: today },
    },
  });

  if (todayCount >= tenant.plan.maxMessagesPerDay) {
    throw new PlanLimitError(
      `وصلت للحد اليومي (${tenant.plan.maxMessagesPerDay} رسالة). قم بترقية خطتك.`
    );
  }
}

async function updateUsageLog(tenantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.usageLog.upsert({
    where: {
      tenantId_date: { tenantId, date: today },
    },
    update: {
      messagesSent: { increment: 1 },
    },
    create: {
      tenantId,
      date: today,
      messagesSent: 1,
    },
  });
}

async function processMessage(
  messageId: string,
  instanceId: string,
  to: string,
  type: string,
  content: any,
  tenantId: string
) {
  try {
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENDING' },
    });

    switch (type) {
      case 'text':
        await whatsappManager.sendTextMessage(instanceId, to, content.body);
        break;
      case 'image':
        await whatsappManager.sendImageMessage(instanceId, to, content.mediaUrl, content.caption);
        break;
      case 'document':
        await whatsappManager.sendDocumentMessage(instanceId, to, content.mediaUrl, content.filename || 'document', content.mimetype || 'application/pdf');
        break;
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    await updateUsageLog(tenantId);
    logger.info({ messageId, to }, '📤 تم إرسال الرسالة بنجاح');
  } catch (error: any) {
    const errorMsg = error.message || 'خطأ غير معروف';
    logger.error({ messageId, error: errorMsg }, '❌ فشل إرسال الرسالة');
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED', errorReason: errorMsg },
    });
  }
}

async function processBulkMessages(
  instanceId: string,
  type: string,
  content: any,
  messages: any[]
) {
  for (const msg of messages) {
    try {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SENDING' },
      });

      switch (type) {
        case 'text':
          await whatsappManager.sendTextMessage(
            instanceId,
            msg.recipient,
            content.body
          );
          break;
        case 'image':
          await whatsappManager.sendImageMessage(
            instanceId,
            msg.recipient,
            content.mediaUrl,
            content.caption
          );
          break;
      }

      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date() },
      });

      // Anti-Ban: التأخير يتم داخل sendTextMessage تلقائياً
    } catch (error: any) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'FAILED', errorReason: error.message },
      });
    }
  }
}
