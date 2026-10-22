export type Role = 'admin' | 'user';
export type CowStatus = 'pending' | 'active' | 'paused' | 'reserved' | 'sold' | 'rejected';
export type Purpose = 'leite' | 'corte' | 'reproducao';
export type OrderStatus = 'awaiting_payment' | 'paid' | 'in_transit' | 'delivered' | 'cancelled';
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';
export type PaymentStatus = 'pending' | 'approved' | 'refused' | 'refunded';
export type DeliveryMethod = 'freight' | 'pickup';
export type PayoutStatus = 'not_applicable' | 'pending' | 'paid';

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'blocked';
  avatar_url: string | null;
  phone: string | null;
  document: string | null;
  city: string | null;
  state: string | null;
  farm_name: string | null;
  farm_description: string | null;
  has_password: boolean;
  has_google: boolean;
  profile_complete: boolean;
  must_change_password: boolean;
  payout_pix_key: string | null;
  payout_pix_key_type: string | null;
  payout_bank: { bank: string; agency: string; account: string; account_type: string; holder: string } | null;
  notification_preferences: Record<string, boolean>;
  created_at: string;
}

export interface Breed {
  id: number;
  name: string;
  active?: boolean;
  cows_count?: number;
}

export interface Media {
  id: number;
  type: 'photo' | 'video' | 'certificate';
  url: string;
  thumb_url: string | null;
  original_name: string | null;
  size: number;
}

export interface SellerSummary {
  id: number;
  name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  farm_name: string | null;
  rating: number | null;
  reviews_count: number;
  member_since: string;
}

export interface Cow {
  id: number;
  title: string;
  breed: Breed | null;
  sex: 'femea' | 'macho';
  age_months: number;
  weight_kg: number;
  purpose: Purpose;
  price: number;
  city: string;
  state: string;
  status: CowStatus;
  verified: boolean;
  views_count: number;
  cover_url: string | null;
  cover_thumb_url: string | null;
  is_favorite?: boolean;
  rejection_reason?: string | null;
  created_at: string;
  published_at?: string | null;
  seller?: SellerSummary;
}

export interface CowDetail extends Cow {
  description: string | null;
  milk_production_liters: number | null;
  vaccinations: string[];
  vaccinated: boolean;
  is_pregnant: boolean;
  pregnancy_months: number | null;
  health_history: string | null;
  photos: Media[];
  video: Media | null;
  certificates: Media[];
  is_owner: boolean;
}

export interface PaymentInfo {
  id: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  due_date: string | null;
  pix_payload: string | null;
  pix_qr_image: string | null;
  boleto_url: string | null;
  invoice_url: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  simulated: boolean;
  created_at: string;
}

export interface TimelineEvent {
  status: string;
  label: string;
  date: string | null;
  done: boolean;
}

export interface PersonSummary {
  id: number;
  name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  phone?: string | null;
}

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  delivery_method: DeliveryMethod;
  price: number;
  platform_fee: number;
  commission_percent: number;
  total: number;
  seller_amount: number;
  payout_status: PayoutStatus;
  payout_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  cow: Cow;
  buyer: PersonSummary;
  seller: PersonSummary;
  payment: PaymentInfo | null;
  timeline?: TimelineEvent[];
  review?: { rating: number; comment: string | null; created_at: string } | null;
  conversation_id?: number | null;
}

export interface CheckoutPreview {
  cow: CowDetail;
  price: number;
  platform_fee: number;
  commission_percent: number;
  total: number;
  seller_amount: number;
  payment_methods: PaymentMethod[];
  simulated_gateway: boolean;
}

export interface Message {
  id: number;
  body: string;
  sender_id: number;
  read_at: string | null;
  created_at: string;
  mine: boolean;
}

export interface Conversation {
  id: number;
  cow: { id: number; title: string; cover_thumb_url: string | null; price: number; status: CowStatus };
  other: PersonSummary;
  last_message: { body: string; created_at: string; mine: boolean } | null;
  unread_count: number;
  role: 'buyer' | 'seller';
  updated_at: string;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCounts {
  notifications: number;
  messages: number;
  latest_notification_id: number | null;
}

export interface PublicConfig {
  app_name: string;
  demo_login_enabled: boolean;
  demo_accounts: { role: string; label: string; email: string; password: string }[];
  google_enabled: boolean;
  payment_methods: PaymentMethod[];
  commission_percent: number;
  upload_max_size_mb: number;
  upload_allowed_types: string[];
}

export interface Testimonial {
  name: string;
  role: string;
  city: string;
  text: string;
}

export interface LandingTexts {
  hero_title: string;
  hero_subtitle: string;
  cta_title: string;
  cta_subtitle: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  instagram: string;
  facebook: string;
  youtube: string;
}

export interface LandingData {
  texts: LandingTexts;
  testimonials: Testimonial[];
  stats: { cows: number; sales: number; users: number };
  featured: Cow[];
}

export interface UserDashboard {
  stats: { cows_listed: number; cows_sold: number; purchases: number; total_sold: number };
  latest_cows: Cow[];
  latest_deals: Order[];
}
