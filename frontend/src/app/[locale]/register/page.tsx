'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import styles from '@/styles/components.module.css';

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(form);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={`${styles.authCard} animate-fade-in`}>
        <div className={styles.authHeader}>
          <div className={styles.authLogo}>
            <span className={styles.logoIcon}>⚡</span>
            <span className={styles.logoText}>NexusWA</span>
          </div>
          <h1>{t('auth.registerTitle')}</h1>
          <p>{t('auth.registerSubtitle')}</p>
        </div>

        <form onSubmit={handleRegister} className={styles.authForm}>
          {error && <div className={styles.authError}>{error}</div>}

          <div className="input-group">
            <label htmlFor="companyName">{t('auth.companyName')}</label>
            <input id="companyName" name="companyName" className="input" value={form.companyName} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="name">{t('auth.name')}</label>
            <input id="name" name="name" className="input" value={form.name} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input id="email" name="email" type="email" className="input" value={form.email} onChange={handleChange} placeholder="name@company.com" required />
          </div>
          <div className="input-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input id="password" name="password" type="password" className="input" value={form.password} onChange={handleChange} placeholder="••••••••" required minLength={8} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? t('common.loading') : t('auth.register')}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>{t('auth.hasAccount')} <a href="/login">{t('auth.login')}</a></p>
        </div>
      </div>

      <div className={styles.authBg}>
        <div className={styles.authBgContent}>
          <h2>NexusWA</h2>
          <p>{t('app.description')}</p>
          <div className={styles.authFeatures}>
            <div className={styles.authFeature}>📱 {t('instances.title')}</div>
            <div className={styles.authFeature}>📨 {t('messages.title')}</div>
            <div className={styles.authFeature}>🔔 {t('webhooks.title')}</div>
            <div className={styles.authFeature}>📊 {t('dashboard.title')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
