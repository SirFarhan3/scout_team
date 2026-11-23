import { AllowedRole } from '@/lib/sanitize';
import { apiFetch, clearJwtToken, getJwtToken, setJwtToken } from '@/lib/apiClient';
import type { SchoolDTO, SchoolUsageStats, SubscriptionPlanCode } from '@/types/school';

export interface UserSessionData {
  id: string;
  username: string;
  full_name: string;
  role: AllowedRole;
  school_id: string | null;
  school?: SchoolDTO | null;
  usage?: SchoolUsageStats | null;
}

export interface RegisterSchoolInput {
  schoolName: string;
  city: string;
  gugusdepan?: string;
  npsn?: string;
  contactPhone?: string;
  fullName: string;
  username: string;
  password: string;
  plan?: SubscriptionPlanCode;
  billingCycle?: 'monthly' | 'yearly';
}

let cachedUser: UserSessionData | null = null;

export const authService = {
  getCachedUser(): UserSessionData | null {
    return cachedUser;
  },

  async login(username: string, pass: string): Promise<UserSessionData> {
    cachedUser = null;
    clearJwtToken();
    const res = await apiFetch<{ success: true; token?: string; user: UserSessionData }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password: pass }),
      }
    );
    if (res.token) {
      setJwtToken(res.token);
    }
    cachedUser = res.user;
    return res.user;
  },

  async registerSchool(input: RegisterSchoolInput): Promise<{
    user: UserSessionData;
    invoice?: Record<string, unknown> | null;
  }> {
    cachedUser = null;
    clearJwtToken();
    const res = await apiFetch<{
      success: true;
      token?: string;
      user: UserSessionData;
      invoice?: Record<string, unknown> | null;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res.token) {
      setJwtToken(res.token);
    }
    cachedUser = res.user;
    return { user: res.user, invoice: res.invoice };
  },

  async logout(): Promise<void> {
    cachedUser = null;
    const token = getJwtToken();
    clearJwtToken();
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
    }).catch(() => {});
  },

  async getCurrentUser(): Promise<UserSessionData | null> {
    if (typeof window === 'undefined') return null;
    try {
      localStorage.removeItem('scout_session');
      const token = getJwtToken();
      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
      });
      if (!res.ok) {
        if (res.status === 401) {
          cachedUser = null;
          clearJwtToken();
        }
        return null;
      }
      const data = await res.json();
      if (!data?.success || !data?.user) return null;
      if (data.token && typeof data.token === 'string') {
        setJwtToken(data.token);
      }
      cachedUser = data.user as UserSessionData;
      return cachedUser;
    } catch {
      return null;
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const res = await apiFetch<{ success: true; token?: string; message: string }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }
    );
    if (res.token) {
      setJwtToken(res.token);
    }
    return res.message;
  },
};
