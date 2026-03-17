// ===========================================
// NexusWA — مسارات التقارير والإحصائيات
// ===========================================

import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/database';
import { hybridAuthGuard } from '../auth/auth.middleware';
import { createModuleLogger } from '../../common/logger';

const logger = createModuleLogger('analytics');

export const analyticsRoutes = async (app: FastifyInstance) => {
  // ============================================
  // لوحة الإحصائيات الشاملة
  // ============================================
  app.get('/', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const query = request.query as { period?: string };
    const days = query.period === 'week' ? 7 : query.period === 'month' ? 30 : 7;

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // إحصائيات عامة
    const [
      totalMessages,
      sentToday,
      receivedToday,
      totalContacts,
      activeInstances,
      totalCampaigns,
      sentMessages,
      failedMessages,
      deliveredMessages,
    ] = await Promise.all([
      prisma.message.count({ where: { tenantId } }),
      prisma.message.count({ where: { tenantId, direction: 'OUTBOUND', createdAt: { gte: today } } }),
      prisma.message.count({ where: { tenantId, direction: 'INBOUND', createdAt: { gte: today } } }),
      prisma.contact.count({ where: { tenantId } }),
      prisma.whatsAppInstance.count({ where: { tenantId, status: 'CONNECTED' } }),
      prisma.campaign.count({ where: { tenantId } }),
      prisma.message.count({ where: { tenantId, direction: 'OUTBOUND', status: 'SENT', createdAt: { gte: since } } }),
      prisma.message.count({ where: { tenantId, direction: 'OUTBOUND', status: 'FAILED', createdAt: { gte: since } } }),
      prisma.message.count({ where: { tenantId, direction: 'OUTBOUND', status: 'DELIVERED', createdAt: { gte: since } } }),
    ]);

    // إحصائيات يومية (للرسم البياني)
    const dailyStats = await prisma.usageLog.findMany({
      where: { tenantId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    // أنشط الأرقام
    const instanceStats = await prisma.whatsAppInstance.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
        totalMessagesSent: true,
        dailyMessagesSent: true,
        riskLevel: true,
      },
      orderBy: { totalMessagesSent: 'desc' },
    });

    // آخر الحملات
    const recentCampaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        totalCount: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
      },
    });

    // معدل النجاح
    const totalOutbound = sentMessages + failedMessages + deliveredMessages;
    const successRate = totalOutbound > 0
      ? Math.round(((sentMessages + deliveredMessages) / totalOutbound) * 100)
      : 100;

    return reply.send({
      success: true,
      data: {
        overview: {
          totalMessages,
          sentToday,
          receivedToday,
          totalContacts,
          activeInstances,
          totalCampaigns,
          successRate,
        },
        period: {
          sent: sentMessages,
          failed: failedMessages,
          delivered: deliveredMessages,
          days,
        },
        dailyStats: dailyStats.map((d: any) => ({
          date: d.date,
          sent: d.messagesSent,
          received: d.messagesReceived,
        })),
        instanceStats: instanceStats.map((i: any) => ({
          id: i.id,
          name: i.name,
          phone: i.phoneNumber,
          status: i.status,
          totalSent: i.totalMessagesSent,
          todaySent: i.dailyMessagesSent,
          risk: i.riskLevel,
        })),
        recentCampaigns,
      },
    });
  });

  // ============================================
  // تصدير جهات الاتصال CSV
  // ============================================
  app.get('/export/contacts', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      select: { name: true, phone: true, email: true, company: true, notes: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'الاسم,رقم الهاتف,البريد,الشركة,ملاحظات,تاريخ الإنشاء\n';
    const rows = contacts.map(c =>
      `"${c.name || ''}","${c.phone}","${c.email || ''}","${c.company || ''}","${(c.notes || '').replace(/"/g, '""')}","${new Date(c.createdAt).toLocaleDateString('ar-EG')}"`
    ).join('\n');

    const bom = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename=contacts_${new Date().toISOString().split('T')[0]}.csv`);
    return reply.send(bom + header + rows);
  });

  // ============================================
  // تصدير الرسائل CSV
  // ============================================
  app.get('/export/messages', { preHandler: [hybridAuthGuard] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const messages = await prisma.message.findMany({
      where: { tenantId },
      select: { direction: true, recipient: true, messageType: true, content: true, status: true, createdAt: true, sentAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = 'الاتجاه,المستلم,النوع,المحتوى,الحالة,تاريخ الإنشاء,تاريخ الإرسال\n';
    const rows = messages.map(m => {
      const body = (m.content as any)?.body || (m.content as any)?.caption || `[${m.messageType}]`;
      return `"${m.direction === 'OUTBOUND' ? 'صادر' : 'وارد'}","${m.recipient}","${m.messageType}","${body.replace(/"/g, '""')}","${m.status}","${new Date(m.createdAt).toLocaleString('ar-EG')}","${m.sentAt ? new Date(m.sentAt).toLocaleString('ar-EG') : ''}"`;
    }).join('\n');

    const bom = '\uFEFF';
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename=messages_${new Date().toISOString().split('T')[0]}.csv`);
    return reply.send(bom + header + rows);
  });
};
