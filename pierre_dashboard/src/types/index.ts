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
  owner_id?: string;
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
