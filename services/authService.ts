import { api, tokenStorage } from './api';
import type { User } from './types';

interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  document: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  farm_name: string;
  password: string;
  password_confirmation: string;
  terms: boolean;
}

export const authService = {
  async login(email: string, password: string, remember: boolean): Promise<User> {
    const res = await api.post<AuthResponse>('/auth/login', { email, password, remember });
    tokenStorage.set(res.token, remember);
    return res.user;
  },

  async register(payload: RegisterPayload): Promise<User> {
    const res = await api.post<AuthResponse>('/auth/register', payload);
    tokenStorage.set(res.token, true);
    return res.user;
  },

  async me(): Promise<User> {
    const res = await api.get<{ data: User }>('/auth/me');
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStorage.clear();
    }
  },

  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),

  changePassword: (payload: { current_password?: string; password: string; password_confirmation: string }) =>
    api.post<{ message: string; data: User }>('/auth/change-password', payload),

  /** O backend redireciona para o Google; a volta chega em /entrar/google#token=… */
  googleLoginUrl: () => '/auth/google/redirect',

  storeGoogleToken: (token: string) => tokenStorage.set(token, true),
};
