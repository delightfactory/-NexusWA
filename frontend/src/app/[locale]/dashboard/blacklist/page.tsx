'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function BlacklistPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      const res = await api.request<any[]>(`/blacklist?${new URLSearchParams(params).toString()}`);
      setList(res.data || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const addToBlacklist = async () => {
    if (!newPhone.trim()) return;
    try {
      await api.request('/blacklist', { method: 'POST', body: JSON.stringify({ phone: newPhone, reason: newReason || 'manual' }) });
      toast.success('تمت إضافة الرقم للقائمة السوداء 🚫');
      setNewPhone('');
      setNewReason('');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeFromBlacklist = async (id: string) => {
    try {
      await api.request(`/blacklist/${id}`, { method: 'DELETE' });
      toast.success('تمت إزالة الرقم من القائمة السوداء ✅');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>🚫 القائمة السوداء (Opt-Out)</h1>
      </div>

      {/* إضافة رقم */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>➕ إضافة رقم للقائمة السوداء</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="رقم الهاتف" value={newPhone}
            onChange={e => setNewPhone(e.target.value)} style={{ maxWidth: 200 }} />
          <input className="input" placeholder="السبب (اختياري)" value={newReason}
            onChange={e => setNewReason(e.target.value)} style={{ maxWidth: 200 }} />
          <button className="btn btn-danger btn-sm" onClick={addToBlacklist} disabled={!newPhone.trim()}>🚫 حظر</button>
        </div>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
          💡 عند إرسال العميل كلمة "STOP" أو "إلغاء" يتم إضافته تلقائياً للقائمة السوداء
        </p>
      </div>

      {/* بحث */}
      <div style={{ marginBottom: 16 }}>
        <input className="input" placeholder="🔍 بحث بالرقم..." value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
          style={{ maxWidth: 300 }} />
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">✅</div>
          <h3>القائمة فارغة</h3>
          <p>لا توجد أرقام محظورة</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>الرقم</th><th>السبب</th><th>التاريخ</th><th>إجراء</th></tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600, direction: 'ltr', display: 'inline-block' }}>{item.phone}</td>
                  <td>
                    <span className={`badge ${item.reason === 'STOP' ? 'badge-warning' : 'badge-info'}`}>
                      {item.reason === 'STOP' ? '🛑 STOP' : item.reason || 'يدوي'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, opacity: 0.6 }}>{new Date(item.createdAt).toLocaleString('ar-EG')}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeFromBlacklist(item.id)}>
                      ♻️ إزالة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
