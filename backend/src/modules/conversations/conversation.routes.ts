// ===========================================
// NexusWA — مسارات المحادثات (Shared Inbox)
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('conversations');

export const conversationRoutes = async (app: FastifyInstance) => {
  // ============================================
  // قائمة المحادثات
  // ============================================
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const query = request.query as { status?: string; assignedTo?: string; search?: string; page?: string; limit?: string };
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '30'), 100);

    const where: any = { tenantId };
    if (query.status) where.status = query.status.toUpperCase();
    if (query.assignedTo) where.assignedTo = query.assignedTo;
    if (query.search) {
      where.OR = [
        { contactPhone: { contains: query.search } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: conversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ============================================
  // تفاصيل محادثة + رسائلها
  // ============================================
  app.get('/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({
      where: { id, tenantId: request.tenantId! },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!conv) throw new NotFoundError('المحادثة');

    // جلب رسائل هذه المحادثة
    const messages = await prisma.message.findMany({
      where: {
        tenantId: request.tenantId!,
        instanceId: conv.instanceId,
        recipient: conv.contactPhone,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return reply.send({ success: true, data: { conversation: conv, messages } });
  });

  // ============================================
  // تحديث حالة المحادثة
  // ============================================
  app.patch('/:id/status', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']) }).parse(request.body);

    const conv = await prisma.conversation.findFirst({ where: { id, tenantId: request.tenantId! } });
    if (!conv) throw new NotFoundError('المحادثة');

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status },
    });

    return reply.send({ success: true, data: updated });
  });

  // ============================================
  // تعيين محادثة لمستخدم
  // ============================================
  app.patch('/:id/assign', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = z.object({ userId: z.string().nullable() }).parse(request.body);

    const conv = await prisma.conversation.findFirst({ where: { id, tenantId: request.tenantId! } });
    if (!conv) throw new NotFoundError('المحادثة');

    const updated = await prisma.conversation.update({
      where: { id },
      data: { assignedTo: userId },
    });

    return reply.send({ success: true, data: updated });
  });

  // ============================================
  // إضافة ملاحظة داخلية
  // ============================================
  app.post('/:id/notes', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = z.object({ content: z.string().min(1) }).parse(request.body);

    const conv = await prisma.conversation.findFirst({ where: { id, tenantId: request.tenantId! } });
    if (!conv) throw new NotFoundError('المحادثة');

    const note = await prisma.conversationNote.create({
      data: {
        conversationId: id,
        userId: request.userId || 'system',
        content,
      },
    });

    return reply.status(201).send({ success: true, data: note });
  });

  // ============================================
  // إحصائيات المحادثات
  // ============================================
  app.get('/stats/summary', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const [open, pending, resolved, closed, total] = await Promise.all([
      prisma.conversation.count({ where: { tenantId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.conversation.count({ where: { tenantId, status: 'RESOLVED' } }),
      prisma.conversation.count({ where: { tenantId, status: 'CLOSED' } }),
      prisma.conversation.count({ where: { tenantId } }),
    ]);

    return reply.send({ success: true, data: { open, pending, resolved, closed, total } });
  });
};
