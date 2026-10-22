import { api } from './api';
import type { AppNotification, Paginated, UnreadCounts } from './types';

export const notificationService = {
  list: (query: { filter?: string; type?: string; page?: number }) =>
    api.get<Paginated<AppNotification>>('/notifications', query),

  unreadCounts: () => api.get<{ data: UnreadCounts }>('/unread-counts').then((r) => r.data),

  since: (afterId: number) =>
    api.get<{ data: AppNotification[] }>('/notifications/since', { after: afterId }).then((r) => r.data),

  markRead: (id: number) => api.post(`/notifications/${id}/read`),

  markAllRead: () => api.post('/notifications/read-all'),
};
