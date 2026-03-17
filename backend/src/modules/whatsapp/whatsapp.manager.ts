// ===========================================
// NexusWA — مدير جلسات واتساب (WhatsApp Manager)
// ===========================================

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { createModuleLogger } from '../../common/logger';
import { prisma } from '../../common/database';
import { formatPhoneNumber, randomDelay, delay } from '../../common/utils';
import { antiBanService } from '../../common/anti-ban.service';
import { EventEmitter } from 'events';

const logger = createModuleLogger('whatsapp');

// ============================================
// الأنواع
// ============================================
export interface InstanceInfo {
  id: string;
  tenantId: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  qrCode: string | null;
}

interface ActiveInstance {
  socket: WASocket;
  instanceId: string;
  tenantId: string;
}

// ============================================
// مدير الجلسات المركزي
// ============================================
class WhatsAppManager extends EventEmitter {
  private instances: Map<string, ActiveInstance> = new Map();
  private sessionsDir: string;

  constructor() {
    super();
    this.sessionsDir = path.resolve(process.cwd(), 'wa-sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    logger.info('🟢 مدير واتساب جاهز');
  }

  // ============================================
  // إعادة اتصال الجلسات النشطة عند بدء السيرفر
  // ============================================
  async restoreActiveSessions(): Promise<void> {
    try {
      const activeInstances = await prisma.whatsAppInstance.findMany({
        where: { status: { in: ['CONNECTED', 'CONNECTING', 'QR_PENDING'] } },
        select: { id: true, tenantId: true, name: true },
      });

      if (activeInstances.length === 0) {
        logger.info('لا توجد جلسات نشطة لاستعادتها');
        return;
      }

      logger.info(`🔄 استعادة ${activeInstances.length} جلسة نشطة...`);

      for (const inst of activeInstances) {
        try {
          await this.createInstance(inst.id, inst.tenantId);
          logger.info({ instanceId: inst.id, name: inst.name }, '✅ تم استعادة الجلسة');
        } catch (error: any) {
          logger.error({ instanceId: inst.id, error: error.message }, '❌ فشل استعادة الجلسة');
          // تحديث الحالة لـ DISCONNECTED لو فشل
          await prisma.whatsAppInstance.update({
            where: { id: inst.id },
            data: { status: 'DISCONNECTED', qrCode: null },
          });
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ خطأ في استعادة الجلسات');
    }
  }

  // ============================================
  // إنشاء جلسة واتساب جديدة
  // ============================================
  async createInstance(instanceId: string, tenantId: string): Promise<void> {
    if (this.instances.has(instanceId)) {
      logger.warn({ instanceId }, 'الجلسة موجودة بالفعل');
      return;
    }

    try {

    const sessionPath = path.join(this.sessionsDir, instanceId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    logger.info({ instanceId, version }, '🔄 جاري إنشاء جلسة واتساب...');

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger as any),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      browser: ['NexusWA', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    // ============================================
    // معالجة أحداث الاتصال
    // ============================================
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code جديد
      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
          });

          await prisma.whatsAppInstance.update({
            where: { id: instanceId },
            data: {
              status: 'QR_PENDING',
              qrCode: qrDataUrl,
            },
          });

          this.emit('qr', { instanceId, tenantId, qrCode: qrDataUrl });
          logger.info({ instanceId }, '📱 QR Code جاهز للمسح');
        } catch (error) {
          logger.error({ instanceId, error }, '❌ خطأ في إنشاء QR Code');
        }
      }

      // تم الاتصال
      if (connection === 'open') {
        const phoneNumber = socket.user?.id?.split(':')[0] || null;

        await prisma.whatsAppInstance.update({
          where: { id: instanceId },
          data: {
            status: 'CONNECTED',
            phoneNumber,
            qrCode: null,
            lastConnectedAt: new Date(),
          },
        });

        // تسجيل أول اتصال (Anti-Ban Warm-Up)
        await antiBanService.markFirstConnection(instanceId);

        this.emit('connected', { instanceId, tenantId, phoneNumber });
        logger.info({ instanceId, phoneNumber }, '✅ تم الاتصال بواتساب');
      }

      // انقطع الاتصال
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn(
          { instanceId, statusCode, shouldReconnect },
          '🔴 انقطع الاتصال'
        );

        this.instances.delete(instanceId);

        if (shouldReconnect) {
          // إعادة الاتصال بعد تأخير
          await randomDelay(3000, 8000);
          logger.info({ instanceId }, '🔄 إعادة الاتصال...');
          this.createInstance(instanceId, tenantId);
        } else {
          // تم تسجيل الخروج — حذف ملفات الجلسة
          await prisma.whatsAppInstance.update({
            where: { id: instanceId },
            data: {
              status: 'DISCONNECTED',
              qrCode: null,
              phoneNumber: null,
            },
          });

          this.cleanSession(instanceId);
          this.emit('disconnected', { instanceId, tenantId, loggedOut: true });
        }
      }
    });

    // ============================================
    // حفظ بيانات المصادقة
    // ============================================
    socket.ev.on('creds.update', saveCreds);

    // ============================================
    // استقبال الرسائل
    // ============================================
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;

        const sender = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const messageContent = this.extractMessageContent(msg);

        if (messageContent) {
          try {
            await prisma.message.create({
              data: {
                tenantId,
                instanceId,
                direction: 'INBOUND',
                recipient: sender,
                messageType: messageContent.type as any,
                content: messageContent.content,
                status: 'DELIVERED',
                deliveredAt: new Date(),
              },
            });

            this.emit('message.received', {
              instanceId, tenantId, from: sender, ...messageContent,
            });

            // === الرد التلقائي ===
            if (messageContent.type === 'TEXT') {
              const incomingText = (messageContent.content as any)?.body || '';
              if (incomingText) {
                this.processAutoReply(instanceId, tenantId, sender, incomingText)
                  .catch(err => logger.error({ instanceId, err: err.message }, '❌ خطأ في الرد التلقائي'));
              }
            }
          } catch (error) {
            logger.error({ instanceId, error }, '❌ خطأ في حفظ الرسالة الواردة');
          }
        }
      }
    });

    this.instances.set(instanceId, { socket, instanceId, tenantId });

    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: { status: 'CONNECTING' },
    });

    } catch (error: any) {
      logger.error({ instanceId, error: error.message, stack: error.stack }, '❌ خطأ في إنشاء جلسة واتساب');
      throw error;
    }
  }

  // ============================================
  // إرسال رسالة نصية
  // ============================================
  async sendTextMessage(
    instanceId: string,
    to: string,
    text: string
  ): Promise<any> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error('الجلسة غير متصلة');
    }

    // Anti-Ban: التحقق من إمكانية الإرسال
    const check = await antiBanService.canSendMessage(instanceId);
    if (!check.allowed) {
      throw new Error(check.reason || 'تم الوصول للحد المسموح');
    }

    const jid = formatPhoneNumber(to);

    // Anti-Ban: تأخير ذكي
    await delay(check.delay);

    // Anti-Ban: تنويع المحتوى
    const variedText = antiBanService.variateContent(text);

    // محاكاة الكتابة (Typing indicator) — لا نوقف الرسالة لو فشل
    try {
      await instance.socket.presenceSubscribe(jid);
      await delay(500);
      await instance.socket.sendPresenceUpdate('composing', jid);
      await delay(Math.min(variedText.length * 50, 3000));
      await instance.socket.sendPresenceUpdate('paused', jid);
    } catch (presErr) {
      logger.debug({ instanceId, jid }, 'تجاهل خطأ Presence');
    }

    const result = await instance.socket.sendMessage(jid, { text: variedText });

    // تسجيل الإرسال في Anti-Ban
    await antiBanService.recordMessageSent(instanceId);

    logger.info({ instanceId, to, delay: check.delay, dailySent: check.dailySent + 1 }, '📤 تم إرسال رسالة نصية');
    return result;
  }

  // ============================================
  // إرسال صورة
  // ============================================
  async sendImageMessage(
    instanceId: string,
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<any> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error('الجلسة غير متصلة');
    }

    const jid = formatPhoneNumber(to);
    await randomDelay(1500, 4000);

    const result = await instance.socket.sendMessage(jid, {
      image: { url: imageUrl },
      caption,
    });

    logger.info({ instanceId, to }, '📤 تم إرسال صورة');
    return result;
  }

  // ============================================
  // إرسال مستند
  // ============================================
  async sendDocumentMessage(
    instanceId: string,
    to: string,
    documentUrl: string,
    filename: string,
    mimetype: string
  ): Promise<any> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error('الجلسة غير متصلة');
    }

    const jid = formatPhoneNumber(to);
    await randomDelay(1500, 4000);

    const result = await instance.socket.sendMessage(jid, {
      document: { url: documentUrl },
      fileName: filename,
      mimetype,
    });

    logger.info({ instanceId, to }, '📤 تم إرسال مستند');
    return result;
  }

  // ============================================
  // قطع الاتصال
  // ============================================
  async disconnectInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      await instance.socket.logout();
      this.instances.delete(instanceId);
      this.cleanSession(instanceId);

      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status: 'DISCONNECTED',
          qrCode: null,
          phoneNumber: null,
        },
      });

      logger.info({ instanceId }, '🔌 تم قطع الاتصال');
    }
  }

  // ============================================
  // حالة الجلسة
  // ============================================
  getInstanceStatus(instanceId: string): string {
    return this.instances.has(instanceId) ? 'CONNECTED' : 'DISCONNECTED';
  }

  isConnected(instanceId: string): boolean {
    return this.instances.has(instanceId);
  }

  // ============================================
  // إيقاف جميع الجلسات
  // ============================================
  async shutdown(): Promise<void> {
    logger.info('🛑 إيقاف جميع جلسات واتساب...');
    for (const [id, instance] of this.instances) {
      try {
        instance.socket.end(undefined);
        this.instances.delete(id);
      } catch (error) {
        logger.error({ instanceId: id, error }, '❌ خطأ في إيقاف الجلسة');
      }
    }
  }

  // ============================================
  // أدوات داخلية
  // ============================================
  private extractMessageContent(msg: proto.IWebMessageInfo) {
    const message = msg.message;
    if (!message) return null;

    if (message.conversation || message.extendedTextMessage?.text) {
      return {
        type: 'TEXT',
        content: {
          body: message.conversation || message.extendedTextMessage?.text,
        },
      };
    }

    if (message.imageMessage) {
      return {
        type: 'IMAGE',
        content: {
          caption: message.imageMessage.caption,
          mimetype: message.imageMessage.mimetype,
        },
      };
    }

    if (message.videoMessage) {
      return {
        type: 'VIDEO',
        content: {
          caption: message.videoMessage.caption,
          mimetype: message.videoMessage.mimetype,
        },
      };
    }

    if (message.documentMessage) {
      return {
        type: 'DOCUMENT',
        content: {
          filename: message.documentMessage.fileName,
          mimetype: message.documentMessage.mimetype,
        },
      };
    }

    if (message.audioMessage) {
      return {
        type: 'AUDIO',
        content: {
          mimetype: message.audioMessage.mimetype,
          ptt: message.audioMessage.ptt,
        },
      };
    }

    return null;
  }

  private cleanSession(instanceId: string): void {
    const sessionPath = path.join(this.sessionsDir, instanceId);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
        logger.info({ instanceId }, '🧹 تم تنظيف ملفات الجلسة');
      }
    } catch (error) {
      logger.error({ instanceId, error }, '❌ خطأ في تنظيف ملفات الجلسة');
    }
  }

  /**
   * معالجة الرد التلقائي
   */
  private async processAutoReply(instanceId: string, tenantId: string, sender: string, text: string): Promise<void> {
    const rules = await prisma.autoReplyRule.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { instanceId: null }, // قواعد عامة
          { instanceId },       // قواعد خاصة بهذا الرقم
        ],
      },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      let matched = false;
      const lowerText = text.toLowerCase();
      const lowerTrigger = rule.trigger.toLowerCase();

      switch (rule.matchType) {
        case 'EXACT':
          matched = lowerText === lowerTrigger;
          break;
        case 'CONTAINS':
          matched = lowerText.includes(lowerTrigger);
          break;
        case 'STARTS_WITH':
          matched = lowerText.startsWith(lowerTrigger);
          break;
        case 'REGEX':
          try { matched = new RegExp(rule.trigger, 'i').test(text); } catch {}
          break;
      }

      if (matched) {
        logger.info({ instanceId, sender, trigger: rule.trigger }, '🤖 رد تلقائي متطابق');

        // تأخير قصير لمحاكاة القراءة
        await delay(1500 + Math.random() * 2000);

        await this.sendTextMessage(instanceId, sender, rule.response);

        // حفظ رسالة الرد
        await prisma.message.create({
          data: {
            tenantId,
            instanceId,
            direction: 'OUTBOUND',
            recipient: sender,
            messageType: 'TEXT',
            content: { body: rule.response },
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        break; // أول قاعدة متطابقة فقط
      }
    }
  }
}

// Singleton
export const whatsappManager = new WhatsAppManager();
