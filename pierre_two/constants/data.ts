import { Club, Genre, Table, Event } from '@/types';

export const CLUBS: Club[] = [
  { id: '1', name: 'PULP ENTERTAINM...', subtitle: 'Via Macerano 18, Gal...', image: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=300' },
  { id: '2', name: 'DO IT BETTER', subtitle: 'Via Della Giustizia, 2...', image: 'https://images.unsplash.com/photo-1571266028243-d220c6e15763?w=300' },
];

export const GENRES: Genre[] = [
  { id: '1', name: 'ITALIANA', color: '#ec4899' },
  { id: '2', name: 'HIP HOP', color: '#fbbf24' },
  { id: '3', name: 'LATINO', color: '#3b82f6' },
];

export const MOCK_TABLES: Table[] = [
  { id: 't1', eventId: '1', name: 'TAVOLO A1', zone: 'A', capacity: 6, minSpend: '80.00 €', totalCost: '480.00 €', available: true },
  { id: 't2', eventId: '1', name: 'TAVOLO A2', zone: 'A', capacity: 4, minSpend: '80.00 €', totalCost: '320.00 €', available: true },
  { id: 't3', eventId: '1', name: 'TAVOLO A3', zone: 'A', capacity: 8, minSpend: '80.00 €', totalCost: '640.00 €', available: false },
  { id: 't4', eventId: '1', name: 'TAVOLO B1', zone: 'B', capacity: 4, minSpend: '25.00 €', totalCost: '100.00 €', available: true },
  { id: 't5', eventId: '1', name: 'TAVOLO B2', zone: 'B', capacity: 6, minSpend: '25.00 €', totalCost: '150.00 €', available: true },
  { id: 't6', eventId: '1', name: 'TAVOLO B3', zone: 'B', capacity: 4, minSpend: '25.00 €', totalCost: '100.00 €', available: false },
];

export const getMockEvents = (): Event[] => [
  { 
    id: '1', 
    title: 'SOLD OUT', 
    venue: 'Fabrique, Viale Monza 140', 
    date: '10 MAG | 23:00', 
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400', 
    status: 'SOLD OUT',
    time: '23:00',
    ageLimit: '18+',
    endTime: '22:30',
    price: '32 €',
    description: 'Entre nella lista d\'attese per i biglietti'
  },
  { 
    id: '2', 
    title: 'KUREMINO LIVE S...', 
    venue: 'Santeria Toscana, Viale...', 
    date: '10 FEB | 20:00', 
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400',
    time: '20:00',
    ageLimit: '16+',
    endTime: '02:00',
    price: '25 €'
  },
  { 
    id: '3', 
    title: 'SATURDAY', 
    venue: 'Seven Space', 
    date: '27 DIC', 
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    time: '23:00',
    ageLimit: '18+',
    endTime: '04:00',
    price: '20 €'
  },
];
