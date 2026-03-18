'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/shared';

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'مسودة', bg: '#64748b22', color: '#64748b' },
  SCHEDULED: { label: 'مجدولة', bg: '#6366f122', color: '#6366f1' },
  RUNNING: { label: '🔄 جاري الإرسال', bg: '#eab30822', color: '#eab308' },
  PAUSED: { label: '⏸️ متوقفة', bg: '#f9731622', color: '#f97316' },
  COMPLETED: { label: '✅ مكتملة', bg: '#22c55e22', color: '#22c55e' },
  CANCELLED: { label: '❌ ملغاة', bg: '#ef444422', color: '#ef4444' },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentMode, setContentMode] = useState<'text' | 'template'>('text');
  const [form, setForm] = useState({
    name: '', instanceId: '', body: '', targetType: 'manual' as string, targetData: '', templateId: '',
  });
  const { confirm, ConfirmUI } = useConfirm();

  useEffect(() => { loadAll(); }, []);

  // Auto-poll كل 5 ثواني لو فيه حملات جارية
  useEffect(() => {
    const hasRunning = campaigns.some((c: any) => c.status === 'RUNNING');
    if (!hasRunning) return;
    const interval = setInterval(() => {
      api.listCampaigns().then(res => setCampaigns(res.data || [])).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [campaigns]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, i, l, t] = await Promise.all([
        api.listCampaigns(),
        api.listInstances(),
        api.listLabels(),
        api.listTemplates(),
      ]);
      setCampaigns(c.data || []);
      setInstances(i.data || []);
      setLabels(l.data || []);
      setTemplates(t.data || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = templates.find((t: any) => t.id === templateId);
    if (tmpl) {
      setForm({ ...form, templateId, body: tmpl.content });
    }
  };

  const handleCreate = async () => {
    try {
      const targetData = form.targetType === 'manual'
        ? form.targetData.split('\n').map(s => s.trim()).filter(Boolean)
        : form.targetType === 'label'
          ? form.targetData.split(',').map(s => s.trim()).filter(Boolean)
          : [];

      await api.createCampaign({
        name: form.name,
        instanceId: form.instanceId,
        content: { type: 'text', body: form.body },
        targetType: form.targetType,
        targetData,
      });
      toast.success('تم إنشاء الحملة');
      setShowCreate(false);
      setForm({ name: '', instanceId: '', body: '', targetType: 'manual', targetData: '', templateId: '' });
      setContentMode('text');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleStart = async (id: string) => {
    try { await api.startCampaign(id); toast.success('تم بدء الحملة'); loadAll(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handlePause = async (id: string) => {
    try { await api.pauseCampaign(id); toast.success('تم إيقاف الحملة'); loadAll(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('هل أنت متأكد من حذف هذه الحملة؟', { title: 'حذف حملة', danger: true });
    if (!ok) return;
    try { await api.deleteCampaign(id); toast.success('تم الحذف'); loadAll(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📢 الحملات الجماعية</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ حملة جديدة</button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>+ حملة جديدة</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input className="input" placeholder="اسم الحملة *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.instanceId} onChange={e => setForm({ ...form, instanceId: e.target.value })}>
              <option value="">اختر رقم واتساب...</option>
              {instances.filter((i: any) => i.status === 'CONNECTED').map((i: any) => (
                <option key={i.id} value={i.id}>{i.name} {i.phoneNumber ? `(${i.phoneNumber})` : ''}</option>
              ))}
            </select>
          </div>

          {/* اختيار مصدر المحتوى */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className={`btn btn-sm ${contentMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setContentMode('text')}>📝 كتابة مباشرة</button>
            <button className={`btn btn-sm ${contentMode === 'template' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setContentMode('template')}>📋 من قالب</button>
          </div>

          {contentMode === 'template' && (
            <div style={{ marginBottom: 12 }}>
              <select className="input" value={form.templateId}
                onChange={e => handleSelectTemplate(e.target.value)}>
                <option value="">اختر قالب...</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category === 'general' ? 'عام' : t.category === 'marketing' ? 'تسويق' : t.category === 'support' ? 'دعم' : 'إشعارات'})
                  </option>
                ))}
              </select>
              {form.templateId && (
                <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>💡 يمكنك تعديل النص بعد اختيار القالب. المتغيرات مثل {'{{name}}'} ستُستبدل ببيانات كل جهة اتصال.</p>
              )}
            </div>
          )}

          <textarea className="input" placeholder={contentMode === 'template' ? 'محتوى القالب (يمكنك تعديله)...' : 'نص الرسالة...'}
            value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} style={{ minHeight: 100, marginBottom: 12 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <select className="input" value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value })}>
              <option value="manual">أرقام يدوية</option>
              <option value="label">حسب التصنيف</option>
              <option value="all">كل جهات الاتصال</option>
            </select>

            {form.targetType === 'manual' && (
              <textarea className="input" placeholder="رقم واحد في كل سطر..." value={form.targetData}
                onChange={e => setForm({ ...form, targetData: e.target.value })} style={{ minHeight: 80 }} />
            )}
            {form.targetType === 'label' && (
              <select className="input" multiple value={form.targetData.split(',').filter(Boolean)}
                onChange={e => setForm({ ...form, targetData: Array.from(e.target.selectedOptions, o => o.value).join(',') })}>
                {labels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            {form.targetType === 'all' && (
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 14 }}>
                ⚠️ سيتم الإرسال لكل جهات الاتصال المسجلة
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}
              disabled={!form.name || !form.instanceId || !form.body}>📢 إنشاء الحملة</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {/* قائمة الحملات */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ جاري التحميل...</div>
        ) : campaigns.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>📢</p>
            <p>لا توجد حملات بعد. أنشئ أول حملة!</p>
          </div>
        ) : campaigns.map((c: any) => {
          const s = statusMap[c.status] || statusMap.DRAFT;
          const progress = c.totalCount > 0 ? Math.round(((c.sentCount + c.failedCount) / c.totalCount) * 100) : 0;

          return (
            <div key={c.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <h3 style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</h3>
                    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, background: s.bg, color: s.color, fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize: 13, opacity: 0.6 }}>
                    {new Date(c.createdAt).toLocaleDateString('ar-EG')} • {c.totalCount} مستهدف • {c.targetType === 'manual' ? 'يدوي' : c.targetType === 'label' ? 'بالتصنيف' : 'الكل'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleStart(c.id)}>▶️ تشغيل</button>
                  )}
                  {c.status === 'RUNNING' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handlePause(c.id)}>⏸️ إيقاف</button>
                  )}
                  {c.status !== 'RUNNING' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} style={{ color: '#ef4444' }}>🗑️</button>
                  )}
                </div>
              </div>

              {/* شريط التقدم */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${progress}%`, height: '100%', borderRadius: 4,
                      background: c.status === 'COMPLETED' ? '#22c55e' : 'var(--primary-color)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'end' }}>
                  ✅ {c.sentCount} | ❌ {c.failedCount} | 📊 {progress}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {ConfirmUI}
    </div>
  );
}
