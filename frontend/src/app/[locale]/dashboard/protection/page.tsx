'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const riskColors: Record<string, { bg: string; color: string; label: string }> = {
  GREEN: { bg: '#22c55e22', color: '#22c55e', label: '🟢 آمن' },
  YELLOW: { bg: '#eab30822', color: '#eab308', label: '🟡 حذر' },
  RED: { bg: '#ef444422', color: '#ef4444', label: '🔴 خطر' },
};

const ageLabels: Record<string, string> = {
  NEW: '🆕 جديد (0-7 أيام)',
  NORMAL: '📱 عادي (7-30 يوم)',
  MATURE: '✅ ناضج (30+ يوم)',
};

export default function ProtectionPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => { loadData(); }, []);

  // Auto-refresh كل 30 ثانية
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const res = await api.getProtectionSummary();
      setInstances(res.data || []);
      setLastUpdate(new Date());
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🛡️ حماية الأرقام (Anti-Ban)</h1>
        <p style={{ fontSize: 14, opacity: 0.7 }}>مراقبة حالة حماية كل رقم واتساب من الحظر</p>
      </div>

      {/* شرح النظام */}
      <div className="card" style={{ padding: 20, marginBottom: 24, background: 'linear-gradient(135deg, #6366f111, #22c55e11)' }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>📋 كيف يعمل نظام Anti-Ban؟</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <strong>🕐 تأخير ذكي</strong>
            <p style={{ fontSize: 13, opacity: 0.7 }}>تأخير متغير بين الرسائل يحاكي السلوك البشري</p>
          </div>
          <div>
            <strong>📊 حدود يومية</strong>
            <p style={{ fontSize: 13, opacity: 0.7 }}>حدود تتكيف مع عمر الرقم ونشاطه</p>
          </div>
          <div>
            <strong>🔤 تنويع المحتوى</strong>
            <p style={{ fontSize: 13, opacity: 0.7 }}>تنويع تلقائي لجعل كل رسالة فريدة</p>
          </div>
          <div>
            <strong>⌨️ محاكاة الكتابة</strong>
            <p style={{ fontSize: 13, opacity: 0.7 }}>عرض "جاري الكتابة" قبل كل رسالة</p>
          </div>
        </div>
      </div>

      {/* جدول مراجع الحماية */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>📊 حدود الحماية حسب المستوى</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'start' }}>المستوى</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>التأخير</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>حد يومي</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>حد ساعي</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px' }}>🆕 رقم جديد (0-7 أيام)</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>8-15 ثانية</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>50</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>10</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px' }}>📱 رقم عادي (7-30 يوم)</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>3-8 ثواني</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>200</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>40</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px' }}>✅ رقم ناضج (30+ يوم)</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>2-5 ثواني</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>500</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>80</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* حالة الأرقام */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📱 حالة أرقامك</h2>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>جاري التحميل...</div>
      ) : instances.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>📱</p>
          <p>لا توجد أرقام واتساب. قم بربط رقم أولاً.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {instances.map((inst: any) => {
            const risk = riskColors[inst.riskLevel] || riskColors.GREEN;
            const usagePercent = inst.dailyLimit > 0 ? Math.round((inst.dailySent / inst.dailyLimit) * 100) : 0;

            return (
              <div key={inst.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{inst.name}</h3>
                    <p style={{ fontSize: 14, direction: 'ltr', display: 'inline' }}>{inst.phoneNumber || 'غير متصل'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, background: risk.bg, color: risk.color, fontWeight: 600 }}>
                      {risk.label}
                    </span>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, background: inst.status === 'CONNECTED' ? '#22c55e22' : '#64748b22', color: inst.status === 'CONNECTED' ? '#22c55e' : '#64748b' }}>
                      {inst.status === 'CONNECTED' ? '🟢 متصل' : '⚫ غير متصل'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  {/* مستوى الرقم */}
                  <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>مستوى الرقم</div>
                    <div style={{ fontWeight: 600 }}>{ageLabels[inst.age] || inst.age}</div>
                  </div>

                  {/* Warm-Up */}
                  <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>التسخين</div>
                    <div style={{ fontWeight: 600 }}>{inst.warmUpCompleted ? '✅ مكتمل' : '🔥 جاري التسخين'}</div>
                  </div>

                  {/* إجمالي المرسل */}
                  <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>إجمالي المرسل</div>
                    <div style={{ fontWeight: 600 }}>{inst.totalSent} رسالة</div>
                  </div>

                  {/* الاستخدام اليومي */}
                  <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>اليوم</div>
                    <div style={{ fontWeight: 600 }}>{inst.dailySent} / {inst.dailyLimit}</div>
                    <div style={{ marginTop: 6, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(usagePercent, 100)}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: usagePercent > 80 ? '#ef4444' : usagePercent > 50 ? '#eab308' : '#22c55e',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
