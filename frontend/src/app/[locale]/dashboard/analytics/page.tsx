'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    try { const res = await api.getAnalytics({ period }); setData(res.data); }
    catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleExport = (type: 'contacts' | 'messages') => {
    const token = localStorage.getItem('nexuswa_token');
    const baseUrl = 'http://localhost:3000/api/v1';
    window.open(`${baseUrl}/analytics/export/${type}`, '_blank');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ جاري التحميل...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center' }}>لا توجد بيانات</div>;

  const { overview, period: periodData, dailyStats, instanceStats, recentCampaigns } = data;

  // حساب max للـ bar chart
  const maxDaily = Math.max(...(dailyStats || []).map((d: any) => d.sent || 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📊 التقارير والإحصائيات</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {['week', 'month'].map(p => (
            <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPeriod(p)}>{p === 'week' ? 'أسبوع' : 'شهر'}</button>
          ))}
        </div>
      </div>

      {/* الأرقام الرئيسية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'إجمالي الرسائل', value: overview.totalMessages, icon: '📨', color: '#6366f1' },
          { label: 'مُرسل اليوم', value: overview.sentToday, icon: '📤', color: '#22c55e' },
          { label: 'مُستلم اليوم', value: overview.receivedToday, icon: '📥', color: '#3b82f6' },
          { label: 'جهات الاتصال', value: overview.totalContacts, icon: '👥', color: '#8b5cf6' },
          { label: 'أرقام نشطة', value: overview.activeInstances, icon: '📱', color: '#10b981' },
          { label: 'معدل النجاح', value: `${overview.successRate}%`, icon: '✅', color: '#22c55e' },
        ].map((stat, i) => (
          <div key={i} className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* إحصائيات الفترة */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 16 }}>📈 إحصائيات آخر {periodData.days} يوم</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 16, background: '#22c55e11', borderRadius: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{periodData.sent + periodData.delivered}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>تم الإرسال</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#ef444411', borderRadius: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{periodData.failed}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>فشل</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#3b82f611', borderRadius: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{periodData.delivered}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>تم التسليم</div>
          </div>
        </div>
      </div>

      {/* رسم بياني يومي — Bar Chart بـ CSS */}
      {dailyStats && dailyStats.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>📊 الرسائل المُرسلة يومياً</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {dailyStats.map((d: any, i: number) => {
              const h = Math.max((d.sent / maxDaily) * 100, 4);
              const dateStr = new Date(d.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{d.sent}</span>
                  <div style={{
                    width: '100%', height: `${h}%`, borderRadius: '4px 4px 0 0',
                    background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-hover))',
                    transition: 'height 0.5s ease',
                    minHeight: 4,
                  }} />
                  <span style={{ fontSize: 9, opacity: 0.5, whiteSpace: 'nowrap' }}>{dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* أداء الأرقام */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>📱 أداء الأرقام</h3>
          {instanceStats.length === 0 ? (
            <p style={{ opacity: 0.5, textAlign: 'center', padding: 20 }}>لا توجد أرقام</p>
          ) : instanceStats.map((inst: any) => (
            <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{inst.name}</div>
                <div style={{ fontSize: 12, opacity: 0.6, direction: 'ltr', display: 'inline' }}>{inst.phone || '—'}</div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{inst.totalSent} رسالة</div>
                <div style={{ fontSize: 12 }}>
                  اليوم: {inst.todaySent} •{' '}
                  <span style={{ color: inst.risk === 'GREEN' ? '#22c55e' : inst.risk === 'YELLOW' ? '#eab308' : '#ef4444' }}>
                    {inst.risk === 'GREEN' ? '🟢' : inst.risk === 'YELLOW' ? '🟡' : '🔴'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* آخر الحملات */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>📢 آخر الحملات</h3>
          {recentCampaigns.length === 0 ? (
            <p style={{ opacity: 0.5, textAlign: 'center', padding: 20 }}>لا توجد حملات</p>
          ) : recentCampaigns.map((c: any) => {
            const progress = c.totalCount > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalCount) * 100) : 0;
            return (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${progress}%`, height: '100%',
                    background: c.status === 'COMPLETED' ? '#22c55e' : c.status === 'RUNNING' ? '#eab308' : '#64748b',
                  }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                  ✅ {c.sentCount} | ❌ {c.failedCount} | 📊 {c.totalCount} مستهدف
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* أزرار التصدير */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: 16 }}>📥 تصدير البيانات</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('contacts')}>
            👥 تصدير جهات الاتصال (CSV)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('messages')}>
            📨 تصدير الرسائل (CSV)
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>💡 الملفات بتنسيق CSV متوافق مع Excel مع دعم اللغة العربية</p>
      </div>
    </div>
  );
}
