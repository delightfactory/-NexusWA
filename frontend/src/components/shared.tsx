'use client';

import { useState, useCallback, createContext, useContext } from 'react';

// ============================================
// LoadingSpinner — تحميل موحّد
// ============================================
export function LoadingSpinner({ size = 40, text }: { size?: number; text?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
      <div style={{
        width: size, height: size, border: '3px solid var(--border-color, #e2e8f0)',
        borderTop: '3px solid var(--color-primary, #6366f1)',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      {text && <p style={{ fontSize: 13, opacity: 0.6 }}>{text}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================
// EmptyState — حالة فارغة موحّدة
// ============================================
export function EmptyState({ icon = '📭', title = 'لا توجد بيانات', description, action }: {
  icon?: string; title?: string; description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>{title}</h3>
      {description && <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 16 }}>{description}</p>}
      {action && <button className="btn btn-primary btn-sm" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

// ============================================
// ConfirmDialog — تأكيد حذف موحّد (مكون)
// ============================================
export function ConfirmDialog({ open, title = 'تأكيد', message, onConfirm, onCancel, danger = false }: {
  open: boolean; title?: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.15s ease',
    }} onClick={onCancel}>
      <div className="card" style={{
        padding: 24, maxWidth: 420, width: '90%',
        animation: 'fadeIn 0.2s ease',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, background: danger ? 'var(--color-danger-light)' : 'var(--color-primary-light)',
          }}>
            {danger ? '⚠️' : 'ℹ️'}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
        </div>
        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>إلغاء</button>
          <button className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {danger ? '🗑️ حذف' : '✅ تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// useConfirm — Hook سهل الاستخدام
// ============================================
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean; title: string; message: string; danger: boolean;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, title: '', message: '', danger: false, resolve: null });

  const confirm = useCallback((message: string, options?: { title?: string; danger?: boolean }): Promise<boolean> => {
    return new Promise(resolve => {
      setState({
        open: true,
        message,
        title: options?.title || 'تأكيد',
        danger: options?.danger ?? true,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false }));
  }, [state.resolve]);

  const ConfirmUI = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      danger={state.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmUI };
}

// ============================================
// StatusBadge — شارة موحّدة
// ============================================
export function StatusBadge({ status, label }: { status: 'success' | 'warning' | 'danger' | 'info'; label: string }) {
  return <span className={`badge badge-${status}`}>{label}</span>;
}

// ============================================
// SearchInput — بحث موحّد
// ============================================
export function SearchInput({ value, onChange, onSearch, placeholder = '🔍 بحث...' }: {
  value: string; onChange: (v: string) => void; onSearch: () => void; placeholder?: string;
}) {
  return (
    <input className="input" placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onSearch()}
      style={{ maxWidth: 300 }} />
  );
}

// ============================================
// MessageContent — عرض محتوى الرسالة حسب النوع
// ============================================
export function MessageContent({ type, content }: { type: string; content: any }) {
  const body = content?.body || content?.caption || '';
  const icons: Record<string, string> = {
    TEXT: '💬', IMAGE: '📷', VIDEO: '🎥', AUDIO: '🎵',
    DOCUMENT: '📄', LOCATION: '📍', CONTACT: '👤',
    STICKER: '🎭', BUTTONS: '🔘', LIST: '📋',
  };
  const icon = icons[type] || '📨';

  if (type === 'TEXT') return <span>{body}</span>;
  if (type === 'LOCATION') return <span>{icon} موقع جغرافي {content?.latitude ? `(${content.latitude}, ${content.longitude})` : ''}</span>;
  if (type === 'BUTTONS') return <span>{icon} رسالة أزرار: {body}</span>;
  if (type === 'LIST') return <span>{icon} قائمة: {body}</span>;
  return <span>{icon} {['IMAGE','VIDEO','AUDIO','DOCUMENT','STICKER'].includes(type) ? ({ IMAGE: 'صورة', VIDEO: 'فيديو', AUDIO: 'صوت', DOCUMENT: 'مستند', STICKER: 'ملصق' }[type] || type) : type} {body ? `— ${body.substring(0, 50)}` : ''}</span>;
}
