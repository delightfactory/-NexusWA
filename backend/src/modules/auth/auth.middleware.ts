// ===========================================
// NexusWA — وسطاء المصادقة (Middleware)
// ===========================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../../common/errors';
import { validateApiKey } from './auth.service';

// ============================================
// أنواع البيانات المضافة للطلب
// ============================================
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
    userRole?: string;
  }
}

// ============================================
// التحقق عبر JWT (لوحة التحكم)
// ============================================
export const jwtAuthGuard = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const decoded = await request.jwtVerify<{
      userId: string;
      tenantId: string;
      role: string;
    }>();

    request.tenantId = decoded.tenantId;
    request.userId = decoded.userId;
    request.userRole = decoded.role;
  } catch (err) {
    throw new UnauthorizedError('توكن غير صالح أو منتهي الصلاحية');
  }
};

// ============================================
// التحقق عبر API Key (للأنظمة الخارجية)
// ============================================
export const apiKeyAuthGuard = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('مفتاح API مطلوب');
  }

  const key = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!key || !key.startsWith('nwa_')) {
    throw new UnauthorizedError('صيغة مفتاح API غير صحيحة');
  }

  const result = await validateApiKey(key);
  request.tenantId = result.tenantId;
};

// ============================================
// التحقق المختلط (JWT أو API Key)
// ============================================
export const hybridAuthGuard = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('مصادقة مطلوبة');
  }

  // لو API Key
  if (authHeader.startsWith('Bearer nwa_') || authHeader.startsWith('nwa_')) {
    return apiKeyAuthGuard(request, reply);
  }

  // لو JWT
  return jwtAuthGuard(request, reply);
};

// ============================================
// التحقق من الصلاحية (OWNER أو ADMIN)
// ============================================
export const adminGuard = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if (request.userRole !== 'OWNER' && request.userRole !== 'ADMIN') {
    throw new UnauthorizedError('هذا الإجراء يتطلب صلاحيات مدير');
  }
};
