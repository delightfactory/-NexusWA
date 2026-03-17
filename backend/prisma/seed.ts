// ===========================================
// NexusWA — بيانات أولية (Seed)
// ===========================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 جاري إنشاء البيانات الأولية...');

  // ============================================
  // خطط الاشتراك
  // ============================================
  const plans = [
    {
      name: 'Starter',
      slug: 'starter',
      maxInstances: 1,
      maxMessagesPerDay: 500,
      maxContacts: 1000,
      priceMonthly: 0,
      sortOrder: 1,
      features: {
        webhooks: 2,
        rateLimit: 10,
        support: 'email',
        dashboard: 'basic',
      },
    },
    {
      name: 'Professional',
      slug: 'professional',
      maxInstances: 3,
      maxMessagesPerDay: 5000,
      maxContacts: 10000,
      priceMonthly: 29.99,
      sortOrder: 2,
      features: {
        webhooks: 10,
        rateLimit: 50,
        support: 'priority',
        dashboard: 'advanced',
        bulkMessaging: true,
      },
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      maxInstances: 10,
      maxMessagesPerDay: null, // غير محدود
      maxContacts: null,
      priceMonthly: 99.99,
      sortOrder: 3,
      features: {
        webhooks: -1, // غير محدود
        rateLimit: 200,
        support: 'dedicated',
        dashboard: 'full',
        bulkMessaging: true,
        whiteLabel: true,
        analytics: true,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
    console.log(`  ✅ خطة "${plan.name}" تم إنشاؤها`);
  }

  console.log('\n🎉 تم إنشاء البيانات الأولية بنجاح!');
  console.log('📊 الخطط المتاحة:');
  console.log('   - Starter (مجاني): 1 رقم، 500 رسالة/يوم');
  console.log('   - Professional ($29.99): 3 أرقام، 5000 رسالة/يوم');
  console.log('   - Enterprise ($99.99): 10 أرقام، غير محدود');
}

seed()
  .catch((error) => {
    console.error('❌ خطأ في إنشاء البيانات:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
