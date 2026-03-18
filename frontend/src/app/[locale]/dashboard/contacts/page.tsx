'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/shared';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ phone: '', name: '', email: '', company: '', notes: '' });
  const [labelForm, setLabelForm] = useState({ name: '', color: '#6366f1' });
  const [pagination, setPagination] = useState<any>({});
  const [editId, setEditId] = useState<string | null>(null);
  const { confirm, ConfirmUI } = useConfirm();

  useEffect(() => { loadContacts(); loadLabels(); }, []);

  const loadContacts = async (params?: any) => {
    setLoading(true);
    try {
      const res = await api.listContacts({ search, ...params });
      setContacts(res.data || []);
      setPagination((res as any).pagination || {});
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const loadLabels = async () => {
    try { const res = await api.listLabels(); setLabels(res.data || []); } catch {}
  };

  const handleSave = async () => {
    try {
      if (editId) {
        await api.updateContact(editId, form);
        toast.success('تم تحديث جهة الاتصال ✅');
      } else {
        await api.createContact(form);
        toast.success('تم إضافة جهة الاتصال');
      }
      setForm({ phone: '', name: '', email: '', company: '', notes: '' });
      setShowAdd(false); setEditId(null);
      loadContacts();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleEdit = (c: any) => {
    setForm({ phone: c.phone || '', name: c.name || '', email: c.email || '', company: c.company || '', notes: c.notes || '' });
    setEditId(c.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('هل أنت متأكد من حذف جهة الاتصال؟', { title: 'حذف جهة اتصال', danger: true });
    if (!ok) return;
    try { await api.deleteContact(id); toast.success('تم الحذف'); loadContacts(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const csvContacts = lines.slice(1).map(line => {
      const [phone, name, email, company] = line.split(',').map(s => s.trim());
      return { phone, name, email, company };
    }).filter(c => c.phone);
    try {
      const res = await api.importContacts(csvContacts);
      toast.success(`تم استيراد ${res.data.imported} جهة اتصال (${res.data.skipped} مكرر)`);
      loadContacts(); setShowImport(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddLabel = async () => {
    try {
      await api.createLabel(labelForm);
      toast.success('تم إضافة التصنيف');
      setLabelForm({ name: '', color: '#6366f1' });
      setShowLabelForm(false); loadLabels();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>👥 جهات الاتصال</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(!showImport)}>📥 استيراد CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowLabelForm(!showLabelForm)}>🏷️ تصنيف جديد</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setForm({ phone: '', name: '', email: '', company: '', notes: '' }); setShowAdd(!showAdd); }}>+ إضافة جهة اتصال</button>
        </div>
      </div>

      {labels.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {labels.map((l: any) => (
            <span key={l.id} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, background: l.color + '22', color: l.color, border: `1px solid ${l.color}44`, cursor: 'pointer' }}
              onClick={() => loadContacts({ labelId: l.id })}>{l.name} ({l._count?.contacts || 0})</span>
          ))}
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', opacity: 0.6 }} onClick={() => loadContacts()}>✖ إزالة الفلتر</span>
        </div>
      )}

      {showLabelForm && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>🏷️ تصنيف جديد</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <input className="input" placeholder="اسم التصنيف" value={labelForm.name} onChange={e => setLabelForm({ ...labelForm, name: e.target.value })} />
            <input type="color" value={labelForm.color} onChange={e => setLabelForm({ ...labelForm, color: e.target.value })} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }} />
            <button className="btn btn-primary btn-sm" onClick={handleAddLabel}>إضافة</button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <h3 style={{ marginBottom: 8 }}>📥 استيراد من CSV</h3>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>الصيغة: phone,name,email,company</p>
          <input type="file" accept=".csv" onChange={handleImportCSV} />
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{editId ? '✏️ تعديل جهة اتصال' : '+ جهة اتصال جديدة'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input className="input" placeholder="رقم الهاتف *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={!!editId} style={editId ? { opacity: 0.6 } : {}} />
            <input className="input" placeholder="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="البريد الإلكتروني" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="الشركة" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          </div>
          <textarea className="input" placeholder="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ marginTop: 12, minHeight: 60 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>{editId ? '💾 حفظ التعديلات' : 'حفظ'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditId(null); }}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input className="input" placeholder="🔍 بحث بالاسم أو الرقم أو الشركة..." value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadContacts()} style={{ maxWidth: 400 }} />
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'start' }}>الاسم</th>
              <th style={{ padding: '12px 16px', textAlign: 'start' }}>الرقم</th>
              <th style={{ padding: '12px 16px', textAlign: 'start' }}>الشركة</th>
              <th style={{ padding: '12px 16px', textAlign: 'start' }}>التصنيفات</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ جاري التحميل...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>لا توجد جهات اتصال</td></tr>
            ) : contacts.map((c: any) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px' }}>{c.name || '—'}</td>
                <td style={{ padding: '12px 16px', direction: 'ltr' }}>{c.phone}</td>
                <td style={{ padding: '12px 16px' }}>{c.company || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  {c.labels?.map((l: any) => (
                    <span key={l.id} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: l.color + '22', color: l.color, marginInlineEnd: 4 }}>{l.name}</span>
                  ))}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(c)}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} style={{ color: '#ef4444' }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i} className={`btn btn-sm ${pagination.page === i + 1 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => loadContacts({ page: i + 1 })}>{i + 1}</button>
          ))}
        </div>
      )}
      {ConfirmUI}
    </div>
  );
}
