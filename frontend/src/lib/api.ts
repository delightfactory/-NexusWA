// ===========================================
// NexusWA — API Client
// ===========================================

const API_BASE = typeof window !== 'undefined' ? 'http://localhost:3000/api/v1' : '/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('nexuswa_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexuswa_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nexuswa_token');
    }
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // محاولة قراءة الرد كـ JSON
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // الرد مش JSON
        if (!res.ok) {
          throw new Error(`خطأ ${res.status}: ${text.substring(0, 100)}`);
        }
        data = { success: true, data: text };
      }

      if (!res.ok) {
        throw new Error(data.error?.message || data.message || `خطأ ${res.status}`);
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('انتهت مهلة الطلب. حاول مرة أخرى.');
      }
      throw error;
    }
  }

  // المصادقة
  async register(body: { companyName: string; email: string; password: string; name: string }) {
    const res = await this.request<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    if (res.data?.token) this.setToken(res.data.token);
    return res;
  }

  async login(body: { email: string; password: string }) {
    const res = await this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    if (res.data?.token) this.setToken(res.data.token);
    return res;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // مفاتيح API
  async createApiKey(name: string) {
    return this.request<any>('/auth/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async listApiKeys() {
    return this.request<any[]>('/auth/api-keys');
  }

  async deleteApiKey(id: string) {
    return this.request<void>(`/auth/api-keys/${id}`, { method: 'DELETE' });
  }

  // أرقام واتساب
  async createInstance(name: string) {
    return this.request<any>('/instances', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async listInstances() {
    return this.request<any[]>('/instances');
  }

  async getInstance(id: string) {
    return this.request<any>(`/instances/${id}`);
  }

  async connectInstance(id: string) {
    return this.request<any>(`/instances/${id}/connect`, { method: 'POST', body: '{}' });
  }

  async getQrCode(id: string) {
    return this.request<any>(`/instances/${id}/qr`);
  }

  async disconnectInstance(id: string) {
    return this.request<any>(`/instances/${id}/disconnect`, { method: 'POST', body: '{}' });
  }

  async deleteInstance(id: string) {
    return this.request<void>(`/instances/${id}`, { method: 'DELETE' });
  }

  // الرسائل
  async sendMessage(body: any) {
    return this.request<any>('/messages/send', { method: 'POST', body: JSON.stringify(body) });
  }

  async listMessages(params?: { page?: number; instanceId?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/messages${query ? '?' + query : ''}`);
  }

  // Webhooks
  async createWebhook(body: any) {
    return this.request<any>('/webhooks', { method: 'POST', body: JSON.stringify(body) });
  }

  async listWebhooks() {
    return this.request<any[]>('/webhooks');
  }

  async deleteWebhook(id: string) {
    return this.request<void>(`/webhooks/${id}`, { method: 'DELETE' });
  }

  // جهات الاتصال
  async listContacts(params?: { page?: number; search?: string; labelId?: string }) {
    // تصفية params فارغة
    const clean: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') clean[k] = String(v);
      });
    }
    const query = new URLSearchParams(clean).toString();
    return this.request<any[]>(`/contacts${query ? '?' + query : ''}`);
  }

  async createContact(body: any) {
    // تصفية الحقول الفارغة
    const clean: Record<string, any> = {};
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    });
    return this.request<any>('/contacts', { method: 'POST', body: JSON.stringify(clean) });
  }

  async updateContact(id: string, body: any) {
    return this.request<any>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async deleteContact(id: string) {
    return this.request<void>(`/contacts/${id}`, { method: 'DELETE' });
  }

  async importContacts(contacts: any[]) {
    return this.request<any>('/contacts/import', { method: 'POST', body: JSON.stringify({ contacts }) });
  }

  // التصنيفات
  async listLabels() {
    return this.request<any[]>('/contacts/labels');
  }

  async createLabel(body: any) {
    return this.request<any>('/contacts/labels', { method: 'POST', body: JSON.stringify(body) });
  }

  async deleteLabel(id: string) {
    return this.request<void>(`/contacts/labels/${id}`, { method: 'DELETE' });
  }

  // القوالب
  async listTemplates() {
    return this.request<any[]>('/templates');
  }

  async createTemplate(body: any) {
    return this.request<any>('/templates', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateTemplate(id: string, body: any) {
    return this.request<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async deleteTemplate(id: string) {
    return this.request<void>(`/templates/${id}`, { method: 'DELETE' });
  }

  async previewTemplate(content: string, variables: Record<string, string>) {
    return this.request<any>('/templates/preview', { method: 'POST', body: JSON.stringify({ content, variables }) });
  }

  // الرد التلقائي
  async listAutoReplies() {
    return this.request<any[]>('/auto-reply');
  }

  async createAutoReply(body: any) {
    return this.request<any>('/auto-reply', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateAutoReply(id: string, body: any) {
    return this.request<any>(`/auto-reply/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  async deleteAutoReply(id: string) {
    return this.request<void>(`/auto-reply/${id}`, { method: 'DELETE' });
  }

  async toggleAutoReply(id: string) {
    return this.request<any>(`/auto-reply/${id}/toggle`, { method: 'PATCH', body: '{}' });
  }

  // حماية الأرقام
  async getProtectionSummary() {
    return this.request<any[]>('/instances/protection/summary');
  }

  async getInstanceProtection(id: string) {
    return this.request<any>(`/instances/${id}/protection`);
  }

  // الحملات
  async listCampaigns() {
    return this.request<any[]>('/campaigns');
  }

  async createCampaign(body: any) {
    return this.request<any>('/campaigns', { method: 'POST', body: JSON.stringify(body) });
  }

  async startCampaign(id: string) {
    return this.request<any>(`/campaigns/${id}/start`, { method: 'POST', body: '{}' });
  }

  async pauseCampaign(id: string) {
    return this.request<any>(`/campaigns/${id}/pause`, { method: 'POST', body: '{}' });
  }

  async deleteCampaign(id: string) {
    return this.request<void>(`/campaigns/${id}`, { method: 'DELETE' });
  }

  async getCampaign(id: string) {
    return this.request<any>(`/campaigns/${id}`);
  }

  // التقارير
  async getAnalytics(params?: { period?: string }) {
    const clean: Record<string, string> = {};
    if (params?.period) clean.period = params.period;
    const query = new URLSearchParams(clean).toString();
    return this.request<any>(`/analytics${query ? '?' + query : ''}`);
  }

  // الرسائل المجدولة
  async listScheduled() {
    return this.request<any[]>('/scheduled');
  }

  async createScheduled(body: any) {
    return this.request<any>('/scheduled', { method: 'POST', body: JSON.stringify(body) });
  }

  async cancelScheduled(id: string) {
    return this.request<void>(`/scheduled/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

