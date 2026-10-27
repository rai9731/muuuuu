import type { Order } from '@services/types';
import { Badge } from '@components/ui/Display';
import { ORDER_STATUS, PAYMENT_STATUS } from '@utils/constants';

/** Selo do pedido. Se o pagamento foi SIMULADO, o selo nunca aparece como pagamento real. */
export function OrderStatusBadge({ order }: { order: Pick<Order, 'status' | 'payment'> }) {
  const item = ORDER_STATUS[order.status] ?? { label: order.status, tone: 'gray' as const };
  const simulated = order.payment?.simulated && ['paid', 'in_transit', 'delivered'].includes(order.status);
  return <Badge tone={simulated ? 'yellow' : item.tone}>{simulated ? `${item.label} (simulado)` : item.label}</Badge>;
}

/** Selo do pagamento: "Confirmado" só sem o sufixo de simulação quando o gateway não é simulado. */
export function PaymentStatusBadge({ payment }: { payment: NonNullable<Order['payment']> }) {
  const item = PAYMENT_STATUS[payment.status] ?? { label: payment.status, tone: 'gray' as const };
  const simulated = payment.simulated && payment.status === 'approved';
  return <Badge tone={simulated ? 'yellow' : item.tone}>{simulated ? `${item.label} (simulado)` : item.label}</Badge>;
}
