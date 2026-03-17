'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const statusLabels: Record<string, { icon: string; label: string; cls: string }> = {
  OPEN: { icon: '🟢', label: 'مفتوحة', cls: 'badge-success' },
  PENDING: { icon: '🟡', label: 'قيد الانتظار', cls: 'badge-warning' },
  RESOLVED: { icon: '✅', label: 'تم الحل', cls: 'badge-info' },
  CLOSED: { icon: '🔴', label: 'مغلقة', cls: 'badge-danger' },
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');

  useEffect(() => { load(); }, [statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.request<any[]>(`/conversations?${new URLSearchParams(params).toString()}`);
      setConversations(res.data || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const openConversation = async (conv: any) => {
    try {
      const res = await api.request<any>(`/conversations/${conv.id}`);
      setSelectedConv(res.data?.conversation);
      setConvMessages(res.data?.messages || []);
    } catch (e: any) { toast.error(e.message); }
  };

  const updateStatus = async (convId: string, status: string) => {
    try {
      await api.request(`/conversations/${convId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast.success('تم تحديث الحالة ✅');
      load();
      if (selectedConv?.id === convId) setSelectedConv({ ...selectedConv, status });
    } catch (e: any) { toast.error(e.message); }
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedConv) return;
    try {
      await api.request(`/conversations/${selectedConv.id}/notes`, { method: 'POST', body: JSON.stringify({ content: noteText }) });
      toast.success('تمت إضافة الملاحظة ✅');
      setNoteText('');
      openConversation(selectedConv);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>💬 المحادثات (Shared Inbox)</h1>
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="input" placeholder="🔍 بحث بالرقم أو الاسم..." value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ maxWidth: 250 }} />
        {['', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter(s)}>
            {s ? statusLabels[s]?.label : 'الكل'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedConv ? '1fr 2fr' : '1fr', gap: 16 }}>
        {/* قائمة المحادثات */}
        <div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ جاري التحميل...</div>
          ) : conversations.length === 0 ? (
            <div className="card empty-state"><div className="empty-icon">💬</div><h3>لا توجد محادثات</h3></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conversations.map(conv => (
                <div key={conv.id} className="card" onClick={() => openConversation(conv)}
                  style={{ padding: 12, cursor: 'pointer', borderRight: selectedConv?.id === conv.id ? '3px solid var(--color-primary)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{conv.contactName || conv.contactPhone}</div>
                      <div style={{ fontSize: 12, direction: 'ltr', display: 'inline-block', opacity: 0.6 }}>{conv.contactPhone}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {conv.unreadCount > 0 && (
                        <span style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {conv.unreadCount}
                        </span>
                      )}
                      <span className={`badge ${statusLabels[conv.status]?.cls || 'badge-info'}`}>
                        {statusLabels[conv.status]?.icon} {statusLabels[conv.status]?.label}
                      </span>
                    </div>
                  </div>
                  {conv.lastMessage && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>{conv.lastMessage.substring(0, 60)}...</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* تفاصيل المحادثة */}
        {selectedConv && (
          <div className="card animate-fade-in" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedConv.contactName || selectedConv.contactPhone}</h3>
                <span style={{ fontSize: 12, opacity: 0.6, direction: 'ltr' }}>{selectedConv.contactPhone}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map(s => (
                  <button key={s} className={`btn btn-sm ${selectedConv.status === s ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => updateStatus(selectedConv.id, s)}>
                    {statusLabels[s]?.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* الرسائل */}
            <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 12 }}>
              {convMessages.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.5 }}>لا توجد رسائل</p>
              ) : convMessages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex', justifyContent: msg.direction === 'OUTBOUND' ? 'flex-start' : 'flex-end',
                  marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                    background: msg.direction === 'OUTBOUND' ? 'var(--color-primary)' : 'var(--bg-card)',
                    color: msg.direction === 'OUTBOUND' ? '#fff' : 'var(--text-primary)',
                    border: msg.direction === 'INBOUND' ? '1px solid var(--border-color)' : 'none',
                  }}>
                    <div style={{ fontSize: 13 }}>{(msg.content as any)?.body || `[${msg.messageType}]`}</div>
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'end' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ملاحظات داخلية */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>📝 ملاحظات داخلية</h4>
              {selectedConv.notes?.map((n: any) => (
                <div key={n.id} style={{ fontSize: 12, padding: 8, background: '#fef3c7', borderRadius: 8, marginBottom: 4, color: '#92400e' }}>
                  {n.content} — <span style={{ opacity: 0.6 }}>{new Date(n.createdAt).toLocaleString('ar-EG')}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder="أضف ملاحظة..." value={noteText}
                  onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} />
                <button className="btn btn-sm btn-secondary" onClick={addNote}>إضافة</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
