'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const messageTypeLabels: Record<string, string> = {
  TEXT: '📝 نص', IMAGE: '🖼️ صورة', VIDEO: '🎥 فيديو', AUDIO: '🎵 صوت',
  DOCUMENT: '📄 مستند', LOCATION: '📍 موقع', BUTTONS: '🔘 أزرار', LIST: '📋 قائمة',
  CONTACT: '👤 جهة اتصال', STICKER: '😀 ملصق',
};

export default function MessagesPage() {
  const t = useTranslations();
  const [messages, setMessages] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [sendType, setSendType] = useState('text');
  const [sendForm, setSendForm] = useState({
    instanceId: '', to: '', body: '', mediaUrl: '', caption: '',
    filename: '', latitude: '', longitude: '', locationName: '',
  });
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
    if (!sendForm.instanceId || !sendForm.to) return;
    try {
      const content: any = {};
      switch (sendType) {
        case 'text': content.body = sendForm.body; break;
        case 'image': content.mediaUrl = sendForm.mediaUrl; content.caption = sendForm.caption; break;
        case 'video': content.mediaUrl = sendForm.mediaUrl; content.caption = sendForm.caption; break;
        case 'audio': content.mediaUrl = sendForm.mediaUrl; content.ptt = true; break;
        case 'document': content.mediaUrl = sendForm.mediaUrl; content.filename = sendForm.filename || 'document'; break;
        case 'location':
          content.latitude = parseFloat(sendForm.latitude);
          content.longitude = parseFloat(sendForm.longitude);
          content.locationName = sendForm.locationName;
          break;
      }
      await api.sendMessage({ instanceId: sendForm.instanceId, to: sendForm.to, type: sendType, content });
      toast.success('تم إرسال الرسالة ✅');
      setSendForm({ ...sendForm, to: '', body: '', mediaUrl: '', caption: '', filename: '', latitude: '', longitude: '', locationName: '' });
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

  const getContentPreview = (msg: any) => {
    const content = msg.content as any;
    switch (msg.messageType) {
      case 'TEXT': return content?.body || '';
      case 'IMAGE': return `🖼️ ${content?.caption || 'صورة'}`;
      case 'VIDEO': return `🎥 ${content?.caption || 'فيديو'}`;
      case 'AUDIO': return '🎵 رسالة صوتية';
      case 'DOCUMENT': return `📄 ${content?.filename || 'مستند'}`;
      case 'LOCATION': return `📍 ${content?.locationName || 'موقع'}`;
      case 'BUTTONS': return `🔘 ${content?.body || 'أزرار'}`;
      case 'LIST': return `📋 ${content?.body || 'قائمة'}`;
      default: return `[${msg.messageType}]`;
    }
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
          <h3 style={{ marginBottom: 16 }}>📤 إرسال رسالة</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <select className="input" value={sendForm.instanceId} onChange={e => setSendForm({...sendForm, instanceId: e.target.value})}>
                <option value="">-- اختر رقم واتساب --</option>
                {instances.filter(i => i.status === 'CONNECTED').map(i => <option key={i.id} value={i.id}>{i.name} ({i.phoneNumber})</option>)}
              </select>
              <input className="input" placeholder="رقم المستلم" value={sendForm.to} onChange={e => setSendForm({...sendForm, to: e.target.value})} />
            </div>

            {/* اختيار نوع الرسالة */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'text', icon: '📝', label: 'نص' },
                { key: 'image', icon: '🖼️', label: 'صورة' },
                { key: 'video', icon: '🎥', label: 'فيديو' },
                { key: 'audio', icon: '🎵', label: 'صوت' },
                { key: 'document', icon: '📄', label: 'مستند' },
                { key: 'location', icon: '📍', label: 'موقع' },
              ].map(t => (
                <button key={t.key} className={`btn btn-sm ${sendType === t.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSendType(t.key)}>{t.icon} {t.label}</button>
              ))}
            </div>

            {/* حقول حسب النوع */}
            {sendType === 'text' && (
              <textarea className="input" placeholder="نص الرسالة..." value={sendForm.body}
                onChange={e => setSendForm({...sendForm, body: e.target.value})} rows={3} style={{ resize: 'vertical' }} />
            )}

            {(sendType === 'image' || sendType === 'video' || sendType === 'audio' || sendType === 'document') && (
              <>
                <input className="input" placeholder="رابط الملف (URL)" value={sendForm.mediaUrl}
                  onChange={e => setSendForm({...sendForm, mediaUrl: e.target.value})} />
                {(sendType === 'image' || sendType === 'video') && (
                  <input className="input" placeholder="وصف (اختياري)" value={sendForm.caption}
                    onChange={e => setSendForm({...sendForm, caption: e.target.value})} />
                )}
                {sendType === 'document' && (
                  <input className="input" placeholder="اسم الملف" value={sendForm.filename}
                    onChange={e => setSendForm({...sendForm, filename: e.target.value})} />
                )}
              </>
            )}

            {sendType === 'location' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <input className="input" placeholder="خط العرض (lat)" value={sendForm.latitude}
                  onChange={e => setSendForm({...sendForm, latitude: e.target.value})} />
                <input className="input" placeholder="خط الطول (lng)" value={sendForm.longitude}
                  onChange={e => setSendForm({...sendForm, longitude: e.target.value})} />
                <input className="input" placeholder="اسم الموقع" value={sendForm.locationName}
                  onChange={e => setSendForm({...sendForm, locationName: e.target.value})} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSend}
                disabled={!sendForm.instanceId || !sendForm.to}>📤 إرسال</button>
              <button className="btn btn-secondary" onClick={() => setShowSend(false)}>إلغاء</button>
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
                      {getContentPreview(msg)}
                    </td>
                    <td><span className="badge badge-info">{messageTypeLabels[msg.messageType] || msg.messageType}</span></td>
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
