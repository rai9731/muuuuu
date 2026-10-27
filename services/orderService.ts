import { api } from './api';
import type { CheckResult, CheckoutPreview, DeliveryMethod, Order, Paginated, PaymentMethod, UserDashboard } from './types';

export const orderService = {
  dashboard: () => api.get<{ data: UserDashboard }>('/dashboard').then((r) => r.data),

  checkoutPreview: (cowId: number | string) =>
    api.get<{ data: CheckoutPreview }>(`/checkout/${cowId}`).then((r) => r.data),

  checkout: (cowId: number | string, payload: { payment_method: PaymentMethod; delivery_method: DeliveryMethod }) =>
    api.post<{ data: Order; message: string }>(`/checkout/${cowId}`, payload).then((r) => r.data),

  // ─── Compras ───
  purchases: (query: { status?: string; page?: number }) => api.get<Paginated<Order>>('/my/purchases', query),
  purchase: (id: number | string) => api.get<{ data: Order }>(`/my/purchases/${id}`).then((r) => r.data),
  confirmDelivery: (id: number) => api.post<{ data: Order; message: string }>(`/my/purchases/${id}/confirm-delivery`),
  review: (id: number, rating: number, comment: string) =>
    api.post<{ data: Order; message: string }>(`/my/purchases/${id}/review`, { rating, comment }),
  checkPayment: (id: number) =>
    api.post<{ data: Order; check: { result: CheckResult; message: string; simulated: boolean } }>(`/my/purchases/${id}/check-payment`),
  simulatePayment: (id: number) => api.post<{ data: Order; message: string }>(`/my/purchases/${id}/simulate-payment`),

  // ─── Vendas ───
  sales: (query: { status?: string; page?: number }) => api.get<Paginated<Order>>('/my/sales', query),
  ship: (id: number) => api.post<{ data: Order; message: string }>(`/my/sales/${id}/ship`),
};
