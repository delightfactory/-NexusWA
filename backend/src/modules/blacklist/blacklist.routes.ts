// ===========================================
// NexusWA — مسارات القائمة السوداء (Opt-Out)
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError, ValidationError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('blacklist');

export const blacklistRoutes = async (app: FastifyInstance) => {
  // ============================================
  // قائمة الأرقام المحظورة
  // ============================================
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const query = request.query as { page?: string; limit?: string; search?: string };
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '50'), 100);

    const where: any = { tenantId };
    if (query.search) where.phone = { contains: query.search };

    const [list, total] = await Promise.all([
      prisma.blacklist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blacklist.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: list,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ============================================
  // إضافة رقم للقائمة السوداء
  // ============================================
  app.post('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { phone, reason } = z.object({
      phone: z.string().min(8, 'رقم الهاتف مطلوب'),
      reason: z.string().optional(),
    }).parse(request.body);

    const tenantId = request.tenantId!;

    // تحقق من عدم التكرار
    const exists = await prisma.blacklist.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    if (exists) throw new ValidationError('هذا الرقم موجود بالفعل في القائمة السوداء');

    const entry = await prisma.blacklist.create({
      data: { tenantId, phone, reason: reason || 'manual' },
    });

    logger.info({ tenantId, phone }, '🚫 تمت إضافة رقم للقائمة السوداء');
    return reply.status(201).send({ success: true, data: entry });
  });

  // ============================================
  // حذف رقم من القائمة السوداء
  // ============================================
  app.delete('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await prisma.blacklist.findFirst({
      where: { id, tenantId: request.tenantId! },
    });
    if (!entry) throw new NotFoundError('العنصر');

    await prisma.blacklist.delete({ where: { id } });
    logger.info({ phone: entry.phone }, '✅ تمت إزالة رقم من القائمة السوداء');
    return reply.send({ success: true, message: 'تم الحذف' });
  });

  // ============================================
  // فحص رقم
  // ============================================
  app.get('/check/:phone', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { phone } = request.params as { phone: string };
    const entry = await prisma.blacklist.findUnique({
      where: { tenantId_phone: { tenantId: request.tenantId!, phone } },
    });
    return reply.send({ success: true, data: { blocked: !!entry, entry } });
  });
};
