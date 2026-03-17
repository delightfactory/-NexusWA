'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const matchTypes: Record<string, string> = {
  EXACT: 'تطابق تام',
  CONTAINS: 'يحتوي على',
  STARTS_WITH: 'يبدأ بـ',
  REGEX: 'تعبير منتظم',
};

export default function AutoReplyPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ trigger: '', matchType: 'CONTAINS', response: '', priority: 0 });

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    setLoading(true);
    try { const res = await api.listAutoReplies(); setRules(res.data || []); }
    catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await api.updateAutoReply(editId, form);
        toast.success('تم تحديث القاعدة');
      } else {
        await api.createAutoReply(form);
        toast.success('تم إنشاء القاعدة');
      }
      setForm({ trigger: '', matchType: 'CONTAINS', response: '', priority: 0 });
      setShowAdd(false);
      setEditId(null);
      loadRules();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (id: string) => {
    try { await api.toggleAutoReply(id); loadRules(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف القاعدة؟')) return;
    try { await api.deleteAutoReply(id); toast.success('تم الحذف'); loadRules(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleEdit = (r: any) => {
    setForm({ trigger: r.trigger, matchType: r.matchType, response: r.response, priority: r.priority });
    setEditId(r.id);
    setShowAdd(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>🤖 الرد التلقائي</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ trigger: '', matchType: 'CONTAINS', response: '', priority: 0 }); }}>
          + قاعدة جديدة
        </button>
      </div>

      {/* معلومات */}
      <div className="card" style={{ padding: 16, marginBottom: 20, background: 'linear-gradient(135deg, var(--primary-color)11, transparent)' }}>
        <p style={{ fontSize: 14 }}>💡 <strong>كيف يعمل؟</strong> عند استقبال رسالة تطابق الكلمة المفتاحية، يتم الرد تلقائياً بالنص المحدد.</p>
      </div>

      {/* نموذج الإضافة */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>{editId ? '✏️ تعديل القاعدة' : '+ قاعدة جديدة'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input className="input" placeholder='الكلمة المفتاحية (مثال: "أسعار")' value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} />
            <select className="input" value={form.matchType} onChange={e => setForm({ ...form, matchType: e.target.value })}>
              {Object.entries(matchTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <textarea className="input" placeholder="نص الرد التلقائي..."
            value={form.response} onChange={e => setForm({ ...form, response: e.target.value })}
            style={{ marginTop: 12, minHeight: 100 }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <label style={{ fontSize: 13 }}>الأولوية:</label>
            <input type="number" className="input" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
              style={{ width: 80 }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 حفظ</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditId(null); }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* قائمة القواعد */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>جاري التحميل...</div>
        ) : rules.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>🤖</p>
            <p>لا توجد قواعد رد تلقائي. أنشئ أول قاعدة!</p>
          </div>
        ) : rules.map((r: any) => (
          <div key={r.id} className="card" style={{ padding: 16, opacity: r.isActive ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>"{r.trigger}"</span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: '#6366f122', color: '#6366f1' }}>
                    {matchTypes[r.matchType]}
                  </span>
                  {!r.isActive && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: '#ef444422', color: '#ef4444' }}>معطّل</span>}
                </div>
                <p style={{ fontSize: 14, opacity: 0.8 }}>↩️ {r.response}</p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(r.id)} title={r.isActive ? 'تعطيل' : 'تفعيل'}>
                  {r.isActive ? '⏸️' : '▶️'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id)} style={{ color: '#ef4444' }}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
