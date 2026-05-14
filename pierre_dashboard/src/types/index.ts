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
  marzipanoScenes?: MarzipanoScene[] | null;
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
  club_id: string;
  url: string;
  display_order: number;
  alt_text?: string;
}

export interface TableImage {
  id: string;
  table_id: string;
  url: string;
  display_order: number;
  alt_text?: string;
}

export interface TableReservation {
  id: string;
  reservationCode: string;
  status: 'pending' | 'confirmed' | 'completed' | 'refused' | 'cancelled';
  refusalReason?: string;
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
  table: { id: string; name: string; areaName?: string };
  event: { id: string; title: string; date: string };
  createdAt: string;
  maleGuestCount: number;
  femaleGuestCount: number;
}

export interface ScanResult {
  valid: boolean;
  alreadyUsed: boolean;
  scanType: 'ticket' | 'reservation' | 'unknown';
  status?: string;
  refusalReason?: string;
  guestName?: string;
  numPeople?: number;
  eventTitle?: string;
  tableName?: string;
  code: string;
}

export interface EventStatRow {
  eventId: string;
  title: string;
  date: string;
  reservedTables: number;
  totalTables: number;
}

export interface EventReservationStats {
  eventId: string;
  totalReservations: number;
  pendingReservations: number;
  confirmedReservations: number;
  completedReservations: number;
  refusedReservations: number;
  cancelledReservations: number;
  totalPeople: number;
  maleGuests: number;
  femaleGuests: number;
  totalAmount: string | number;
  amountPaid: string | number;
  amountRemaining: string | number;
}

export interface OwnerStats {
  activeReservations: number;
  totalRevenue: string;
  events: EventStatRow[];
}

export interface Genre {
  id: string;
  name: string;
  color: string;
}

export interface EventResponse {
  id: string;
  title: string;
  venue?: string;
  clubName?: string;
  clubAddress?: string;
  date: string;
  image: string;
  status?: string;
  time?: string;
  ageLimit?: string;
  endTime?: string;
  price?: string;
  entryType?: 'free' | 'ticketed';
  ticketingMode?: 'none' | 'free' | 'paid';
  hasReservableAreas?: boolean;
  description?: string;
  tourProvider?: string;
  marzipanoScenes?: MarzipanoScene[] | null;
  genres?: Genre[];
}

export interface TableResponse {
  id: string;
  eventId?: string;
  name: string;
  areaId?: string;
  areaName?: string;
  capacity: number;
  minSpend: string;
  totalCost: string;
  available: boolean;
  locationDescription?: string;
  features?: string[];
}

export interface Area {
  id: string;
  clubId: string;
  name: string;
  price: string;
  description?: string;
}

// ============================================================================
// 360° Tour (Marzipano) types
// Mirrors pierre_two/types/index.ts so the config JSON is interchangeable
// between the dashboard editor and the mobile viewer.
// ============================================================================

export interface MarzipanoView {
  yaw: number;
  pitch: number;
  fov: number;
}

export type MarzipanoHotspotType = 'scene-link' | 'area';

export interface MarzipanoHotspot {
  id: string;
  type: MarzipanoHotspotType;
  yaw: number;
  pitch: number;
  // scene-link
  targetSceneId?: string;
  label?: string;
  // area
  areaId?: string;
  areaName?: string;
}

export interface MarzipanoScene {
  id: string;
  name: string;
  imageUrl: string;
  initialView?: MarzipanoView;
  hotspots: MarzipanoHotspot[];
}

export interface TourConfigPayload {
  scenes: MarzipanoScene[] | null;
}

export interface AuthResponse {
  owner: ClubOwner;
  club: Club | null;
  token: string;
}
