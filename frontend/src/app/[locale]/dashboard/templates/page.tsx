'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/shared';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', content: '', category: 'general' });
  const [preview, setPreview] = useState('');
  const { confirm, ConfirmUI } = useConfirm();

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try { const res = await api.listTemplates(); setTemplates(res.data || []); }
    catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await api.updateTemplate(editId, form);
        toast.success('تم تحديث القالب');
      } else {
        await api.createTemplate(form);
        toast.success('تم إنشاء القالب');
      }
      setForm({ name: '', content: '', category: 'general' });
      setShowAdd(false);
      setEditId(null);
      loadTemplates();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleEdit = (t: any) => {
    setForm({ name: t.name, content: t.content, category: t.category });
    setEditId(t.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('هل أنت متأكد من حذف هذا القالب؟', { title: 'حذف قالب', danger: true });
    if (!ok) return;
    try { await api.deleteTemplate(id); toast.success('تم الحذف'); loadTemplates(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handlePreview = async () => {
    try {
      const res = await api.previewTemplate(form.content, { name: 'أحمد', company: 'شركة تجريبية', phone: '01226011888' });
      setPreview(res.data.preview);
    } catch (e: any) { toast.error(e.message); }
  };

  const categories = ['general', 'marketing', 'support', 'notification'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📝 قوالب الرسائل</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ name: '', content: '', category: 'general' }); }}>
          + قالب جديد
        </button>
      </div>

      {/* نموذج الإضافة/التعديل */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>{editId ? '✏️ تعديل القالب' : '+ قالب جديد'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input className="input" placeholder="اسم القالب *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(c => <option key={c} value={c}>{c === 'general' ? 'عام' : c === 'marketing' ? 'تسويق' : c === 'support' ? 'دعم فني' : 'إشعارات'}</option>)}
            </select>
          </div>

          <textarea className="input" placeholder="محتوى الرسالة... استخدم {{name}} {{company}} {{phone}} كمتغيرات"
            value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            style={{ marginTop: 12, minHeight: 120 }} />

          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>💡 المتغيرات المتاحة: {'{{name}}'} {'{{company}}'} {'{{phone}}'}</p>

          {preview && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 14 }}>
              <strong>معاينة:</strong><br />{preview}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 حفظ</button>
            <button className="btn btn-ghost btn-sm" onClick={handlePreview}>👁️ معاينة</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditId(null); }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* قائمة القوالب */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>جاري التحميل...</div>
        ) : templates.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>📝</p>
            <p>لا توجد قوالب بعد. أنشئ أول قالب!</p>
          </div>
        ) : templates.map((t: any) => (
          <div key={t.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontWeight: 600 }}>{t.name}</h3>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: 'var(--primary-color)', color: '#fff' }}>
                    {t.category === 'general' ? 'عام' : t.category === 'marketing' ? 'تسويق' : t.category === 'support' ? 'دعم' : 'إشعارات'}
                  </span>
                </div>
                <p style={{ fontSize: 14, opacity: 0.8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{t.content}</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)} style={{ color: '#ef4444' }}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {ConfirmUI}
    </div>
  );
}
