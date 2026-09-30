export type Names = { en: string; ro?: string; ru?: string };
export type Option = {
  id: string;
  names: Names;
  price_bani: number;
  available: boolean;
};
export type Group = {
  id: string;
  names: Names;
  min_select: number;
  max_select: number;
  options: Option[];
};
export type Product = {
  id: string;
  category_id: string;
  names: Names;
  descriptions: Names;
  price_bani: number;
  version: number;
  available: boolean;
  allergens: string[];
  dietary_labels: string[];
  modifierGroups: Group[];
};
export type Menu = {
  categories: { id: string; names: Names; sort_order: number }[];
  products: Product[];
};
export type Guest = { id: string; nickname: string; active: boolean };
export type Item = {
  id: string;
  snapshot: { names: Names; allergens: string[]; options: Option[] };
  status: string;
  ordered_by: string;
  served_to: string;
  unit_price_bani: number;
  quantity: number;
  total_bani: number;
  note: string;
  shares: { guestId: string; amountBani: number }[];
  adjustments: { amount_bani: number; kind: string; reason: string }[];
};
export type Proposal = {
  id: string;
  kind: string;
  status: string;
  reason: string;
  proposed_by: string;
  votes: { guest_id: string; accepted: boolean | null }[];
  shares: { item_id: string; guest_id: string; amount_bani: number }[];
};
export type Bill = {
  totalBani: number;
  paidBani: number;
  reservedBani: number;
  remainingBani: number;
  availableBani: number;
  guests: {
    id: string;
    nickname: string;
    allocated_bani: number;
    paid_bani: number;
    reserved_bani: number;
    remaining_bani: number;
    available_bani: number;
  }[];
};
export type Reservation = {
  id: string;
  payer_id: string;
  amount_bani: number;
  effective_status: string;
  expires_at: string;
};
export type State = {
  pos?: {
    delivered_revision: number;
    paused: boolean;
    pending: number;
    failed: number;
  } | null;
  testPayments: boolean;
  paymentsEnabled: boolean;
  payments: Payment[];
  session: {
    id: string;
    restaurant_id: string;
    status: string;
    revision: number;
  };
  table: {
    label: string;
    restaurant_name: string;
    branch_name: string;
    approval_required: boolean;
    operating_mode: "ORDER_AND_PAY" | "PAY_AT_TABLE";
    languages: string[];
    default_language: string;
  };
  actor: { id: string; kind: string; role: string };
  guests: Guest[];
  items: Item[];
  proposals: Proposal[];
  reservations: Reservation[];
  bill: Bill;
  menu: Menu;
  help: { id: string; guest_id: string; reason: string; status: string }[];
  audit: { id: number; action: string; detail: unknown; created_at: string }[];
};
export type Branch = {
  operating_mode: "ORDER_AND_PAY" | "PAY_AT_TABLE";
  languages: string[];
  default_language: string;
  id: string;
  name: string;
  timezone: string;
  approval_required: boolean;
  accepting_orders: boolean;
  hours: { day: number; opens: string; closes: string }[];
};
export type Dashboard = {
  posManaged: boolean;
  recentSessions: { id: string; label: string; closed_at: string }[];
  restaurant: { id: string; name: string };
  role: string;
  branches: Branch[];
  tables: {
    id: string;
    branch_id: string;
    label: string;
    pilot_enabled: boolean;
    max_guests: number;
    session_id: string | null;
    guest_count: number;
    remaining_bani: number;
    collection_requests: number;
    pending_orders: number;
    help_requests: number;
    qr_version: string | null;
  }[];
  menu: Menu;
  staff: { id: string; display_name: string; email: string; role: string }[];
};
export type Auth = {
  accessToken: string;
  actorId: string;
  kind: string;
  sessionId?: string;
};
export type Quote = {
  tipBani?: number;
  amountBani: number;
  payerId: string;
  parts: { itemId: string; guestId: string; amountBani: number }[];
  reservationId?: string;
  expiresAt?: string;
};
export type Refund = {
  id: string;
  amount_bani: number;
  tip_bani: number;
  mode: string;
  status: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
};
export type Payment = {
  id: string;
  payer_id: string;
  reservation_id: string;
  method: string;
  provider: string;
  is_test: boolean;
  amount_bani: number;
  tip_bani: number;
  currency: string;
  status: string;
  received_bani: number | null;
  change_bani: number | null;
  created_at: string;
  resolved_at: string | null;
  refunds: Refund[];
  parts: { item_id: string; guest_id: string; amount_bani: number }[];
};
