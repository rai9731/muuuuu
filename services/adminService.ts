import { api } from './api';
import type { Breed, Cow, CowDetail, LandingTexts, Order, Paginated, PaymentInfo, PaymentMethod, Testimonial, User } from './types';

export interface PeriodQuery {
  from?: string;
  to?: string;
}

export interface AdminDashboard {
  kpis: {
    users: number;
    cows_listed: number;
    cows_sold: number;
    revenue: number;
    commissions: number;
    pending_payments: number;
    pending_payments_amount: number;
    pending_listings: number;
  };
  sales_by_month: { month: string; label: string; total: number; count: number }[];
  sales_by_breed: { breed: string; count: number; total: number }[];
  sales_by_state: { state: string; count: number; total: number }[];
  latest_cows: Cow[];
  latest_payments: AdminPayment[];
  latest_sales: Order[];
}

export interface AdminUserRow extends User {
  cows_count: number;
  purchases_count: number;
  sales_count: number;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  cows: Cow[];
  purchases: Order[];
  sales: Order[];
  payments: AdminPayment[];
  password_requests: PasswordRequest[];
}

export interface AdminPayment extends PaymentInfo {
  order: { id: number; code: string; payout_status: string; payout_at: string | null; seller_amount: number; status: string };
  payer: { id: number; name: string };
  seller: { id: number; name: string };
  cow: { id: number; title: string };
}

export interface PasswordRequest {
  id: number;
  email: string;
  status: 'pending' | 'resolved';
  user: { id: number; name: string } | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Reports {
  summary: { revenue: number; commissions: number; sales: number; average_ticket: number };
  by_period: { period: string; label: string; total: number; commissions: number; count: number }[];
  top_users: { id: number; name: string; city: string | null; state: string | null; sales: number; purchases: number; listings: number; total_sold: number }[];
  top_breeds: { breed: string; count: number; total: number }[];
}

export interface PlatformSettings {
  commission_percent: number;
  payment_methods: PaymentMethod[];
  landing: LandingTexts;
  testimonials: Testimonial[];
  breeds: Breed[];
}

type Q = Record<string, string | number | undefined>;

export const adminService = {
  dashboard: (q: PeriodQuery) => api.get<{ data: AdminDashboard }>('/admin/dashboard', q as Q).then((r) => r.data),

  // Anúncios
  cows: (q: Q) => api.get<Paginated<Cow & { seller: { id: number; name: string } }>>('/admin/cows', q),
  cow: (id: number) => api.get<{ data: CowDetail }>(`/admin/cows/${id}`).then((r) => r.data),
  approveCow: (id: number) => api.post<{ message: string }>(`/admin/cows/${id}/approve`),
  rejectCow: (id: number, reason: string) => api.post<{ message: string }>(`/admin/cows/${id}/reject`, { reason }),
  pauseCow: (id: number) => api.post<{ message: string }>(`/admin/cows/${id}/pause`),
  updateCow: (id: number, payload: Record<string, unknown>) => api.put<{ message: string }>(`/admin/cows/${id}`, payload),
  deleteCow: (id: number) => api.delete<{ message: string }>(`/admin/cows/${id}`),

  // Usuários
  users: (q: Q) => api.get<Paginated<AdminUserRow>>('/admin/users', q),
  user: (id: number | string) => api.get<{ data: AdminUserDetail }>(`/admin/users/${id}`).then((r) => r.data),
  blockUser: (id: number) => api.post<{ message: string }>(`/admin/users/${id}/block`),
  unblockUser: (id: number) => api.post<{ message: string }>(`/admin/users/${id}/unblock`),
  resetPassword: (id: number, password: string, requestId?: number) =>
    api.post<{ message: string }>(`/admin/users/${id}/reset-password`, { password, request_id: requestId }),
  passwordRequests: (q: Q) => api.get<Paginated<PasswordRequest>>('/admin/password-requests', q),

  // Vendas
  sales: (q: Q) => api.get<Paginated<Order>>('/admin/sales', q),
  sale: (id: number | string) => api.get<{ data: Order }>(`/admin/sales/${id}`).then((r) => r.data),

  // Pagamentos
  payments: (q: Q) => api.get<Paginated<AdminPayment>>('/admin/payments', q),
  refund: (id: number) => api.post<{ message: string }>(`/admin/payments/${id}/refund`),
  payout: (orderId: number) => api.post<{ message: string }>(`/admin/orders/${orderId}/payout`),
  exportPayments: (format: 'csv' | 'pdf', q: Q) => api.download('/admin/payments/export', { ...q, format }, `pagamentos.${format}`),

  // Relatórios
  reports: (q: PeriodQuery) => api.get<{ data: Reports }>('/admin/reports', q as Q).then((r) => r.data),
  exportReports: (format: 'csv' | 'pdf', q: PeriodQuery) =>
    api.download('/admin/reports/export', { ...(q as Q), format }, `relatorio.${format}`),

  // Configurações
  settings: () => api.get<{ data: PlatformSettings }>('/admin/settings').then((r) => r.data),
  updateSettings: (payload: Omit<PlatformSettings, 'breeds'>) =>
    api.put<{ data: PlatformSettings; message: string }>('/admin/settings', payload),
  createBreed: (name: string) => api.post<{ data: Breed; message: string }>('/admin/breeds', { name }),
  updateBreed: (id: number, payload: { name?: string; active?: boolean }) =>
    api.put<{ data: Breed; message: string }>(`/admin/breeds/${id}`, payload),
  deleteBreed: (id: number) => api.delete<{ message: string }>(`/admin/breeds/${id}`),
};
