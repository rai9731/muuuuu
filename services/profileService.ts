import { api } from './api';
import type { User } from './types';

export interface ProfilePayload {
  name: string;
  document: string;
  phone: string;
  city: string;
  state: string;
  farm_name: string;
  farm_description: string;
}

export interface PayoutPayload {
  payout_pix_key_type: string;
  payout_pix_key: string;
  bank: string;
  agency: string;
  account: string;
  account_type: string;
  holder: string;
}

export const profileService = {
  update: (payload: Partial<ProfilePayload>) =>
    api.put<{ data: User; message: string }>('/profile', payload),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post<{ data: User; message: string }>('/profile/avatar', form);
  },

  updatePayout: (payload: PayoutPayload) => api.put<{ data: User; message: string }>('/profile/payout', payload),

  updatePreferences: (preferences: Record<string, boolean>) =>
    api.put<{ data: User; message: string }>('/profile/notification-preferences', { preferences }),

  /** LGPD: baixa uma cópia de todos os dados pessoais do usuário. */
  exportData: () => api.download('/profile/export', {}, 'meus-dados-boi-na-rede.json'),

  /** LGPD: exclusão da conta (dados pessoais anonimizados). */
  deleteAccount: (password: string) => api.delete<{ message: string }>('/profile', { password, confirmation: true }),
};
