/**
 * Enterprise Authentication Client
 * In-memory access token storage, silent background refresh, and CSRF header management.
 */

class AuthClient {
  constructor() {
    this.accessToken = null; // Stored in memory only (never localStorage)
    this.csrfToken = null;
    this.currentUser = null;
    this.refreshTimer = null;
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.currentUser));
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    return headers;
  }

  setSession(authData) {
    this.currentUser = authData.user;
    this.accessToken = authData.accessToken;
    this.csrfToken = authData.csrfToken || this.csrfToken;

    // Schedule silent refresh before 15 min expiry (at 13 minutes)
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshToken().catch(() => {});
    }, 13 * 60 * 1000);

    this.notify();
  }

  clearSession() {
    this.currentUser = null;
    this.accessToken = null;
    this.csrfToken = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.notify();
  }

  async checkAuth() {
    try {
      // Attempt silent refresh via HttpOnly cookie
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success && data.data) {
        this.setSession(data.data);
        return this.currentUser;
      }
    } catch (e) {
      // Offline or unauthenticated
    }
    this.clearSession();
    return null;
  }

  async register(email, password, name) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Registration failed');
    }
    this.setSession(result.data);
    return result.data.user;
  }

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Login failed');
    }
    this.setSession(result.data);
    return result.data.user;
  }

  async requestMagicLink(email) {
    const res = await fetch('/api/auth/magic-link/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to request magic link');
    }
    return result.data;
  }

  async verifyMagicLink(token) {
    const res = await fetch('/api/auth/magic-link/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to verify magic link');
    }
    this.setSession(result.data);
    return result.data.user;
  }

  async loginOAuth(provider) {
    const res = await fetch('/api/auth/oauth/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Social login failed');
    }
    this.setSession(result.data);
    return result.data.user;
  }

  async refreshToken() {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (result.success && result.data) {
      this.setSession(result.data);
      return result.data;
    }
    this.clearSession();
    throw new Error('Refresh failed');
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } finally {
      this.clearSession();
    }
  }

  async getActiveSessions() {
    const res = await fetch('/api/sessions', {
      headers: this.getAuthHeaders()
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data.sessions;
  }

  async logoutOtherSessions() {
    const res = await fetch('/api/sessions/logout-others', {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data.message;
  }

  async exportData() {
    const res = await fetch('/api/export', {
      headers: this.getAuthHeaders()
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data;
  }

  async deleteAccount() {
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message);
    this.clearSession();
    return result.data.message;
  }
}

export const authClient = new AuthClient();
