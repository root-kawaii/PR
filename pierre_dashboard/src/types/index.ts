export interface ClubOwner {
  id: string;
  email: string;
  name: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Club {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  address?: string;
  phone_number?: string;
  website?: string;
  owner_id?: string;
  stripe_connected_account_id?: string;
  stripe_onboarding_complete?: boolean;
  stripe_charges_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  platform_commission_percent?: string | number;
  platform_commission_fixed_fee?: string | number;
}

export interface StripeConnectStatus {
  connected_account_id?: string | null;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  platform_commission_percent?: string | number | null;
  platform_commission_fixed_fee?: string | number | null;
}

export interface StripeOnboardingLinkResponse {
  connected_account_id?: string;
  connectedAccountId?: string;
  onboarding_url?: string;
  onboardingUrl?: string;
  onboarding_complete?: boolean;
  onboardingComplete?: boolean;
  charges_enabled?: boolean;
  chargesEnabled?: boolean;
  payouts_enabled?: boolean;
  payoutsEnabled?: boolean;
}

export interface ClubImage {
  id: string;
  clubId: string;
  url: string;
  displayOrder: number;
  altText?: string;
}

export interface TableImage {
  id: string;
  tableId: string;
  url: string;
  displayOrder: number;
  altText?: string;
}

export interface TableReservation {
  id: string;
  reservationCode: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  numPeople: number;
  totalAmount: string;
  amountPaid: string;
  amountRemaining: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  specialRequests?: string;
  isManual: boolean;
  manualNotes?: string;
  table: { id: string; name: string; zone?: string };
  event: { id: string; title: string; date: string };
  createdAt: string;
}

export interface ScanResult {
  valid: boolean;
  alreadyUsed: boolean;
  type: 'ticket' | 'reservation';
  guestName?: string;
  numPeople?: number;
  eventTitle?: string;
  tableName?: string;
  code: string;
}

export interface EventResponse {
  id: string;
  title: string;
  venue: string;
  date: string;
  image: string;
  status?: string;
  time?: string;
  ageLimit?: string;
  endTime?: string;
  price?: string;
  description?: string;
  tourProvider?: string;
  marzipanoScenes?: unknown;
}

export interface TableResponse {
  id: string;
  eventId: string;
  name: string;
  zone?: string;
  capacity: number;
  minSpend: string;
  totalCost: string;
  available: boolean;
  locationDescription?: string;
  features?: string[];
  marzipanoPosition?: unknown;
}

export interface AuthResponse {
  owner: ClubOwner;
  club: Club | null;
  token: string;
}
