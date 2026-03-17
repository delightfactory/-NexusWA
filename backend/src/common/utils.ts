// ===========================================
// NexusWA — أدوات مساعدة
// ===========================================

import { createHmac, randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

/**
 * إنشاء معرف فريد قصير
 */
export const generateId = (size: number = 21): string => {
  return nanoid(size);
};

/**
 * إنشاء مفتاح API بتنسيق: nwa_xxxxxxxxxx
 */
export const generateApiKey = (): { key: string; prefix: string } => {
  const key = `nwa_${randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12);
  return { key, prefix };
};

/**
 * تشفير مفتاح API عبر HMAC
 */
export const hashApiKey = (key: string, salt: string): string => {
  return createHmac('sha256', salt).update(key).digest('hex');
};

/**
 * توقيع Webhook عبر HMAC-SHA256
 */
export const signWebhookPayload = (payload: string, secret: string): string => {
  return createHmac('sha256', secret).update(payload).digest('hex');
};

/**
 * إنشاء slug من نص
 */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
};

/**
 * تنسيق رقم واتساب (تحويل تلقائي للصيغة الدولية)
 */
export const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/[^\d]/g, '');

  // إزالة + لو موجودة في البداية
  if (phone.startsWith('+')) {
    cleaned = phone.replace(/[^\d]/g, '');
  }

  // لو الرقم يبدأ بـ 0 → رقم محلي — نحوله لدولي (مصر افتراضياً)
  if (cleaned.startsWith('0')) {
    cleaned = '20' + cleaned.substring(1); // مصر
  }

  // لو الرقم قصير جداً — غالباً مش صحيح
  if (cleaned.length < 10) {
    throw new Error(`رقم الهاتف غير صالح: ${phone}`);
  }

  return cleaned.includes('@') ? cleaned : `${cleaned}@s.whatsapp.net`;
};

/**
 * تأخير تنفيذ (لمنع الحظر)
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * تأخير عشوائي بين حد أدنى وأقصى
 */
export const randomDelay = (minMs: number, maxMs: number): Promise<void> => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
};
