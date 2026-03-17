// ===========================================
// NexusWA — مسارات إدارة أرقام واتساب
// ===========================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../common/database';
import { whatsappManager } from './whatsapp.manager';
import { jwtAuthGuard, hybridAuthGuard } from '../auth/auth.middleware';
import { NotFoundError, PlanLimitError } from '../../common/errors';
import { createModuleLogger } from '../../common/logger';
import { antiBanService } from '../../common/anti-ban.service';

const logger = createModuleLogger('whatsapp-routes');

const createInstanceSchema = z.object({
  name: z.string().min(1, 'اسم الجلسة مطلوب'),
});

export const whatsappRoutes = async (app: FastifyInstance) => {
  // ============================================
  // إنشاء جلسة جديدة
  // ============================================
  app.post(
    '/',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { name } = createInstanceSchema.parse(request.body);
      const tenantId = request.tenantId!;

      // التحقق من حد الخطة
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          plan: true,
          instances: true,
        },
      });

      if (tenant?.plan?.maxInstances) {
        const currentCount = tenant.instances.length;
        if (currentCount >= tenant.plan.maxInstances) {
          throw new PlanLimitError(
            `وصلت للحد الأقصى من الأرقام (${tenant.plan.maxInstances}). قم بترقية خطتك.`
          );
        }
      }

      const instance = await prisma.whatsAppInstance.create({
        data: {
          tenantId,
          name,
          status: 'DISCONNECTED',
        },
      });

      logger.info({ instanceId: instance.id, tenantId }, '✅ تم إنشاء جلسة جديدة');

      return reply.status(201).send({
        success: true,
        data: {
          id: instance.id,
          name: instance.name,
          status: instance.status,
        },
      });
    }
  );

  // ============================================
  // قائمة الجلسات
  // ============================================
  app.get(
    '/',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const instances = await prisma.whatsAppInstance.findMany({
        where: { tenantId: request.tenantId! },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          status: true,
          lastConnectedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: instances,
      });
    }
  );

  // ============================================
  // تفاصيل جلسة
  // ============================================
  app.get(
    '/:instanceId',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, tenantId: request.tenantId! },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          status: true,
          lastConnectedAt: true,
          createdAt: true,
        },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      return reply.send({
        success: true,
        data: {
          ...instance,
          isLive: whatsappManager.isConnected(instanceId),
        },
      });
    }
  );

  // ============================================
  // بدء الاتصال (الحصول على QR Code)
  // ============================================
  app.post(
    '/:instanceId/connect',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, tenantId: request.tenantId! },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      if (whatsappManager.isConnected(instanceId)) {
        return reply.send({
          success: true,
          data: { status: 'CONNECTED', message: 'الجلسة متصلة بالفعل' },
        });
      }

      // بدء الاتصال
      await whatsappManager.createInstance(instanceId, request.tenantId!);

      // انتظر QR Code (5 ثواني كحد أقصى)
      const qrCode = await new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);

        whatsappManager.once('qr', (data) => {
          if (data.instanceId === instanceId) {
            clearTimeout(timeout);
            resolve(data.qrCode);
          }
        });

        whatsappManager.once('connected', (data) => {
          if (data.instanceId === instanceId) {
            clearTimeout(timeout);
            resolve(null);
          }
        });
      });

      const updatedInstance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      return reply.send({
        success: true,
        data: {
          status: updatedInstance?.status || 'CONNECTING',
          qrCode: qrCode || updatedInstance?.qrCode,
        },
      });
    }
  );

  // ============================================
  // الحصول على QR Code الحالي
  // ============================================
  app.get(
    '/:instanceId/qr',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, tenantId: request.tenantId! },
        select: { qrCode: true, status: true },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      return reply.send({
        success: true,
        data: {
          status: instance.status,
          qrCode: instance.qrCode,
        },
      });
    }
  );

  // ============================================
  // قطع الاتصال
  // ============================================
  app.post(
    '/:instanceId/disconnect',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, tenantId: request.tenantId! },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      await whatsappManager.disconnectInstance(instanceId);

      return reply.send({
        success: true,
        message: 'تم قطع الاتصال بنجاح',
      });
    }
  );

  // ============================================
  // حذف جلسة
  // ============================================
  app.delete(
    '/:instanceId',
    { preHandler: [jwtAuthGuard] },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, tenantId: request.tenantId! },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      // قطع الاتصال لو متصل
      if (whatsappManager.isConnected(instanceId)) {
        await whatsappManager.disconnectInstance(instanceId);
      }

      await prisma.whatsAppInstance.delete({ where: { id: instanceId } });

      logger.info({ instanceId }, '🗑️ تم حذف الجلسة');

      return reply.send({
        success: true,
        message: 'تم حذف الجلسة بنجاح',
      });
    }
  );

  // ============================================
  // ملخص حالة Anti-Ban لكل الأرقام — MUST be BEFORE /:instanceId
  // ============================================
  app.get(
    '/protection/summary',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const instances = await prisma.whatsAppInstance.findMany({
        where: { tenantId: request.tenantId! },
      });

      const summary = instances.map((inst: any) => {
        const age = antiBanService.getInstanceAge(inst.firstConnectedAt);
        const limits = antiBanService.getRateLimits(inst.firstConnectedAt);
        return {
          id: inst.id,
          name: inst.name,
          phoneNumber: inst.phoneNumber,
          status: inst.status,
          riskLevel: inst.riskLevel || 'GREEN',
          age,
          warmUpCompleted: inst.warmUpCompleted || false,
          dailySent: inst.dailyMessagesSent || 0,
          dailyLimit: limits.dailyLimit,
          totalSent: inst.totalMessagesSent || 0,
        };
      });

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // ============================================
  // حالة Anti-Ban لرقم معين
  // ============================================
  app.get(
    '/:instanceId/protection',
    { preHandler: [hybridAuthGuard] },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, tenantId: request.tenantId! },
      });

      if (!instance) throw new NotFoundError('الجلسة');

      const status = await antiBanService.getInstanceStatus(instanceId);

      return reply.send({
        success: true,
        data: status,
      });
    }
  );
};

