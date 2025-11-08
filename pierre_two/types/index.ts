export type Event = {
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
  tables?: Table[];
};

export type Table = {
  id: string;
  eventId: string;
  name: string;
  zone?: string;
  capacity: number;
  minSpend: string; // Formatted as "X.XX €"
  totalCost: string; // Formatted as "X.XX €"
  available: boolean;
  locationDescription?: string;
  features?: string[];
};

export type TableReservation = {
  id: string;
  reservationCode: string;
  status: string;
  numPeople: number;
  totalAmount: string;
  amountPaid: string;
  amountRemaining: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  specialRequests?: string;
  createdAt: string;
  table?: {
    id: string;
    name: string;
    zone?: string;
    capacity: number;
    minSpend: string;
    locationDescription?: string;
    features?: string[];
  };
  event?: {
    id: string;
    title: string;
    venue: string;
    date: string;
    image: string;
  };
};

export type Club = {
  id: string;
  name: string;
  subtitle: string;
  image: string;
};

export type Genre = {
  id: string;
  name: string;
  color: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  phone_number?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
  phone_number?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type Ticket = {
  id: string;
  ticketCode: string;
  ticketType: string;
  price: string;
  status: string;
  purchaseDate: string;
  qrCode?: string;
  event: {
    id: string;
    title: string;
    venue: string;
    date: string;
    image: string;
    status?: string;
  };
};