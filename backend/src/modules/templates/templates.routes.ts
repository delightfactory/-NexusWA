// ===========================================
// NexusWA — مسارات قوالب الرسائل
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('templates');

const createTemplateSchema = z.object({
  name: z.string().min(1, 'اسم القالب مطلوب'),
  content: z.string().min(1, 'محتوى القالب مطلوب'),
  category: z.string().optional(),
  language: z.string().optional(),
});

export const templateRoutes = async (app: FastifyInstance) => {
  // قائمة القوالب
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const query = request.query as { category?: string };
    const where: any = { tenantId: request.tenantId! };
    if (query.category) where.category = query.category;

    const templates = await prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: templates });
  });

  // إنشاء قالب
  app.post('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const body = createTemplateSchema.parse(request.body);
    const template = await prisma.template.create({
      data: {
        tenantId: request.tenantId!,
        name: body.name,
        content: body.content,
        category: body.category || 'general',
        language: body.language || 'ar',
      },
    });
    logger.info({ templateId: template.id }, '✅ تم إنشاء قالب');
    return reply.status(201).send({ success: true, data: template });
  });

  // تعديل قالب
  app.put('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createTemplateSchema.partial().parse(request.body);

    const existing = await prisma.template.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!existing) throw new NotFoundError('القالب');

    const template = await prisma.template.update({ where: { id }, data: body });
    return reply.send({ success: true, data: template });
  });

  // حذف قالب
  app.delete('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.template.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!existing) throw new NotFoundError('القالب');

    await prisma.template.delete({ where: { id } });
    return reply.send({ success: true, message: 'تم حذف القالب' });
  });

  // معاينة قالب مع بيانات
  app.post('/preview', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { content, variables } = request.body as { content: string; variables: Record<string, string> };
    let preview = content;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }
    return reply.send({ success: true, data: { preview } });
  });
};
