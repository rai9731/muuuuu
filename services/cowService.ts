import { api } from './api';
import type { Cow, CowDetail, Paginated } from './types';

export interface CowFilters {
  search?: string;
  breed_id?: string;
  purpose?: string;
  price_min?: string;
  price_max?: string;
  age_min?: string;
  age_max?: string;
  weight_min?: string;
  weight_max?: string;
  state?: string;
  city?: string;
  pregnant?: string;
  sort?: string;
  page?: number;
}

export const cowService = {
  list: (filters: CowFilters, signal?: AbortSignal) =>
    api.get<Paginated<Cow>>('/cows', filters as Record<string, string | number>, signal),

  show: (id: number | string) =>
    api.get<{ data: CowDetail; similar: Cow[] }>(`/cows/${id}`),

  toggleFavorite: (id: number) => api.post<{ favorite: boolean }>(`/cows/${id}/favorite`),

  favorites: (page = 1) => api.get<Paginated<Cow>>('/favorites', { page }),

  // ─── Meus anúncios ───
  mine: (query: { status?: string; page?: number }) => api.get<Paginated<Cow>>('/my/cows', query),

  mineShow: (id: number | string) => api.get<{ data: CowDetail }>(`/my/cows/${id}`),

  create: (form: FormData) => api.post<{ data: CowDetail; message: string }>('/my/cows', form),

  update: (id: number, form: FormData) => api.post<{ data: CowDetail; message: string }>(`/my/cows/${id}`, form),

  changeStatus: (id: number, action: 'pause' | 'resume' | 'sold') =>
    api.patch<{ data: Cow; message: string }>(`/my/cows/${id}/status`, { action }),

  remove: (id: number) => api.delete<{ message: string }>(`/my/cows/${id}`),
};
