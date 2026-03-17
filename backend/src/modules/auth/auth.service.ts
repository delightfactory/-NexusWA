// ===========================================
// NexusWA — خدمة المصادقة
// ===========================================

import bcrypt from 'bcryptjs';
import { prisma } from '../../common/database';
import { createModuleLogger } from '../../common/logger';
import { generateApiKey, hashApiKey, generateSlug } from '../../common/utils';
import { config } from '../../config';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors';

const logger = createModuleLogger('auth');

// ============================================
// تسجيل مستأجر جديد (شركة + مستخدم)
// ============================================
export interface RegisterInput {
  companyName: string;
  email: string;
  password: string;
  name: string;
}

export const registerTenant = async (input: RegisterInput) => {
  const { companyName, email, password, name } = input;

  // التحقق من عدم وجود الإيميل
  const existingTenant = await prisma.tenant.findUnique({ where: { email } });
  if (existingTenant) {
    throw new ConflictError('البريد الإلكتروني مسجل مسبقاً');
  }

  // الحصول على الخطة المجانية/الأساسية
  let defaultPlan = await prisma.plan.findFirst({
    where: { slug: 'starter', isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  // تشفير كلمة المرور
  const hashedPassword = await bcrypt.hash(password, 12);
  const slug = generateSlug(companyName) + '-' + Date.now().toString(36);

  // إنشاء المستأجر والمستخدم في عملية واحدة
  const tenant = await prisma.tenant.create({
    data: {
      name: companyName,
      slug,
      email,
      planId: defaultPlan?.id,
      users: {
        create: {
          email,
          password: hashedPassword,
          name,
          role: 'OWNER',
        },
      },
    },
    include: {
      users: true,
      plan: true,
    },
  });

  logger.info({ tenantId: tenant.id }, `✅ تم تسجيل مستأجر جديد: ${companyName}`);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      plan: tenant.plan,
    },
    user: {
      id: tenant.users[0].id,
      email: tenant.users[0].email,
      name: tenant.users[0].name,
      role: tenant.users[0].role,
    },
  };
};

// ============================================
// تسجيل الدخول
// ============================================
export interface LoginInput {
  email: string;
  password: string;
}

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    include: {
      tenant: {
        include: { plan: true },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError('بريد إلكتروني أو كلمة مرور غير صحيحة');
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new UnauthorizedError('بريد إلكتروني أو كلمة مرور غير صحيحة');
  }

  if (!user.tenant.isActive) {
    throw new UnauthorizedError('الحساب غير مفعل');
  }

  logger.info({ userId: user.id }, `✅ تسجيل دخول: ${user.email}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan,
    },
  };
};

// ============================================
// إنشاء مفتاح API
// ============================================
export const createApiKey = async (tenantId: string, name: string) => {
  const { key, prefix } = generateApiKey();
  const keyHash = hashApiKey(key, config.API_KEY_SALT);

  await prisma.apiKey.create({
    data: {
      tenantId,
      name,
      keyHash,
      keyPrefix: prefix,
    },
  });

  logger.info({ tenantId }, `🔑 تم إنشاء مفتاح API: ${prefix}...`);

  // نرجع المفتاح الكامل مرة واحدة فقط
  return { key, prefix, name };
};

// ============================================
// التحقق من مفتاح API
// ============================================
export const validateApiKey = async (key: string) => {
  const keyHash = hashApiKey(key, config.API_KEY_SALT);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      tenant: {
        include: { plan: true },
      },
    },
  });

  if (!apiKey || !apiKey.isActive) {
    throw new UnauthorizedError('مفتاح API غير صالح');
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new UnauthorizedError('مفتاح API منتهي الصلاحية');
  }

  if (!apiKey.tenant.isActive) {
    throw new UnauthorizedError('الحساب غير مفعل');
  }

  // تحديث آخر استخدام
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    tenantId: apiKey.tenant.id,
    tenant: apiKey.tenant,
  };
};

// ============================================
// قائمة مفاتيح API
// ============================================
export const listApiKeys = async (tenantId: string) => {
  return prisma.apiKey.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

// ============================================
// حذف مفتاح API
// ============================================
export const deleteApiKey = async (tenantId: string, keyId: string) => {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, tenantId },
  });

  if (!apiKey) {
    throw new NotFoundError('مفتاح API');
  }

  await prisma.apiKey.delete({ where: { id: keyId } });
  logger.info({ tenantId, keyId }, '🗑️ تم حذف مفتاح API');
};
