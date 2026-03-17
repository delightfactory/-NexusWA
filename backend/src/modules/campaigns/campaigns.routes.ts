// ===========================================
// NexusWA — مسارات الحملات الجماعية
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError, ValidationError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';
import { whatsappManager } from '../whatsapp/whatsapp.manager';
import { delay } from '../../common/utils';
import { antiBanService } from '../../common/anti-ban.service';

const logger = createModuleLogger('campaigns');

const createCampaignSchema = z.object({
  name: z.string().min(1, 'اسم الحملة مطلوب'),
  instanceId: z.string().uuid('معرف الجلسة غير صالح'),
  content: z.object({
    type: z.enum(['text', 'image']).default('text'),
    body: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional(),
  }),
  templateId: z.string().uuid().optional(),
  targetType: z.enum(['manual', 'label', 'all']).default('manual'),
  targetData: z.array(z.string()).optional(), // أرقام أو label IDs
  scheduledAt: z.string().datetime().optional(),
});

export const campaignRoutes = async (app: FastifyInstance) => {
  // ============================================
  // قائمة الحملات
  // ============================================
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId: request.tenantId! },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: campaigns });
  });

  // ============================================
  // إنشاء حملة
  // ============================================
  app.post('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const body = createCampaignSchema.parse(request.body);
    const tenantId = request.tenantId!;

    // التحقق من ملكية الجلسة
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: body.instanceId, tenantId },
    });
    if (!instance) throw new NotFoundError('الجلسة');

    // تحديد المستهدفين
    let recipients: string[] = [];

    if (body.targetType === 'manual') {
      recipients = body.targetData || [];
    } else if (body.targetType === 'label') {
      // جلب جهات اتصال حسب التصنيف
      const contacts = await prisma.contact.findMany({
        where: {
          tenantId,
          labels: { some: { labelId: { in: body.targetData || [] } } },
        },
        select: { phone: true },
      });
      recipients = contacts.map(c => c.phone);
    } else if (body.targetType === 'all') {
      const contacts = await prisma.contact.findMany({
        where: { tenantId },
        select: { phone: true },
      });
      recipients = contacts.map(c => c.phone);
    }

    if (recipients.length === 0) {
      throw new ValidationError('لا يوجد مستهدفين لهذه الحملة');
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        instanceId: body.instanceId,
        name: body.name,
        content: body.content as any,
        templateId: body.templateId,
        targetType: body.targetType,
        targetData: body.targetData as any || [],
        totalCount: recipients.length,
        status: body.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });

    logger.info({ campaignId: campaign.id, recipients: recipients.length }, '✅ تم إنشاء حملة');

    return reply.status(201).send({
      success: true,
      data: { ...campaign, recipientCount: recipients.length },
    });
  });

  // ============================================
  // تشغيل حملة
  // ============================================
  app.post('/:id/start', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
    });
    if (!campaign) throw new NotFoundError('الحملة');

    if (campaign.status === 'RUNNING') {
      throw new ValidationError('الحملة قيد التشغيل بالفعل');
    }

    if (!whatsappManager.isConnected(campaign.instanceId)) {
      throw new ValidationError('الجلسة غير متصلة');
    }

    // تحديث الحالة
    await prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    // تشغيل في الخلفية
    processCampaign(id, tenantId).catch(err =>
      logger.error({ campaignId: id, err: err.message }, '❌ خطأ في تشغيل الحملة')
    );

    return reply.send({
      success: true,
      data: { message: 'تم بدء الحملة. سيتم الإرسال تدريجياً.' },
    });
  });

  // ============================================
  // إيقاف حملة
  // ============================================
  app.post('/:id/pause', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
    return reply.send({ success: true, message: 'تم إيقاف الحملة' });
  });

  // ============================================
  // حذف حملة
  // ============================================
  app.delete('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!existing) throw new NotFoundError('الحملة');

    if (existing.status === 'RUNNING') {
      throw new ValidationError('لا يمكن حذف حملة قيد التشغيل');
    }

    await prisma.campaign.delete({ where: { id } });
    return reply.send({ success: true, message: 'تم حذف الحملة' });
  });

  // ============================================
  // حالة حملة
  // ============================================
  app.get('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!campaign) throw new NotFoundError('الحملة');

    return reply.send({ success: true, data: campaign });
  });
};

// ============================================
// معالجة الحملة في الخلفية
// ============================================
async function processCampaign(campaignId: string, tenantId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;

  const content = campaign.content as any;

  // جلب المستهدفين
  let recipients: string[] = [];
  if (campaign.targetType === 'manual') {
    recipients = (campaign.targetData as string[]) || [];
  } else if (campaign.targetType === 'label') {
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        labels: { some: { labelId: { in: (campaign.targetData as string[]) || [] } } },
      },
      select: { phone: true },
    });
    recipients = contacts.map(c => c.phone);
  } else {
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      select: { phone: true },
    });
    recipients = contacts.map(c => c.phone);
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const phone of recipients) {
    // التحقق من إيقاف الحملة
    const current = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!current || current.status !== 'RUNNING') {
      logger.info({ campaignId }, '⏸️ الحملة تم إيقافها');
      break;
    }

    try {
      // إنشاء رسالة
      const msg = await prisma.message.create({
        data: {
          tenantId,
          instanceId: campaign.instanceId,
          direction: 'OUTBOUND',
          recipient: phone,
          messageType: (content.type || 'text').toUpperCase(),
          content: content,
          status: 'SENDING',
          campaignId,
        },
      });

      // إرسال الرسالة (Anti-Ban مدمج في sendTextMessage)
      if (content.type === 'image' && content.mediaUrl) {
        await whatsappManager.sendImageMessage(
          campaign.instanceId, phone, content.mediaUrl, content.caption
        );
      } else {
        await whatsappManager.sendTextMessage(
          campaign.instanceId, phone, content.body
        );
      }

      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date() },
      });

      sentCount++;
    } catch (err: any) {
      failedCount++;
      logger.warn({ campaignId, phone, err: err.message }, '⚠️ فشل إرسال');
    }

    // تحديث العدادات كل 5 رسائل
    if ((sentCount + failedCount) % 5 === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount, failedCount },
      });
    }
  }

  // تحديث نهائي
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      failedCount,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  logger.info({ campaignId, sentCount, failedCount }, '🎉 اكتملت الحملة');
}
