'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import styles from '@/styles/components.module.css';
import toast from 'react-hot-toast';

export default function InstancesPage() {
  const t = useTranslations();
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [qrModal, setQrModal] = useState<{ id: string; qr: string | null; status: string } | null>(null);

  const loadInstances = async () => {
    try { const res = await api.listInstances(); setInstances(res.data || []); }
    catch (e: any) { toast.error(e.message || 'خطأ في تحميل الأرقام'); }
    setLoading(false);
  };

  useEffect(() => { loadInstances(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.createInstance(newName);
      toast.success('تم إنشاء الرقم بنجاح');
      setNewName(''); setShowCreate(false); loadInstances();
    } catch (e: any) { toast.error(e.message || 'خطأ في إنشاء الرقم'); }
  };

  const handleConnect = async (id: string) => {
    try {
      const res = await api.connectInstance(id);
      setQrModal({ id, qr: res.data?.qrCode, status: res.data?.status });
      const interval = setInterval(async () => {
        try {
          const qrRes = await api.getQrCode(id);
          if (qrRes.data?.status === 'CONNECTED') {
            clearInterval(interval); setQrModal(null); loadInstances();
            toast.success('تم الاتصال بنجاح! ✅');
          } else if (qrRes.data?.qrCode) {
            setQrModal({ id, qr: qrRes.data.qrCode, status: qrRes.data.status });
          }
        } catch (e) { clearInterval(interval); }
      }, 3000);
    } catch (e: any) { toast.error(e.message || 'خطأ في الاتصال'); }
  };

  const handleDisconnect = async (id: string) => {
    try { await api.disconnectInstance(id); toast.success('تم قطع الاتصال'); loadInstances(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('instances.confirmDelete'))) return;
    try { await api.deleteInstance(id); toast.success('تم الحذف'); loadInstances(); }
    catch (e: any) { toast.error(e.message); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      CONNECTED: { cls: 'badge-success', label: t('instances.connected') },
      DISCONNECTED: { cls: 'badge-danger', label: t('instances.disconnected') },
      CONNECTING: { cls: 'badge-warning', label: t('instances.connecting') },
      QR_PENDING: { cls: 'badge-info', label: t('instances.qrPending') },
    };
    const s = map[status] || { cls: 'badge-danger', label: status };
    return <span className={`badge ${s.cls}`}>● {s.label}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{t('instances.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ {t('instances.create')}</button>
      </div>

      {showCreate && (
        <div className="card animate-fade-in" style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
          <input className="input" placeholder={t('instances.name')} value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1 }} autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button className="btn btn-primary" onClick={handleCreate}>{t('common.create')}</button>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>⏳ {t('common.loading')}</div>
      ) : instances.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📱</div>
          <h3>{t('instances.noInstances')}</h3>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>+ {t('instances.create')}</button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>{t('instances.name')}</th><th>{t('instances.phone')}</th><th>{t('instances.status')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {instances.map(inst => (
                <tr key={inst.id}>
                  <td style={{ fontWeight: 600 }}>{inst.name}</td>
                  <td style={{ direction: 'ltr', display: 'inline-block' }}>{inst.phoneNumber || '—'}</td>
                  <td>{statusBadge(inst.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {inst.status !== 'CONNECTED' && <button className="btn btn-primary btn-sm" onClick={() => handleConnect(inst.id)}>{t('instances.connect')}</button>}
                      {inst.status === 'CONNECTED' && <button className="btn btn-secondary btn-sm" onClick={() => handleDisconnect(inst.id)}>{t('instances.disconnect')}</button>}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inst.id)}>{t('instances.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qrModal && (
        <div className={styles.modalOverlay} onClick={() => setQrModal(null)}>
          <div className={`${styles.modal} card animate-fade-in`} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 16 }}>{t('instances.scanQr')}</h2>
            {qrModal.qr ? <img src={qrModal.qr} alt="QR Code" style={{ width: 280, height: 280, borderRadius: 12 }} /> : <p>⏳ {t('common.loading')}</p>}
            <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('instances.scanQr')}</p>
            <button className="btn btn-secondary" onClick={() => setQrModal(null)} style={{ marginTop: 16, width: '100%' }}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
