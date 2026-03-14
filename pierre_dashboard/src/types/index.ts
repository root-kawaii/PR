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
