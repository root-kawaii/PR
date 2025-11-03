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
  name: string;
  zone: string;
  capacity: number;
  minSpend: number;
  price: number;
  available: boolean;
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