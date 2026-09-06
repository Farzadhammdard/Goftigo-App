const API_BASE = '/api/admin';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('admin_access', access);
    localStorage.setItem('admin_refresh', refresh);
  }

  loadTokens() {
    this.accessToken = localStorage.getItem('admin_access');
    this.refreshToken = localStorage.getItem('admin_refresh');
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('admin_access');
    localStorage.removeItem('admin_refresh');
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {...options, headers});

    if (!res.ok) {
      let errorData: any = {};
      try { errorData = await res.json(); } catch {}

      if (res.status === 401 && this.refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({refreshToken: this.refreshToken}),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.success) {
            this.setTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
            headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
            const retryRes = await fetch(`${API_BASE}${path}`, {...options, headers});
            if (!retryRes.ok) {
              let retryErr: any = {};
              try { retryErr = await retryRes.json(); } catch {}
              throw new Error(retryErr.error?.message || 'Request failed');
            }
            const retryData = await retryRes.json();
            if (retryData.meta !== undefined) {
              return {data: retryData.data, meta: retryData.meta} as T;
            }
            return retryData.data;
          }
        } catch (e: any) {
          this.clearTokens();
          window.location.href = '/login';
          throw new Error(e.message || 'Session expired');
        }
      }
      throw new Error(errorData.error?.message || `Request failed (${res.status})`);
    }

    const data = await res.json();
    if (data.meta !== undefined) {
      return {data: data.data, meta: data.meta} as T;
    }
    return data.data;
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{admin: any; accessToken: string; refreshToken: string}>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({email, password}),
    });
  }

  getMe() {
    return this.request<any>('/auth/me');
  }

  // Dashboard
  getStats() {
    return this.request<any>('/dashboard/stats');
  }

  getHealth() {
    return this.request<any>('/dashboard/health');
  }

  // Users
  getUsers(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/users${qs}`);
  }

  getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }

  createUser(data: any) {
    return this.request<any>('/users', {method: 'POST', body: JSON.stringify(data)});
  }

  updateUser(id: string, data: any) {
    return this.request<any>(`/users/${id}`, {method: 'PUT', body: JSON.stringify(data)});
  }

  updateUserStatus(id: string, status: string) {
    return this.request<any>(`/users/${id}/status`, {method: 'PUT', body: JSON.stringify({status})});
  }

  deleteUser(id: string) {
    return this.request<any>(`/users/${id}`, {method: 'DELETE'});
  }

  // Groups
  getGroups(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/groups${qs}`);
  }

  getGroup(id: string) {
    return this.request<any>(`/groups/${id}`);
  }

  updateGroup(id: string, data: {name?: string; description?: string}) {
    return this.request<any>(`/groups/${id}`, {method: 'PUT', body: JSON.stringify(data)});
  }

  createGroup(data: any) {
    return this.request<any>('/groups', {method: 'POST', body: JSON.stringify(data)});
  }

  deleteGroup(id: string) {
    return this.request<any>(`/groups/${id}`, {method: 'DELETE'});
  }

  // Posts
  getPosts(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/posts${qs}`);
  }

  updatePostStatus(id: string, status: string) {
    return this.request<any>(`/posts/${id}/status`, {method: 'PUT', body: JSON.stringify({status})});
  }

  // Reports
  getReports(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/reports${qs}`);
  }

  updateReport(id: string, data: any) {
    return this.request<any>(`/reports/${id}`, {method: 'PUT', body: JSON.stringify(data)});
  }

  // System
  getSettings() {
    return this.request<any[]>('/system/settings');
  }

  updateSettings(settings: Record<string, string>) {
    return this.request<any>('/system/settings', {method: 'PUT', body: JSON.stringify({settings})});
  }

  getAuditLog(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/system/audit-log${qs}`);
  }

  getAnnouncements() {
    return this.request<any[]>('/system/announcements');
  }

  createAnnouncement(data: any) {
    return this.request<any>('/system/announcements', {method: 'POST', body: JSON.stringify(data)});
  }

  // Admins
  getAdmins() {
    return this.request<any[]>('/admins');
  }

  createAdmin(data: any) {
    return this.request<any>('/admins', {method: 'POST', body: JSON.stringify(data)});
  }

  // Chat / Conversations
  getConversations(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/chat/conversations${qs}`);
  }

  getConversationMessages(conversationId: string, params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{data: any[]; meta: any}>(`/chat/conversations/${conversationId}/messages${qs}`);
  }

  sendConversationMessage(conversationId: string, content: string) {
    return this.request<any>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({content}),
    });
  }
}

export const api = new ApiClient();
