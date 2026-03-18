'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/shared';

export default function SettingsPage() {
  const t = useTranslations();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [activeTab, setActiveTab] = useState<'api' | 'profile' | 'password'>('api');
  const { confirm, ConfirmUI } = useConfirm();

  useEffect(() => {
    api.listApiKeys().then(res => setApiKeys(res.data || [])).catch(() => {});
    api.getMe().then(res => setProfile({ name: res.data?.name || '', email: res.data?.email || '' })).catch(() => {});
  }, []);

  const handleCreateKey = async () => {
    if (!keyName.trim()) return;
    try {
      const res = await api.createApiKey(keyName);
      setNewKey(res.data?.key);
      setKeyName(''); setShowCreate(false);
      toast.success('تم إنشاء المفتاح');
      api.listApiKeys().then(res => setApiKeys(res.data || []));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast.success('تم نسخ المفتاح 📋');
    }
  };

  const handleDeleteKey = async (id: string) => {
    const ok = await confirm('هل أنت متأكد من حذف هذا المفتاح؟', { title: 'حذف مفتاح API', danger: true });
    if (!ok) return;
    try {
      await api.deleteApiKey(id);
      toast.success('تم حذف المفتاح');
      api.listApiKeys().then(res => setApiKeys(res.data || []));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdateProfile = async () => {
    try {
      await api.request('/auth/profile', { method: 'PUT', body: JSON.stringify({ name: profile.name }) });
      toast.success('تم تحديث الملف الشخصي ✅');
    } catch (e: any) { toast.error(e.message || 'خطأ في التحديث'); }
  };

  const handleChangePassword = async () => {
    if (passwords.newPass !== passwords.confirm) {
      toast.error('كلمة المرور الجديدة غير متطابقة');
      return;
    }
    if (passwords.newPass.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    try {
      await api.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
      });
      toast.success('تم تغيير كلمة المرور ✅');
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (e: any) { toast.error(e.message || 'خطأ في تغيير كلمة المرور'); }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 24 }}>{t('settings.title')}</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
        {[
          { key: 'api' as const, label: '🔑 مفاتيح API' },
          { key: 'profile' as const, label: '👤 الملف الشخصي' },
          { key: 'password' as const, label: '🔒 كلمة المرور' },
        ].map(tab => (
          <button key={tab.key} className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
        ))}
      </div>

      {/* API Keys Tab */}
      {activeTab === 'api' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem' }}>🔑 {t('settings.apiKeys')}</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ {t('settings.createKey')}</button>
          </div>

          {showCreate && (
            <div className="animate-fade-in" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="input" placeholder={t('settings.keyName')} value={keyName} onChange={e => setKeyName(e.target.value)} style={{ flex: 1 }} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateKey()} />
              <button className="btn btn-primary" onClick={handleCreateKey}>{t('common.create')}</button>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
            </div>
          )}

          {newKey && (
            <div className="animate-fade-in" style={{ padding: 16, background: 'var(--color-warning-light)', borderRadius: 'var(--border-radius-sm)', marginBottom: 16 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-warning)', marginBottom: 8 }}>⚠️ {t('settings.copyWarning')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 6, fontSize: '0.8rem', wordBreak: 'break-all' }}>{newKey}</code>
                <button className="btn btn-secondary btn-sm" onClick={handleCopy}>📋 نسخ</button>
              </div>
            </div>
          )}

          {apiKeys.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>{t('common.noData')}</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>{t('settings.keyName')}</th><th>Prefix</th><th>{t('instances.status')}</th><th>{t('common.actions')}</th></tr></thead>
                <tbody>
                  {apiKeys.map(key => (
                    <tr key={key.id}>
                      <td style={{ fontWeight: 500 }}>{key.name}</td>
                      <td><code style={{ fontSize: '0.8rem' }}>{key.keyPrefix}...</code></td>
                      <td><span className={`badge ${key.isActive ? 'badge-success' : 'badge-danger'}`}>{key.isActive ? 'نشط' : 'معطّل'}</span></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteKey(key.id)}>{t('common.delete')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>👤 الملف الشخصي</h2>
          <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>الاسم</label>
              <input className="input" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>البريد الإلكتروني</label>
              <input className="input" value={profile.email} disabled style={{ opacity: 0.6 }} />
            </div>
            <button className="btn btn-primary" onClick={handleUpdateProfile} style={{ width: 'fit-content' }}>💾 حفظ التغييرات</button>
          </div>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>🔒 تغيير كلمة المرور</h2>
          <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>كلمة المرور الحالية</label>
              <input className="input" type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>كلمة المرور الجديدة</label>
              <input className="input" type="password" value={passwords.newPass} onChange={e => setPasswords({...passwords, newPass: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>تأكيد كلمة المرور</label>
              <input className="input" type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
            </div>
            <button className="btn btn-primary" onClick={handleChangePassword} style={{ width: 'fit-content' }}>🔒 تغيير كلمة المرور</button>
          </div>
        </div>
      )}
      {ConfirmUI}
    </div>
  );
}
