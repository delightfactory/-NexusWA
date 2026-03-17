'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// صفحة Webhooks القديمة — redirect لصفحة التكامل الشاملة
export default function WebhooksRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/integrations'); }, [router]);
  return (
    <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
      <p>⏳ يتم التحويل لصفحة التكامل...</p>
    </div>
  );
}
