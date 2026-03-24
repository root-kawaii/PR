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
  scanType: 'ticket' | 'reservation' | 'unknown';
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

export interface OwnerStats {
  activeReservations: number;
  totalRevenue: string;
  events: EventStatRow[];
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
  matterportId?: string;
  tourProvider?: string;
  tourId?: string;
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
