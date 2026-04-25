export type Event = {
  id: string;
  title: string;
  venue?: string;
  date: string;
  image: string;
  status?: string;
  time?: string;
  ageLimit?: string;
  endTime?: string;
  price?: string;
  description?: string;
  tourProvider?: 'marzipano' | 'kuula' | 'cloudpano';
  marzipanoScenes?: MarzipanoScene[]; // NEW: Marzipano 360° viewer configuration
  tables?: Table[];
  genres?: Genre[];
};

export type Table = {
  id: string;
  eventId: string;
  name: string;
  zone?: string;
  areaId?: string;
  areaName?: string;
  capacity: number;
  minSpend: string; // Formatted as "X.XX €"
  totalCost: string; // Formatted as "X.XX €"
  available: boolean;
  locationDescription?: string;
  features?: string[];
  marzipanoPosition?: MarzipanoPosition; // NEW: Hotspot position in 360° view
};

export type PaymentShare = {
  id: string;
  phoneNumber?: string;
  amount: string;
  status: string; // 'checkout_pending' | 'paid' | 'expired' | 'cancelled'
  isOwner: boolean;
  guestName?: string;
  guestEmail?: string;
};

export type ReservationPaymentStatus = {
  reservationId: string;
  totalCost: string;
  amountPaid: string;
  amountRemaining: string;
  paymentShares: PaymentShare[];
  shareLink?: string;
  slotsFilled: number;
  slotsTotal: number;
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
  participants?: Array<{
    userId: string;
    userName: string;
    numPeople: number;
    amountPaid: string;
  }>;
  paymentShares?: PaymentShare[];
  shareLink?: string;
  slotsFilled?: number;
  slotsTotal?: number;
  table?: {
    id: string;
    name: string;
    zone?: string;
    capacity: number;
    minSpend: string;
    totalCost?: string;
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
  phone_verified: boolean;
  avatar_url?: string;
  date_of_birth?: string;
  created_at: string;
  updated_at: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
  phone_number: string;
  date_of_birth: string;
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

// Marzipano 360° Viewer Types

export type MarzipanoScene = {
  id: string;
  name: string; // Display name (e.g., "Main Floor", "VIP Room")
  imageUrl: string; // URL to equirectangular 360° image
  initialView?: MarzipanoView; // Default camera position when scene loads
  hotspots: MarzipanoHotspot[];
};

export type MarzipanoView = {
  yaw: number; // Horizontal rotation in radians (0 = forward)
  pitch: number; // Vertical rotation in radians (0 = horizon, + = up, - = down)
  fov: number; // Field of view in radians (e.g., 1.5708 = 90°)
};

export type MarzipanoHotspot = {
  id: string;
  type: 'table' | 'scene-link'; // Table selection or scene navigation
  yaw: number; // Horizontal position in radians
  pitch: number; // Vertical position in radians
  // For table hotspots
  tableId?: string;
  tableName?: string;
  available?: boolean;
  // For scene-link hotspots
  targetSceneId?: string;
  label?: string; // Display text (e.g., "→ VIP Room")
};

export type MarzipanoPosition = {
  sceneId: string; // Which scene this position is in
  yaw: number; // Horizontal position in radians
  pitch: number; // Vertical position in radians
};
