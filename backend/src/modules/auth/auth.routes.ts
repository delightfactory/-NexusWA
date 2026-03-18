// ===========================================
// NexusWA — مسارات المصادقة (Routes)
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as authService from './auth.service';
import { jwtAuthGuard } from './auth.middleware';
import { AppError } from '../../common/errors';

// ============================================
// مخططات التحقق (Validation Schemas)
// ============================================
const registerSchema = z.object({
  companyName: z.string().min(2, 'اسم الشركة مطلوب (حرفين على الأقل)'),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  name: z.string().min(2, 'الاسم مطلوب'),
});

const loginSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

const createApiKeySchema = z.object({
  name: z.string().min(1, 'اسم المفتاح مطلوب'),
});

// ============================================
// تسجيل المسارات
// ============================================
export const authRoutes = async (app: FastifyInstance) => {
  // ============================================
  // تسجيل حساب جديد
  // ============================================
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerTenant(body);

    const token = app.jwt.sign(
      {
        userId: result.user.id,
        tenantId: result.tenant.id,
        role: result.user.role,
      },
      { expiresIn: '7d' }
    );

    return reply.status(201).send({
      success: true,
      data: {
        ...result,
        token,
      },
    });
  });

  // ============================================
  // تسجيل الدخول
  // ============================================
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(body);

    const token = app.jwt.sign(
      {
        userId: result.user.id,
        tenantId: result.tenant.id,
        role: result.user.role,
      },
      { expiresIn: '7d' }
    );

    return reply.send({
      success: true,
      data: {
        ...result,
        token,
      },
    });
  });

  // ============================================
  // الحصول على بيانات المستخدم الحالي
  // ============================================
  app.get('/me', { preHandler: [jwtAuthGuard] }, async (request, reply) => {
    const { prisma } = await import('../../common/database');
    const user_data = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            plan: true,
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: user_data,
    });
  });

  // ============================================
  // إنشاء مفتاح API
  // ============================================
  app.post(
    '/api-keys',
    { preHandler: [jwtAuthGuard] },
    async (request, reply) => {
      const body = createApiKeySchema.parse(request.body);
      const result = await authService.createApiKey(request.tenantId!, body.name);

      return reply.status(201).send({
        success: true,
        data: result,
        message: '⚠️ احفظ المفتاح الآن. لن يتم عرضه مرة أخرى.',
      });
    }
  );

  // ============================================
  // قائمة مفاتيح API
  // ============================================
  app.get(
    '/api-keys',
    { preHandler: [jwtAuthGuard] },
    async (request, reply) => {
      const keys = await authService.listApiKeys(request.tenantId!);

      return reply.send({
        success: true,
        data: keys,
      });
    }
  );

  // ============================================
  // حذف مفتاح API
  // ============================================
  app.delete(
    '/api-keys/:keyId',
    { preHandler: [jwtAuthGuard] },
    async (request, reply) => {
      const { keyId } = request.params as { keyId: string };
      await authService.deleteApiKey(request.tenantId!, keyId);

      return reply.send({
        success: true,
        message: 'تم حذف المفتاح بنجاح',
      });
    }
  );

  // ============================================
  // تحديث الملف الشخصي
  // ============================================
  app.put(
    '/profile',
    { preHandler: [jwtAuthGuard] },
    async (request, reply) => {
      const { prisma } = await import('../../common/database');
      const body = z.object({ name: z.string().min(2).optional() }).parse(request.body);

      const updated = await prisma.user.update({
        where: { id: request.userId },
        data: { ...(body.name && { name: body.name }) },
        select: { id: true, name: true, email: true, role: true },
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // ============================================
  // تغيير كلمة المرور
  // ============================================
  app.post(
    '/change-password',
    { preHandler: [jwtAuthGuard] },
    async (request, reply) => {
      const { prisma } = await import('../../common/database');
      const bcrypt = await import('bcryptjs');

      const body = z.object({
        currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
        newPassword: z.string().min(6, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'),
      }).parse(request.body);

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user) throw new AppError('المستخدم غير موجود', 404);

      const validPassword = await bcrypt.compare(body.currentPassword, user.password);
      if (!validPassword) throw new AppError('كلمة المرور الحالية غير صحيحة', 400);

      const newHash = await bcrypt.hash(body.newPassword, 12);
      await prisma.user.update({
        where: { id: request.userId },
        data: { password: newHash },
      });

      return reply.send({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    }
  );
};
