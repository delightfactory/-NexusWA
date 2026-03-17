'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const t = useTranslations();
  const [messages, setMessages] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [sendForm, setSendForm] = useState({ instanceId: '', to: '', body: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ direction: '', status: '' });
  const pageSize = 20;

  useEffect(() => {
    api.listInstances().then(res => setInstances(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => { loadMessages(); }, [page, filter]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      if (filter.direction) params.direction = filter.direction;
      if (filter.status) params.status = filter.status;
      const res = await api.listMessages(params);
      setMessages(res.data || []);
      setTotal(res.pagination?.total || res.data?.length || 0);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!sendForm.instanceId || !sendForm.to || !sendForm.body) return;
    try {
      await api.sendMessage({ instanceId: sendForm.instanceId, to: sendForm.to, type: 'text', content: { body: sendForm.body } });
      toast.success('تم إرسال الرسالة ✅');
      setSendForm({ instanceId: sendForm.instanceId, to: '', body: '' });
      setShowSend(false);
      loadMessages();
    } catch (e: any) { toast.error(e.message); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      SENT: { cls: 'badge-success', label: '✅ مُرسل' },
      DELIVERED: { cls: 'badge-success', label: '✓✓ مُسلّم' },
      QUEUED: { cls: 'badge-warning', label: '⏳ في الانتظار' },
      FAILED: { cls: 'badge-danger', label: '❌ فشل' },
      SENDING: { cls: 'badge-info', label: '📤 إرسال...' },
      SCHEDULED: { cls: 'badge-info', label: '⏰ مجدول' },
      READ: { cls: 'badge-success', label: '👁️ مقروء' },
    };
    const s = map[status] || { cls: 'badge-info', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{t('messages.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowSend(true)}>📤 {t('messages.send')}</button>
      </div>

      {showSend && (
        <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select className="input" value={sendForm.instanceId} onChange={e => setSendForm({...sendForm, instanceId: e.target.value})}>
              <option value="">-- {t('instances.title')} --</option>
              {instances.filter(i => i.status === 'CONNECTED').map(i => <option key={i.id} value={i.id}>{i.name} ({i.phoneNumber})</option>)}
            </select>
            <input className="input" placeholder={t('messages.recipient')} value={sendForm.to} onChange={e => setSendForm({...sendForm, to: e.target.value})} />
            <textarea className="input" placeholder={t('messages.messageText')} value={sendForm.body} onChange={e => setSendForm({...sendForm, body: e.target.value})} rows={3} style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSend}>{t('messages.send')}</button>
              <button className="btn btn-secondary" onClick={() => setShowSend(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select className="input" value={filter.direction} onChange={e => { setFilter({...filter, direction: e.target.value}); setPage(1); }} style={{ width: 140 }}>
          <option value="">كل الاتجاهات</option>
          <option value="OUTBOUND">📤 صادر</option>
          <option value="INBOUND">📥 وارد</option>
        </select>
        <select className="input" value={filter.status} onChange={e => { setFilter({...filter, status: e.target.value}); setPage(1); }} style={{ width: 140 }}>
          <option value="">كل الحالات</option>
          <option value="SENT">مُرسل</option>
          <option value="DELIVERED">مُسلّم</option>
          <option value="FAILED">فشل</option>
          <option value="QUEUED">انتظار</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ {t('common.loading')}</div>
      ) : messages.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📨</div>
          <h3>{t('messages.noMessages')}</h3>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>#</th><th>{t('messages.recipient')}</th><th>المحتوى</th><th>{t('messages.type')}</th><th>{t('messages.status')}</th><th>التاريخ</th></tr></thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id}>
                    <td style={{ color: 'var(--text-tertiary)' }}>{msg.direction === 'OUTBOUND' ? '📤' : '📥'}</td>
                    <td style={{ fontWeight: 500, direction: 'ltr', display: 'inline-block' }}>{msg.recipient}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {(msg.content as any)?.body || `[${msg.messageType}]`}
                    </td>
                    <td>{msg.messageType}</td>
                    <td>{statusBadge(msg.status)}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>◀️</button>
            <span style={{ fontSize: 13 }}>صفحة {page} من {totalPages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>▶️</button>
          </div>
        </>
      )}
    </div>
  );
}
