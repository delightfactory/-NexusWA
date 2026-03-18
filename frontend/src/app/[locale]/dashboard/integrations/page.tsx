'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/shared';

export default function IntegrationsPage() {
  const [tab, setTab] = useState<'api' | 'webhooks' | 'code'>('api');
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', events: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [apiToken, setApiToken] = useState('');
  const { confirm, ConfirmUI } = useConfirm();

  const allEvents = [
    { key: 'message.received', label: 'رسالة واردة' },
    { key: 'message.sent', label: 'رسالة مُرسلة' },
    { key: 'message.delivered', label: 'رسالة مُسلّمة' },
    { key: 'message.failed', label: 'رسالة فاشلة' },
    { key: 'instance.connected', label: 'رقم متصل' },
    { key: 'instance.disconnected', label: 'رقم منقطع' },
    { key: 'contact.created', label: 'جهة اتصال جديدة' },
    { key: 'campaign.started', label: 'حملة بدأت' },
    { key: 'campaign.completed', label: 'حملة اكتملت' },
  ];

  useEffect(() => {
    loadData();
    if (typeof window !== 'undefined') {
      setApiToken(localStorage.getItem('nexuswa_token') || '');
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [w, i] = await Promise.all([api.listWebhooks(), api.listInstances()]);
      setWebhooks(w.data || []);
      setInstances(i.data || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handleAddWebhook = async () => {
    try {
      const res = await api.createWebhook(webhookForm);
      toast.success(`تم إنشاء Webhook\nSecret: ${res.data.secret}\n⚠️ احفظه الآن!`, { duration: 10000 });
      setShowAddWebhook(false);
      setWebhookForm({ name: '', url: '', events: [] });
      loadData();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteWebhook = async (id: string) => {
    const ok = await confirm('حذف هذا الـ Webhook؟ لن يمكنك التراجع.', { title: 'حذف Webhook', danger: true });
    if (!ok) return;
    try { await api.deleteWebhook(id); toast.success('تم الحذف'); loadData(); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggleEvent = (event: string) => {
    setWebhookForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : 'http://localhost:3000';
  const instanceId = instances[0]?.id || 'INSTANCE_ID';

  const codeExamples = {
    curl: `# إرسال رسالة نصية
curl -X POST "${baseUrl}/api/v1/messages/send" \\
  -H "Authorization: Bearer ${apiToken || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "instanceId": "${instanceId}",
    "to": "201234567890",
    "type": "text",
    "content": { "body": "مرحباً من NexusWA! 🚀" }
  }'

# قائمة جهات الاتصال
curl "${baseUrl}/api/v1/contacts" \\
  -H "Authorization: Bearer ${apiToken || 'YOUR_API_KEY'}"

# إضافة جهة اتصال
curl -X POST "${baseUrl}/api/v1/contacts" \\
  -H "Authorization: Bearer ${apiToken || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{ "phone": "201234567890", "name": "أحمد" }'`,

    javascript: `// npm install axios
const axios = require('axios');

const nexuswa = axios.create({
  baseURL: '${baseUrl}/api/v1',
  headers: { 'Authorization': 'Bearer ${apiToken || 'YOUR_API_KEY'}' },
});

// إرسال رسالة
async function sendMessage(to, text) {
  const { data } = await nexuswa.post('/messages/send', {
    instanceId: '${instanceId}',
    to,
    type: 'text',
    content: { body: text },
  });
  console.log('تم الإرسال:', data);
  return data;
}

// استقبال Webhook
const express = require('express');
const crypto = require('crypto');
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  // التحقق من التوقيع
  const signature = req.headers['x-nexuswa-signature'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', 'YOUR_WEBHOOK_SECRET')
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expected) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;
  console.log(\`حدث: \${event}\`, data);

  // معالجة الأحداث
  switch (event) {
    case 'message.received':
      console.log(\`رسالة من: \${data.from}\`);
      break;
    case 'message.sent':
      console.log(\`تم الإرسال: \${data.messageId}\`);
      break;
  }

  res.sendStatus(200);
});

app.listen(4000, () => console.log('Webhook server on :4000'));`,

    python: `import requests
import hmac, hashlib
from flask import Flask, request, jsonify

API_BASE = '${baseUrl}/api/v1'
API_KEY = '${apiToken || 'YOUR_API_KEY'}'
HEADERS = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}

# إرسال رسالة
def send_message(to: str, text: str):
    response = requests.post(f'{API_BASE}/messages/send', json={
        'instanceId': '${instanceId}',
        'to': to,
        'type': 'text',
        'content': {'body': text},
    }, headers=HEADERS)
    return response.json()

# إضافة جهة اتصال
def create_contact(phone: str, name: str):
    return requests.post(f'{API_BASE}/contacts', json={
        'phone': phone, 'name': name,
    }, headers=HEADERS).json()

# قائمة جهات الاتصال
def list_contacts():
    return requests.get(f'{API_BASE}/contacts', headers=HEADERS).json()

# === Webhook Server ===
app = Flask(__name__)
WEBHOOK_SECRET = 'YOUR_WEBHOOK_SECRET'

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-NexusWA-Signature', '')
    expected = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(), request.data, hashlib.sha256
    ).hexdigest()

    if signature != expected:
        return 'Invalid signature', 401

    payload = request.json
    event = payload['event']
    data = payload['data']

    if event == 'message.received':
        print(f"رسالة من: {data['from']}")
        # الرد التلقائي عبر النظام الخارجي
        send_message(data['from'], 'شكراً لتواصلك!')

    return '', 200

if __name__ == '__main__':
    app.run(port=4000)`,

    php: `<?php
// NexusWA PHP Integration

\$apiBase = '${baseUrl}/api/v1';
\$apiKey = '${apiToken || 'YOUR_API_KEY'}';

// إرسال رسالة
function sendMessage(\$to, \$text) {
    global \$apiBase, \$apiKey;

    \$ch = curl_init("\$apiBase/messages/send");
    curl_setopt_array(\$ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer \$apiKey",
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'instanceId' => '${instanceId}',
            'to' => \$to,
            'type' => 'text',
            'content' => ['body' => \$text],
        ]),
    ]);

    \$response = curl_exec(\$ch);
    curl_close(\$ch);
    return json_decode(\$response, true);
}

// Webhook Handler
\$payload = file_get_contents('php://input');
\$signature = \$_SERVER['HTTP_X_NEXUSWA_SIGNATURE'] ?? '';
\$secret = 'YOUR_WEBHOOK_SECRET';
\$expected = 'sha256=' . hash_hmac('sha256', \$payload, \$secret);

if (\$signature !== \$expected) {
    http_response_code(401);
    exit('Invalid signature');
}

\$data = json_decode(\$payload, true);
\$event = \$data['event'];

switch (\$event) {
    case 'message.received':
        error_log("رسالة من: " . \$data['data']['from']);
        sendMessage(\$data['data']['from'], 'شكراً لتواصلك!');
        break;
}

http_response_code(200);
?>`,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>🔗 التكامل والربط</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
        {[
          { key: 'api' as const, label: '🔑 مفاتيح API', icon: '' },
          { key: 'webhooks' as const, label: '📡 Webhooks', icon: '' },
          { key: 'code' as const, label: '💻 أكواد جاهزة', icon: '' },
        ].map(t => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* Tab: API Keys */}
      {tab === 'api' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>🔑 كيفية المصادقة</h3>
            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              NexusWA يدعم نوعين من المصادقة: <strong>JWT Token</strong> (للوحة التحكم) و <strong>API Key</strong> (للأنظمة الخارجية).
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ padding: 16, background: '#6366f111', borderRadius: 12, border: '1px solid #6366f133' }}>
                <h4 style={{ color: '#6366f1', marginBottom: 8 }}>API Key (للأنظمة الخارجية)</h4>
                <p style={{ fontSize: 13, marginBottom: 8 }}>المفاتيح تبدأ بـ <code>nwa_</code> وتُرسل في Header:</p>
                <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: 13, overflow: 'auto' }}>
{`Authorization: Bearer nwa_xxx...`}
                </pre>
              </div>

              <div style={{ padding: 16, background: '#22c55e11', borderRadius: 12, border: '1px solid #22c55e33' }}>
                <h4 style={{ color: '#22c55e', marginBottom: 8 }}>JWT Token (للوحة التحكم)</h4>
                <p style={{ fontSize: 13, marginBottom: 8 }}>يُحصل عليه من <code>/api/v1/auth/login</code>:</p>
                <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: 13, overflow: 'auto' }}>
{`Authorization: Bearer eyJhbG...`}
                </pre>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 12 }}>📚 API Endpoints المتاحة</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'start' }}>Method</th>
                  <th style={{ padding: '8px 12px', textAlign: 'start' }}>Endpoint</th>
                  <th style={{ padding: '8px 12px', textAlign: 'start' }}>الوصف</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['POST', '/messages/send', 'إرسال رسالة واحدة'],
                  ['POST', '/messages/send-bulk', 'إرسال رسائل جماعية'],
                  ['GET', '/messages', 'سجل الرسائل'],
                  ['GET', '/messages/:id/status', 'حالة رسالة'],
                  ['GET', '/contacts', 'قائمة جهات الاتصال'],
                  ['POST', '/contacts', 'إضافة جهة اتصال'],
                  ['PUT', '/contacts/:id', 'تعديل جهة اتصال'],
                  ['DELETE', '/contacts/:id', 'حذف جهة اتصال'],
                  ['POST', '/contacts/import', 'استيراد CSV'],
                  ['GET', '/instances', 'قائمة الأرقام'],
                  ['POST', '/instances', 'إضافة رقم جديد'],
                  ['GET', '/templates', 'قائمة القوالب'],
                  ['POST', '/templates', 'إنشاء قالب'],
                  ['GET', '/campaigns', 'قائمة الحملات'],
                  ['POST', '/campaigns', 'إنشاء حملة'],
                  ['POST', '/campaigns/:id/start', 'تشغيل حملة'],
                  ['GET', '/webhooks', 'قائمة Webhooks'],
                  ['POST', '/webhooks', 'إنشاء Webhook'],
                  ['GET', '/analytics', 'التقارير والإحصائيات'],
                ].map(([method, path, desc], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                        background: method === 'GET' ? '#22c55e22' : method === 'POST' ? '#3b82f622' : method === 'PUT' ? '#eab30822' : '#ef444422',
                        color: method === 'GET' ? '#22c55e' : method === 'POST' ? '#3b82f6' : method === 'PUT' ? '#eab308' : '#ef4444',
                      }}>{method}</span>
                    </td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 12 }}>/api/v1{path}</td>
                    <td style={{ padding: '6px 12px' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 13 }}>
              📖 للتوثيق التفاعلي: <a href={`${baseUrl}/docs`} target="_blank" style={{ color: '#6366f1' }}>{baseUrl}/docs</a>
            </p>
          </div>
        </div>
      )}

      {/* Tab: Webhooks */}
      {tab === 'webhooks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddWebhook(!showAddWebhook)}>+ Webhook جديد</button>
          </div>

          {showAddWebhook && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>📡 Webhook جديد</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <input className="input" placeholder="الاسم (مثال: نظام CRM)" value={webhookForm.name}
                  onChange={e => setWebhookForm({ ...webhookForm, name: e.target.value })} />
                <input className="input" placeholder="https://your-system.com/webhook" value={webhookForm.url}
                  onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>اختر الأحداث:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {allEvents.map(ev => (
                  <button key={ev.key} className={`btn btn-sm ${webhookForm.events.includes(ev.key) ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => toggleEvent(ev.key)}>{ev.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAddWebhook} disabled={!webhookForm.name || !webhookForm.url || !webhookForm.events.length}>إنشاء</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddWebhook(false)}>إلغاء</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>جاري التحميل...</div>
            ) : webhooks.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
                <p style={{ fontSize: 48, marginBottom: 8 }}>📡</p>
                <p>لا توجد Webhooks. أنشئ واحداً لربط نظامك!</p>
              </div>
            ) : webhooks.map((w: any) => (
              <div key={w.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <h4 style={{ fontWeight: 600 }}>{w.name}</h4>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11,
                        background: w.isActive ? '#22c55e22' : '#ef444422',
                        color: w.isActive ? '#22c55e' : '#ef4444',
                      }}>{w.isActive ? 'نشط' : 'معطّل'}</span>
                    </div>
                    <p style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.6 }}>{w.url}</p>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {w.events.map((e: string) => (
                        <span key={e} style={{ padding: '2px 6px', background: '#6366f122', color: '#6366f1', borderRadius: 6, fontSize: 10 }}>{e}</span>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteWebhook(w.id)} style={{ color: '#ef4444' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Code Examples */}
      {tab === 'code' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {[
            { lang: 'curl', label: '🔧 cURL', code: codeExamples.curl },
            { lang: 'javascript', label: '🟡 JavaScript / Node.js', code: codeExamples.javascript },
            { lang: 'python', label: '🐍 Python', code: codeExamples.python },
            { lang: 'php', label: '🐘 PHP', code: codeExamples.php },
          ].map(ex => (
            <div key={ex.lang} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>{ex.label}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  navigator.clipboard.writeText(ex.code);
                  toast.success('تم نسخ الكود');
                }}>📋 نسخ</button>
              </div>
              <pre style={{
                background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 12,
                fontSize: 12, lineHeight: 1.6, overflow: 'auto', maxHeight: 400,
                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              }}>{ex.code}</pre>
            </div>
          ))}
        </div>
      )}
      {ConfirmUI}
    </div>
  );
}
