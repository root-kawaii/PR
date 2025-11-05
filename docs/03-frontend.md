# Frontend Documentation

## Technology

- **Framework**: React Native 0.81.4
- **Build Tool**: Expo 54.0.13
- **Router**: Expo Router 6.0.11
- **Language**: TypeScript 5.9.2
- **Location**: `/pierre_two/`

## Project Structure

```
pierre_two/
├── app/
│   ├── _layout.tsx              # Root layout
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigation
│   │   ├── index.tsx            # Home screen
│   │   ├── search.tsx           # Search screen
│   │   ├── tickets.tsx          # Tickets screen
│   │   └── profile.tsx          # Profile screen
│   └── +not-found.tsx           # 404 page
│
├── components/
│   ├── EventCard.tsx            # Event display card
│   ├── ClubCard.tsx             # Club display card
│   ├── EventDetailModal.tsx     # Event details popup
│   └── TableReservationModal.tsx # Table booking popup
│
├── hooks/
│   ├── useEvents.tsx            # Event API integration
│   └── useModal.tsx             # Modal state management
│
├── types/
│   └── index.ts                 # TypeScript definitions
│
├── constants/
│   ├── mockEvents.tsx           # Sample event data
│   └── theme.tsx                # App theme config
│
├── assets/                      # Images, fonts, etc.
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
└── tsconfig.json                # TypeScript config
```

## Key Components

### EventCard
**Location**: [components/EventCard.tsx](../pierre_two/components/EventCard.tsx)

Displays event information in a card format with:
- Event image
- Title, date, location
- Genre badge
- Pricing information
- OnPress handler for modal

**Props**:
```typescript
interface EventCardProps {
  event: Event;
  onPress: () => void;
}
```

### EventDetailModal
**Location**: [components/EventDetailModal.tsx](../pierre_two/components/EventDetailModal.tsx)

Full-screen modal showing detailed event information:
- Hero image
- Full description
- Date and time
- Venue details
- Pricing tiers
- "Reserve Table" CTA button

**Props**:
```typescript
interface EventDetailModalProps {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onReserveTable: () => void;
}
```

### TableReservationModal
**Location**: [components/TableReservationModal.tsx](../pierre_two/components/TableReservationModal.tsx)

Modal for table selection and reservation:
- Available tables list
- Table capacity and pricing
- Selection state
- Confirmation button

**Props**:
```typescript
interface TableReservationModalProps {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onConfirm: (tableId: string) => void;
}
```

### ClubCard
**Location**: [components/ClubCard.tsx](../pierre_two/components/ClubCard.tsx)

Displays club information card.

## Custom Hooks

### useEvents
**Location**: [hooks/useEvents.tsx](../pierre_two/hooks/useEvents.tsx)

Manages event data fetching from backend API.

```typescript
const { events, loading, error, fetchEvents } = useEvents();
```

**Returns**:
- `events`: Array of Event objects
- `loading`: Boolean loading state
- `error`: Error message if request fails
- `fetchEvents`: Function to refetch data

**Implementation**:
```typescript
const fetchEvents = async () => {
  try {
    setLoading(true);
    const response = await fetch('http://127.0.0.1:3000/events');
    const data = await response.json();
    setEvents(data);
  } catch (err) {
    setError('Failed to fetch events');
  } finally {
    setLoading(false);
  }
};
```

### useModal
**Location**: [hooks/useModal.tsx](../pierre_two/hooks/useModal.tsx)

Manages modal visibility state.

```typescript
const { visible, open, close } = useModal();
```

## Type Definitions

**Location**: [types/index.ts](../pierre_two/types/index.ts)

```typescript
export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  imageUrl: string;
  genre: string;
  price: number;
  club: Club;
  tables: Table[];
}

export interface Club {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  rating: number;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  price: number;
  available: boolean;
}

export interface Genre {
  id: string;
  name: string;
  imageUrl: string;
}
```

## Navigation Structure

Using Expo Router file-based navigation:

```
/ (Root)
└── (tabs)/
    ├── /              # Home (index.tsx)
    ├── /search        # Search page
    ├── /tickets       # Tickets page
    └── /profile       # Profile page
```

**Tab Configuration**: [app/(tabs)/_layout.tsx](../pierre_two/app/(tabs)/_layout.tsx)

## Screen Implementations

### Home Screen
**Location**: [app/(tabs)/index.tsx](../pierre_two/app/(tabs)/index.tsx)

Main screen showing:
- Horizontal scrolling event list
- Featured clubs section
- Genre browsing
- Event modals integration

**Key Features**:
- Fetches events using `useEvents` hook
- Opens `EventDetailModal` on card press
- Navigates to `TableReservationModal`

### Search Screen
**Location**: [app/(tabs)/search.tsx](../pierre_two/app/(tabs)/search.tsx)

Placeholder for search functionality.

### Tickets Screen
**Location**: [app/(tabs)/tickets.tsx](../pierre_two/app/(tabs)/tickets.tsx)

Placeholder for user's tickets/bookings.

### Profile Screen
**Location**: [app/(tabs)/profile.tsx](../pierre_two/app/(tabs)/profile.tsx)

Placeholder for user profile.

## Styling

**Theme Configuration**: [constants/theme.tsx](../pierre_two/constants/theme.tsx)

```typescript
export const theme = {
  colors: {
    primary: '#6C63FF',
    secondary: '#FF6584',
    background: '#1A1A2E',
    card: '#16213E',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};
```

## API Integration

**Base URL**: `http://127.0.0.1:3000`

**Endpoints Used**:
- `GET /events` - Fetch all events

**Future Integration**:
- `POST /payments` - Create reservation payment
- `GET /payments/:id` - Check payment status
- User authentication endpoints

## Running the Frontend

```bash
cd pierre_two

# Install dependencies
npm install

# Start Expo development server
npx expo start

# Options:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Scan QR code with Expo Go app
```

## Configuration

**Expo Config**: [app.json](../pierre_two/app.json)
```json
{
  "expo": {
    "name": "pierre_two",
    "slug": "pierre_two",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "myapp",
    // ...
  }
}
```

## Dependencies

Key packages (see [package.json](../pierre_two/package.json)):
- `expo`: ^54.0.13
- `expo-router`: ^6.0.11
- `react`: 18.3.1
- `react-native`: 0.81.4
- `typescript`: ^5.9.2

## Development Notes

**Current State**:
- Using mock data in constants
- API integration partially implemented
- No authentication/authorization
- No error boundaries
- No offline support

**TODO**:
- Complete API integration for all endpoints
- Implement payment flow with Stripe
- Add user authentication
- Error handling and retry logic
- Loading states and skeletons
- Image optimization
- Navigation guards