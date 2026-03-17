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
};
