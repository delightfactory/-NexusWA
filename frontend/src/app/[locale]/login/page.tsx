'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import styles from '@/styles/components.module.css';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login({ email, password });
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
          <h1>{t('auth.loginTitle')}</h1>
          <p>{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className={styles.authForm}>
          {error && <div className={styles.authError}>{error}</div>}

          <div className="input-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required autoFocus />
          </div>

          <div className="input-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>{t('auth.noAccount')} <a href="/register">{t('auth.register')}</a></p>
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
