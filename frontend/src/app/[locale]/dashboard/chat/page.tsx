'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newChatNumber, setNewChatNumber] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadInstances(); }, []);
  useEffect(() => { if (selectedInstance) loadConversations(); }, [selectedInstance]);
  useEffect(() => { if (selectedChat) loadMessages(); }, [selectedChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // polling كل 5 ثواني
  useEffect(() => {
    if (!selectedChat || !selectedInstance) return;
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedChat, selectedInstance]);

  const loadInstances = async () => {
    try { const res = await api.listInstances(); setInstances(res.data || []); }
    catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const loadConversations = async () => {
    try {
      const res = await api.listMessages({ instanceId: selectedInstance, limit: 200 } as any);
      const msgs = res.data || [];
      // تجميع حسب الرقم
      const grouped: Record<string, { phone: string; lastMessage: any; count: number }> = {};
      for (const m of msgs) {
        const phone = m.recipient;
        if (!grouped[phone]) {
          grouped[phone] = { phone, lastMessage: m, count: 0 };
        }
        grouped[phone].count++;
        if (new Date(m.createdAt) > new Date(grouped[phone].lastMessage.createdAt)) {
          grouped[phone].lastMessage = m;
        }
      }
      setConversations(Object.values(grouped).sort((a, b) =>
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      ));
    } catch {}
  };

  const loadMessages = async () => {
    if (!selectedChat || !selectedInstance) return;
    try {
      const res = await api.listMessages({ instanceId: selectedInstance, limit: 100 } as any);
      const all = res.data || [];
      const filtered = all.filter((m: any) => m.recipient === selectedChat);
      setMessages(filtered.sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
    } catch {}
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedInstance || !selectedChat) return;
    try {
      await api.sendMessage({
        instanceId: selectedInstance,
        to: selectedChat,
        type: 'text',
        content: { body: newMessage },
      });
      setNewMessage('');
      setTimeout(loadMessages, 1000);
    } catch (e: any) { toast.error(e.message); }
  };

  const startNewChat = () => {
    if (!newChatNumber.trim()) return;
    let phone = newChatNumber.replace(/[^\d]/g, '');
    if (phone.startsWith('0')) phone = '20' + phone.substring(1);
    setSelectedChat(phone);
    setNewChatNumber('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 120px)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Sidebar — المحادثات */}
      <div style={{ borderInlineEnd: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <select className="input" value={selectedInstance} onChange={e => { setSelectedInstance(e.target.value); setSelectedChat(''); }}
            style={{ marginBottom: 8, fontSize: 13 }}>
            <option value="">اختر رقم واتساب...</option>
            {instances.filter((i: any) => i.status === 'CONNECTED').map((i: any) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <input className="input" placeholder="🔍 بحث بالرقم..." value={chatSearch}
            onChange={e => setChatSearch(e.target.value)} style={{ marginBottom: 8, fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <input className="input" placeholder="رقم جديد..." value={newChatNumber}
              onChange={e => setNewChatNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startNewChat()}
              style={{ fontSize: 12 }} />
            <button className="btn btn-primary btn-sm" onClick={startNewChat} style={{ fontSize: 12 }}>💬</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {!selectedInstance ? (
            <p style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>اختر رقم واتساب أولاً</p>
          ) : conversations.filter(c => !chatSearch || c.phone.includes(chatSearch)).length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>لا توجد محادثات</p>
          ) : conversations.filter(c => !chatSearch || c.phone.includes(chatSearch)).map((c: any) => (
            <div key={c.phone} onClick={() => setSelectedChat(c.phone)} style={{
              padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: selectedChat === c.phone ? 'var(--bg-subtle)' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 13, direction: 'ltr', display: 'inline' }}>{c.phone}</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>{new Date(c.lastMessage.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p style={{ fontSize: 12, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.lastMessage.direction === 'OUTBOUND' ? '← ' : '→ '}
                {(c.lastMessage.content as any)?.body || `[${c.lastMessage.messageType}]`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main — الرسائل */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {!selectedChat ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
            <span style={{ fontSize: 64, marginBottom: 12 }}>💬</span>
            <p>اختر محادثة أو ابدأ محادثة جديدة</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f122', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, direction: 'ltr', display: 'inline' }}>{selectedChat}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-subtle)' }}>
              {messages.map((m: any, i: number) => (
                <div key={m.id || i} style={{
                  maxWidth: '70%',
                  alignSelf: m.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start',
                  padding: '8px 14px',
                  borderRadius: m.direction === 'OUTBOUND' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.direction === 'OUTBOUND' ? '#6366f1' : 'var(--bg-card)',
                  color: m.direction === 'OUTBOUND' ? '#fff' : 'inherit',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}>
                  <p style={{ fontSize: 14, marginBottom: 4, wordBreak: 'break-word' }}>
                    {(m.content as any)?.body || `[${m.messageType}]`}
                  </p>
                  <p style={{ fontSize: 10, opacity: 0.6, textAlign: 'end' }}>
                    {new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    {m.direction === 'OUTBOUND' && (
                      <span style={{ marginInlineStart: 4 }}>
                        {m.status === 'SENT' ? '✓' : m.status === 'DELIVERED' ? '✓✓' : m.status === 'FAILED' ? '✗' : '⏳'}
                      </span>
                    )}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input className="input" placeholder="اكتب رسالة..." value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={handleSend} disabled={!newMessage.trim()}>📤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
