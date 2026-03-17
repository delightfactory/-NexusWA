// ===========================================
// NexusWA — مسارات جهات الاتصال
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError, ValidationError, ConflictError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('contacts');

// Schema يقبل string فارغ أو email صحيح
const optionalEmail = z.union([
  z.string().email(),
  z.literal(''),
]).optional().transform(v => v || undefined);

const optionalString = z.string().optional().transform(v => v?.trim() || undefined);

const createContactSchema = z.object({
  phone: z.string().min(8, 'رقم الهاتف مطلوب'),
  name: optionalString,
  email: optionalEmail,
  company: optionalString,
  notes: optionalString,
  labels: z.array(z.string()).optional(),
});

const updateContactSchema = createContactSchema.partial();

const createLabelSchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب'),
  color: z.string().optional(),
});

export const contactRoutes = async (app: FastifyInstance) => {
  // ============================================
  // التصنيفات (Labels) — MUST be BEFORE /:id routes
  // ============================================
  app.get('/labels', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const labels = await prisma.label.findMany({
      where: { tenantId: request.tenantId! },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: labels });
  });

  app.post('/labels', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const body = createLabelSchema.parse(request.body);
    const label = await prisma.label.create({
      data: { tenantId: request.tenantId!, name: body.name, color: body.color },
    });
    return reply.send({ success: true, data: label });
  });

  app.delete('/labels/:id', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.label.delete({ where: { id } });
    return reply.send({ success: true, message: 'تم حذف التصنيف' });
  });

  // ============================================
  // استيراد CSV — BEFORE /:id
  // ============================================
  app.post(
    '/import',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { contacts } = request.body as { contacts: Array<{ phone: string; name?: string; email?: string; company?: string }> };
      const tenantId = request.tenantId!;

      if (!contacts?.length) throw new ValidationError('لا توجد جهات اتصال للاستيراد');

      let imported = 0;
      let skipped = 0;

      for (const c of contacts) {
        try {
          let phone = c.phone.replace(/[^\d]/g, '');
          if (phone.startsWith('0')) phone = '20' + phone.substring(1);

          await prisma.contact.create({
            data: {
              tenantId,
              phone,
              name: c.name || undefined,
              email: c.email || undefined,
              company: c.company || undefined,
            },
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      return reply.send({
        success: true,
        data: { imported, skipped, total: contacts.length },
      });
    }
  );

  // ============================================
  // قائمة جهات الاتصال
  // ============================================
  app.get(
    '/',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        search?: string;
        labelId?: string;
      };

      const page = parseInt(query.page || '1');
      const limit = Math.min(parseInt(query.limit || '50'), 100);
      const skip = (page - 1) * limit;

      const where: any = { tenantId: request.tenantId! };

      if (query.search && query.search.trim()) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { company: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.labelId) {
        where.labels = { some: { labelId: query.labelId } };
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          include: { labels: { include: { label: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.contact.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: contacts.map((c: any) => ({
          ...c,
          labels: c.labels.map((l: any) => l.label),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }
  );

  // ============================================
  // إضافة جهة اتصال
  // ============================================
  app.post(
    '/',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const body = createContactSchema.parse(request.body);
      const tenantId = request.tenantId!;

      // تنظيف الرقم
      let phone = body.phone.replace(/[^\d]/g, '');
      if (phone.startsWith('0')) phone = '20' + phone.substring(1);

      try {
        const contact = await prisma.contact.create({
          data: {
            tenantId,
            phone,
            name: body.name,
            email: body.email,
            company: body.company,
            notes: body.notes,
          },
        });

        // إضافة التصنيفات
        if (body.labels?.length) {
          await prisma.contactLabel.createMany({
            data: body.labels.map((labelId) => ({
              contactId: contact.id,
              labelId,
            })),
            skipDuplicates: true,
          });
        }

        logger.info({ contactId: contact.id, phone }, '✅ تم إضافة جهة اتصال');

        return reply.status(201).send({
          success: true,
          data: contact,
        });
      } catch (err: any) {
        // unique constraint violation
        if (err.code === 'P2002') {
          throw new ConflictError(`رقم الهاتف ${phone} موجود مسبقاً`);
        }
        throw err;
      }
    }
  );

  // ============================================
  // تعديل جهة اتصال
  // ============================================
  app.put(
    '/:id',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateContactSchema.parse(request.body);

      const existing = await prisma.contact.findFirst({
        where: { id, tenantId: request.tenantId! },
      });
      if (!existing) throw new NotFoundError('جهة الاتصال');

      const contact = await prisma.contact.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.company !== undefined && { company: body.company }),
          ...(body.notes !== undefined && { notes: body.notes }),
        },
      });

      // تحديث التصنيفات
      if (body.labels !== undefined) {
        await prisma.contactLabel.deleteMany({ where: { contactId: id } });
        if (body.labels.length) {
          await prisma.contactLabel.createMany({
            data: body.labels.map((labelId) => ({ contactId: id, labelId })),
          });
        }
      }

      return reply.send({ success: true, data: contact });
    }
  );

  // ============================================
  // حذف جهة اتصال
  // ============================================
  app.delete(
    '/:id',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.contact.findFirst({
        where: { id, tenantId: request.tenantId! },
      });
      if (!existing) throw new NotFoundError('جهة الاتصال');

      await prisma.contact.delete({ where: { id } });
      return reply.send({ success: true, message: 'تم حذف جهة الاتصال' });
    }
  );
};

