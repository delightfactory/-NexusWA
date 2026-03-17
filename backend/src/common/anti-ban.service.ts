// ===========================================
// NexusWA — نظام الحماية من الحظر (Anti-Ban)
// ===========================================

import { prisma } from './database';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('anti-ban');

// ============================================
// إعدادات الحماية
// ============================================
interface RateLimitConfig {
  minDelay: number;    // تأخير أدنى (مللي ثانية)
  maxDelay: number;    // تأخير أقصى
  dailyLimit: number;  // حد يومي
  hourlyLimit: number; // حد ساعي
}

// مستويات حسب عمر الرقم
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // رقم جديد (0-7 أيام) — حماية قصوى
  NEW: {
    minDelay: 8000,
    maxDelay: 15000,
    dailyLimit: 50,
    hourlyLimit: 10,
  },
  // رقم عادي (7-30 يوم)
  NORMAL: {
    minDelay: 3000,
    maxDelay: 8000,
    dailyLimit: 200,
    hourlyLimit: 40,
  },
  // رقم قديم (30+ يوم) — حماية مخففة
  MATURE: {
    minDelay: 2000,
    maxDelay: 5000,
    dailyLimit: 500,
    hourlyLimit: 80,
  },
};

// حدود Warm-Up التدريجية (اليوم → الحد)
const WARMUP_DAILY_LIMITS: Record<number, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 120,
  6: 160,
  7: 200,
};

// ============================================
// خدمة Anti-Ban الرئيسية
// ============================================
class AntiBanService {

  /**
   * حساب مستوى الحماية حسب عمر الرقم
   */
  getInstanceAge(firstConnectedAt: Date | null): 'NEW' | 'NORMAL' | 'MATURE' {
    if (!firstConnectedAt) return 'NEW';

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - firstConnectedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return 'NEW';
    if (diffDays <= 30) return 'NORMAL';
    return 'MATURE';
  }

  /**
   * جلب إعدادات التأخير للرقم
   */
  getRateLimits(firstConnectedAt: Date | null): RateLimitConfig {
    const age = this.getInstanceAge(firstConnectedAt);
    return RATE_LIMITS[age];
  }

  /**
   * حساب التأخير الذكي بين الرسائل
   * يأخذ في الحسبان: عمر الرقم + عدد الرسائل المرسلة
   */
  calculateDelay(firstConnectedAt: Date | null, dailySent: number): number {
    const limits = this.getRateLimits(firstConnectedAt);
    const { minDelay, maxDelay, dailyLimit } = limits;

    // كلما اقتربنا من الحد — زيادة التأخير
    const usageRatio = dailySent / dailyLimit;
    let multiplier = 1;

    if (usageRatio > 0.8) multiplier = 2.5;       // 80%+ → بطئ جداً
    else if (usageRatio > 0.6) multiplier = 1.8;   // 60%+ → بطئ
    else if (usageRatio > 0.4) multiplier = 1.3;   // 40%+ → أبطأ شوية

    const baseDelay = minDelay + Math.random() * (maxDelay - minDelay);
    const finalDelay = Math.floor(baseDelay * multiplier);

    // إضافة تذبذب عشوائي (لمنع النمط الثابت)
    const jitter = Math.floor(Math.random() * 1000) - 500;

    return Math.max(minDelay, finalDelay + jitter);
  }

  /**
   * التحقق من إمكانية الإرسال (حدود يومية وساعية)
   */
  async canSendMessage(instanceId: string): Promise<{
    allowed: boolean;
    reason?: string;
    delay: number;
    dailySent: number;
    dailyLimit: number;
    riskLevel: string;
  }> {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: {
        firstConnectedAt: true,
        totalMessagesSent: true,
        dailyMessagesSent: true,
        dailyResetAt: true,
        warmUpCompleted: true,
        riskLevel: true,
      },
    });

    if (!instance) {
      return { allowed: false, reason: 'الجلسة غير موجودة', delay: 0, dailySent: 0, dailyLimit: 0, riskLevel: 'RED' };
    }

    // Reset يومي
    const now = new Date();
    let dailySent = instance.dailyMessagesSent;
    if (!instance.dailyResetAt || now.toDateString() !== instance.dailyResetAt.toDateString()) {
      dailySent = 0;
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { dailyMessagesSent: 0, dailyResetAt: now },
      });
    }

    // حساب الحد اليومي
    const limits = this.getRateLimits(instance.firstConnectedAt);
    let effectiveLimit = limits.dailyLimit;

    // Warm-Up: أول 7 أيام — حدود أقل
    if (!instance.warmUpCompleted && instance.firstConnectedAt) {
      const daysSinceFirst = Math.floor(
        (now.getTime() - instance.firstConnectedAt.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      if (daysSinceFirst <= 7) {
        effectiveLimit = WARMUP_DAILY_LIMITS[daysSinceFirst] || 20;
      } else {
        // بعد 7 أيام → تم التسخين
        await prisma.whatsAppInstance.update({
          where: { id: instanceId },
          data: { warmUpCompleted: true },
        });
      }
    }

    // التحقق من الحد اليومي
    if (dailySent >= effectiveLimit) {
      // تحديث مستوى الخطر
      await this.updateRiskLevel(instanceId, 'YELLOW');
      return {
        allowed: false,
        reason: `تم الوصول للحد اليومي (${effectiveLimit} رسالة). حاول غداً.`,
        delay: 0,
        dailySent,
        dailyLimit: effectiveLimit,
        riskLevel: 'YELLOW',
      };
    }

    // التحقق من الحد الساعي
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlySent = await prisma.message.count({
      where: {
        instanceId,
        direction: 'OUTBOUND',
        createdAt: { gte: oneHourAgo },
        status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING'] },
      },
    });

    if (hourlySent >= limits.hourlyLimit) {
      return {
        allowed: false,
        reason: `تم الوصول للحد الساعي (${limits.hourlyLimit} رسالة). انتظر قليلاً.`,
        delay: 0,
        dailySent,
        dailyLimit: effectiveLimit,
        riskLevel: instance.riskLevel,
      };
    }

    // حساب التأخير
    const delay = this.calculateDelay(instance.firstConnectedAt, dailySent);

    return {
      allowed: true,
      delay,
      dailySent,
      dailyLimit: effectiveLimit,
      riskLevel: instance.riskLevel,
    };
  }

  /**
   * تسجيل إرسال رسالة (لتحديث العدادات)
   */
  async recordMessageSent(instanceId: string): Promise<void> {
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: {
        totalMessagesSent: { increment: 1 },
        dailyMessagesSent: { increment: 1 },
      },
    });
  }

  /**
   * تحديث مستوى الخطر
   */
  async updateRiskLevel(instanceId: string, level: 'GREEN' | 'YELLOW' | 'RED'): Promise<void> {
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: { riskLevel: level },
    });
    logger.warn({ instanceId, level }, `⚠️ مستوى الخطر: ${level}`);
  }

  /**
   * تنويع المحتوى لتجنب الكشف
   * يضيف أحرف غير مرئية عشوائية لجعل كل رسالة فريدة
   */
  variateContent(text: string): string {
    // إضافة zero-width characters عشوائية
    const invisibleChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    const words = text.split(' ');

    if (words.length <= 2) return text;

    // إضافة حرف غير مرئي في موقع عشوائي
    const pos = Math.floor(Math.random() * (words.length - 1)) + 1;
    const char = invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    words.splice(pos, 0, char);

    return words.join(' ');
  }

  /**
   * تسجيل تاريخ أول اتصال (للأرقام الجديدة)
   */
  async markFirstConnection(instanceId: string): Promise<void> {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: { firstConnectedAt: true },
    });

    if (!instance?.firstConnectedAt) {
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { firstConnectedAt: new Date() },
      });
      logger.info({ instanceId }, '🆕 تم تسجيل أول اتصال — بداية فترة التسخين');
    }
  }

  /**
   * جلب ملخص حالة Anti-Ban لرقم معين
   */
  async getInstanceStatus(instanceId: string): Promise<{
    age: string;
    riskLevel: string;
    warmUpCompleted: boolean;
    warmUpDay: number;
    dailySent: number;
    dailyLimit: number;
    totalSent: number;
    delay: { min: number; max: number };
  }> {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: {
        firstConnectedAt: true,
        totalMessagesSent: true,
        dailyMessagesSent: true,
        warmUpCompleted: true,
        riskLevel: true,
      },
    });

    if (!instance) throw new Error('الجلسة غير موجودة');

    const age = this.getInstanceAge(instance.firstConnectedAt);
    const limits = this.getRateLimits(instance.firstConnectedAt);

    let warmUpDay = 0;
    let effectiveLimit = limits.dailyLimit;

    if (instance.firstConnectedAt) {
      warmUpDay = Math.floor(
        (Date.now() - instance.firstConnectedAt.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      if (!instance.warmUpCompleted && warmUpDay <= 7) {
        effectiveLimit = WARMUP_DAILY_LIMITS[warmUpDay] || 20;
      }
    }

    return {
      age,
      riskLevel: instance.riskLevel,
      warmUpCompleted: instance.warmUpCompleted,
      warmUpDay: Math.min(warmUpDay, 7),
      dailySent: instance.dailyMessagesSent,
      dailyLimit: effectiveLimit,
      totalSent: instance.totalMessagesSent,
      delay: { min: limits.minDelay, max: limits.maxDelay },
    };
  }
}

export const antiBanService = new AntiBanService();
