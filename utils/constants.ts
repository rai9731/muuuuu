export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

type Tone = 'green' | 'yellow' | 'brown' | 'red' | 'gray' | 'blue';

interface LabelTone {
  label: string;
  tone: Tone;
}

export const PURPOSE_LABELS: Record<string, string> = {
  leite: 'Leite',
  corte: 'Corte',
  reproducao: 'Reprodução',
};

export const SEX_LABELS: Record<string, string> = {
  femea: 'Fêmea',
  macho: 'Macho',
};

export const COW_STATUS: Record<string, LabelTone> = {
  pending: { label: 'Em análise', tone: 'yellow' },
  active: { label: 'Ativo', tone: 'green' },
  paused: { label: 'Pausado', tone: 'gray' },
  reserved: { label: 'Reservado', tone: 'blue' },
  sold: { label: 'Vendido', tone: 'brown' },
  rejected: { label: 'Recusado', tone: 'red' },
};

export const ORDER_STATUS: Record<string, LabelTone> = {
  awaiting_payment: { label: 'Aguardando pagamento', tone: 'yellow' },
  paid: { label: 'Pago', tone: 'green' },
  in_transit: { label: 'Em transporte', tone: 'blue' },
  delivered: { label: 'Entregue', tone: 'brown' },
  cancelled: { label: 'Cancelado', tone: 'red' },
};

export const PAYMENT_STATUS: Record<string, LabelTone> = {
  preparing: { label: 'Preparando cobrança', tone: 'gray' },
  creating: { label: 'Criando cobrança', tone: 'gray' },
  uncertain: { label: 'Resultado incerto', tone: 'red' },
  divergent: { label: 'Divergente', tone: 'red' },
  pending: { label: 'Aguardando pagamento', tone: 'yellow' },
  approved: { label: 'Confirmado', tone: 'green' },
  refused: { label: 'Recusado', tone: 'red' },
  refunded: { label: 'Estornado', tone: 'gray' },
};

export const PAYOUT_STATUS: Record<string, LabelTone> = {
  not_applicable: { label: '—', tone: 'gray' },
  pending: { label: 'Repasse pendente', tone: 'yellow' },
  paid: { label: 'Repassado', tone: 'green' },
};

export const PAYMENT_METHODS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  boleto: 'Boleto',
};

export const DELIVERY_METHODS: Record<string, string> = {
  freight: 'Frete',
  pickup: 'Retirada na propriedade',
};

export const USER_STATUS: Record<string, LabelTone> = {
  active: { label: 'Ativo', tone: 'green' },
  blocked: { label: 'Bloqueado', tone: 'red' },
};

export const NOTIFICATION_TYPES: Record<string, string> = {
  new_cow: 'Nova vaca',
  new_user: 'Novo usuário',
  password_reset: 'Redefinição de senha',
  payment_confirmed: 'Pagamento confirmado',
  sale_completed: 'Venda concluída',
  new_message: 'Nova mensagem',
  cow_approved: 'Anúncio aprovado',
  cow_rejected: 'Anúncio recusado',
  sale_made: 'Venda realizada',
  order_update: 'Pedido atualizado',
};

/** Tipos que o usuário comum pode ligar/desligar em Preferências. */
export const USER_NOTIFICATION_PREFERENCES: { key: string; label: string; description: string }[] = [
  { key: 'new_message', label: 'Novas mensagens', description: 'Quando alguém enviar uma mensagem sobre um anúncio.' },
  { key: 'cow_approved', label: 'Anúncio aprovado', description: 'Quando o seu anúncio for publicado na vitrine.' },
  { key: 'cow_rejected', label: 'Anúncio recusado', description: 'Quando o seu anúncio precisar de ajustes.' },
  { key: 'sale_made', label: 'Venda realizada', description: 'Quando alguém comprar uma vaca sua.' },
  { key: 'payment_confirmed', label: 'Pagamento confirmado', description: 'Quando o pagamento de um pedido for aprovado.' },
  { key: 'order_update', label: 'Atualizações de pedido', description: 'Envio, entrega e cancelamentos.' },
];

export const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-folha/15 text-pasto ring-folha/30',
  yellow: 'bg-trigo/20 text-[#7a5413] ring-trigo/40',
  brown: 'bg-terra/15 text-terra ring-terra/30',
  red: 'bg-red-500/10 text-red-700 ring-red-500/25',
  gray: 'bg-grafite/10 text-grafite/80 ring-grafite/15',
  blue: 'bg-sky-500/10 text-sky-800 ring-sky-500/25',
};
