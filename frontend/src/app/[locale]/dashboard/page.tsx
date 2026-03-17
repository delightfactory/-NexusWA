'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import styles from '@/styles/components.module.css';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics({ period: 'week' })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const overview = data?.overview || {};
  const recentCampaigns = data?.recentCampaigns || [];
  const instanceStats = data?.instanceStats || [];

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>{t('dashboard.title')}</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{t('dashboard.welcome')}</p>
      </div>

      {/* الإحصائيات الرئيسية */}
      <div className={styles.statsGrid}>
        {[
          { icon: '📱', value: loading ? '—' : overview.activeInstances ?? 0, label: t('dashboard.activeInstances'), color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
          { icon: '📤', value: loading ? '—' : overview.sentToday ?? 0, label: t('dashboard.messagesSent'), color: 'var(--color-success)', bg: 'var(--color-success-light)' },
          { icon: '📥', value: loading ? '—' : overview.receivedToday ?? 0, label: t('dashboard.messagesReceived'), color: 'var(--color-info)', bg: 'var(--color-info-light)' },
          { icon: '📊', value: loading ? '—' : overview.totalMessages ?? 0, label: t('dashboard.totalMessages'), color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
        ].map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}>{stat.icon}</div>
            <div className="stat-info"><h3>{stat.value}</h3><p>{stat.label}</p></div>
          </div>
        ))}
      </div>

      {/* إحصائيات إضافية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '16px 0' }}>
        {[
          { icon: '👥', label: 'جهات الاتصال', value: overview.totalContacts ?? 0, color: '#8b5cf6' },
          { icon: '📢', label: 'الحملات', value: overview.totalCampaigns ?? 0, color: '#f97316' },
          { icon: '✅', label: 'معدل النجاح', value: `${overview.successRate ?? 100}%`, color: '#22c55e' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* أنشط الأرقام */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>📱 أداء الأرقام</h3>
          {instanceStats.length === 0 ? (
            <p style={{ opacity: 0.4, textAlign: 'center', padding: 16 }}>لا توجد أرقام نشطة</p>
          ) : instanceStats.slice(0, 5).map((inst: any) => (
            <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{inst.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>{inst.totalSent} رسالة</span>
                <span>{inst.risk === 'GREEN' ? '🟢' : inst.risk === 'YELLOW' ? '🟡' : '🔴'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* آخر الحملات */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>📢 آخر الحملات</h3>
          {recentCampaigns.length === 0 ? (
            <p style={{ opacity: 0.4, textAlign: 'center', padding: 16 }}>لا توجد حملات</p>
          ) : recentCampaigns.slice(0, 5).map((c: any) => {
            const progress = c.totalCount > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalCount) * 100) : 0;
            return (
              <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ opacity: 0.6 }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: c.status === 'COMPLETED' ? '#22c55e' : '#6366f1' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Start */}
      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>🚀 Quick Start</h2>
        <div className={styles.quickSteps}>
          <div className={styles.quickStep} onClick={() => router.push('/dashboard/instances')} style={{ cursor: 'pointer' }}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}><h4>{t('instances.create')}</h4><p>{t('instances.scanQr')}</p></div>
          </div>
          <div className={styles.quickStep} onClick={() => router.push('/dashboard/settings')} style={{ cursor: 'pointer' }}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}><h4>{t('settings.createKey')}</h4><p>{t('settings.copyWarning')}</p></div>
          </div>
          <div className={styles.quickStep} onClick={() => router.push('/dashboard/integrations')} style={{ cursor: 'pointer' }}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}><h4>{t('messages.send')}</h4><p>POST /api/v1/messages/send</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
