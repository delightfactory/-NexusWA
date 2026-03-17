'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ScheduledPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    instanceId: '', to: '', body: '', scheduledAt: '',
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([api.listScheduled(), api.listInstances()]);
      setMessages(m.data || []);
      setInstances(i.data || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleCreate = async () => {
    try {
      await api.createScheduled({
        instanceId: form.instanceId,
        to: form.to,
        type: 'text',
        content: { body: form.body },
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      toast.success('تم جدولة الرسالة');
      setShowCreate(false);
      setForm({ instanceId: '', to: '', body: '', scheduledAt: '' });
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('إلغاء هذه الرسالة المجدولة؟')) return;
    try { await api.cancelScheduled(id); toast.success('تم الإلغاء'); loadAll(); }
    catch (e: any) { toast.error(e.message); }
  };

  // حساب أقرب وقت تحت الدقيقة المقبلة
  const minDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>⏰ الرسائل المجدولة</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ جدولة رسالة</button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>+ رسالة مجدولة جديدة</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <select className="input" value={form.instanceId} onChange={e => setForm({ ...form, instanceId: e.target.value })}>
              <option value="">اختر رقم واتساب...</option>
              {instances.map((i: any) => (
                <option key={i.id} value={i.id}>{i.name} {i.phoneNumber ? `(${i.phoneNumber})` : ''}</option>
              ))}
            </select>
            <input className="input" placeholder="رقم المستلم" value={form.to}
              onChange={e => setForm({ ...form, to: e.target.value })} />
          </div>
          <textarea className="input" placeholder="نص الرسالة..." value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })} style={{ minHeight: 80, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 13, opacity: 0.7, display: 'block', marginBottom: 4 }}>وقت الإرسال</label>
              <input type="datetime-local" className="input" min={minDateTime()} value={form.scheduledAt}
                onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleCreate}
                disabled={!form.instanceId || !form.to || !form.body || !form.scheduledAt}>⏰ جدولة</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>جاري التحميل...</div>
        ) : messages.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>⏰</p>
            <p>لا توجد رسائل مجدولة</p>
          </div>
        ) : messages.map((m: any) => {
          const scheduled = new Date(m.scheduledAt);
          const isUpcoming = scheduled > new Date();
          return (
            <div key={m.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, direction: 'ltr', display: 'inline' }}>{m.recipient}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11,
                      background: isUpcoming ? '#eab30822' : '#22c55e22',
                      color: isUpcoming ? '#eab308' : '#22c55e',
                    }}>{isUpcoming ? '⏳ في الانتظار' : '✅ تم الإرسال'}</span>
                  </div>
                  <p style={{ fontSize: 14, marginBottom: 4 }}>{(m.content as any)?.body || ''}</p>
                  <p style={{ fontSize: 12, opacity: 0.5 }}>
                    📅 {scheduled.toLocaleDateString('ar-EG')} {scheduled.toLocaleTimeString('ar-EG')}
                    {m.instance && ` • 📱 ${m.instance.name}`}
                  </p>
                </div>
                {isUpcoming && m.status === 'SCHEDULED' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(m.id)} style={{ color: '#ef4444' }}>❌ إلغاء</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
