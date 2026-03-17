// ===========================================
// NexusWA — مسارات الرد التلقائي
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('auto-reply');

const createRuleSchema = z.object({
  trigger: z.string().min(1, 'كلمة التشغيل مطلوبة'),
  matchType: z.enum(['EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX']).default('CONTAINS'),
  response: z.string().min(1, 'نص الرد مطلوب'),
  instanceId: z.string().uuid().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const autoReplyRoutes = async (app: FastifyInstance) => {
  // قائمة القواعد
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const rules = await prisma.autoReplyRule.findMany({
      where: { tenantId: request.tenantId! },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return reply.send({ success: true, data: rules });
  });

  // إنشاء قاعدة
  app.post('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const body = createRuleSchema.parse(request.body);
    const rule = await prisma.autoReplyRule.create({
      data: {
        tenantId: request.tenantId!,
        trigger: body.trigger,
        matchType: body.matchType,
        response: body.response,
        instanceId: body.instanceId,
        priority: body.priority || 0,
        isActive: body.isActive ?? true,
      },
    });
    logger.info({ ruleId: rule.id, trigger: rule.trigger }, '✅ تم إنشاء قاعدة رد تلقائي');
    return reply.status(201).send({ success: true, data: rule });
  });

  // تعديل قاعدة
  app.put('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createRuleSchema.partial().parse(request.body);

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!existing) throw new NotFoundError('القاعدة');

    const rule = await prisma.autoReplyRule.update({ where: { id }, data: body });
    return reply.send({ success: true, data: rule });
  });

  // حذف قاعدة
  app.delete('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!existing) throw new NotFoundError('القاعدة');

    await prisma.autoReplyRule.delete({ where: { id } });
    return reply.send({ success: true, message: 'تم حذف القاعدة' });
  });

  // تبديل حالة التفعيل
  app.patch('/:id/toggle', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!existing) throw new NotFoundError('القاعدة');

    const rule = await prisma.autoReplyRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    return reply.send({ success: true, data: rule });
  });
};
