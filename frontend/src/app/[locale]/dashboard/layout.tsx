'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import styles from '@/styles/components.module.css';

const navItems = [
  { key: 'dashboard', path: '/dashboard', icon: '📊' },
  { key: 'instances', path: '/dashboard/instances', icon: '📱' },
  { key: 'messages', path: '/dashboard/messages', icon: '📨' },
  { key: 'contacts', path: '/dashboard/contacts', icon: '👥' },
  { key: 'templates', path: '/dashboard/templates', icon: '📝' },
  { key: 'campaigns', path: '/dashboard/campaigns', icon: '📢' },
  { key: 'autoReply', path: '/dashboard/auto-reply', icon: '🤖' },
  { key: 'scheduled', path: '/dashboard/scheduled', icon: '⏰' },
  { key: 'chat', path: '/dashboard/chat', icon: '💬' },
  { key: 'protection', path: '/dashboard/protection', icon: '🛡️' },
  { key: 'analytics', path: '/dashboard/analytics', icon: '📈' },
  { key: 'integrations', path: '/dashboard/integrations', icon: '🔗' },
  { key: 'settings', path: '/dashboard/settings', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nexuswa_token');
    if (!token) { router.push('/login'); return; }
    api.getMe().then(res => setUser(res.data)).catch(() => {
      localStorage.removeItem('nexuswa_token');
      router.push('/login');
    });
  }, [router]);

  const handleLogout = () => { api.clearToken(); router.push('/login'); };

  const isActive = (path: string) => {
    const clean = pathname.replace(/^\/(ar|en)/, '');
    if (path === '/dashboard') return clean === '/dashboard';
    return clean.startsWith(path);
  };

  return (
    <div className={styles.dashboardLayout}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogo}>⚡ NexusWA</span>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map(item => (
            <a
              key={item.key}
              href={item.path}
              className={`${styles.sidebarLink} ${isActive(item.path) ? styles.sidebarLinkActive : ''}`}
              onClick={(e) => { e.preventDefault(); router.push(item.path); setSidebarOpen(false); }}
            >
              <span className={styles.sidebarLinkIcon}>{item.icon}</span>
              <span>{t(`nav.${item.key}`)}</span>
            </a>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {user && (
            <div className={styles.sidebarUser}>
              <div className={styles.sidebarUserAvatar}>{user?.name?.[0] || '?'}</div>
              <div>
                <div className={styles.sidebarUserName}>{user?.name}</div>
                <div className={styles.sidebarUserRole}>{user?.tenant?.name}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-sidebar)' }}>
            🚪 {t('auth.logout')}
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.topHeader}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className={styles.headerSpacer} />
          <div className={styles.headerActions}>
            <a href="/ar" className="btn btn-ghost btn-sm">عربي</a>
            <a href="/en" className="btn btn-ghost btn-sm">EN</a>
          </div>
        </header>
        <div className={`${styles.pageContent} animate-fade-in`}>
          {children}
        </div>
      </main>

      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
