import { useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, X } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { EventResponse } from '../types';

const MONTH_MAP: Record<string, number> = {
  'GEN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAG': 4, 'GIU': 5,
  'LUG': 6, 'AGO': 7, 'SET': 8, 'OTT': 9, 'NOV': 10, 'DIC': 11,
};

function extractEventDate(dateStr: string): string | null {
  try {
    // ISO format: '2024-12-27T23:00:00'
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    // ISO with space: '2024-12-27 23:00:00'
    if (dateStr.includes(' ') && !dateStr.includes('|')) {
      const datePart = dateStr.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    }
    // Plain ISO: '2024-12-27'
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Legacy Italian: '10 MAG | 23:00' or '27 DIC'
    if (/^\d{1,2}\s+[A-Z]{3}/.test(dateStr)) {
      const parts = dateStr.split('|')[0].trim().split(/\s+/);
      if (parts.length < 2) return null;
      const day = parseInt(parts[0]);
      const month = MONTH_MAP[parts[1]];
      if (month === undefined || isNaN(day)) return null;
      const now = new Date();
      const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  } catch {
    return null;
  }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EventsPage() {
  const { data: events, loading, refetch } = useFetch<EventResponse[]>('/owner/events');
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterDate, setFilterDate] = useState(todayStr());

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return true; // include unparseable events
      return eventDate >= filterDate;
    });
  }, [events, filterDate]);

  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [image, setImage] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/owner/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title, venue, date, image, price, description }),
      });
      if (!res.ok) throw new Error('Failed to create event');
      setShowForm(false);
      setTitle(''); setVenue(''); setDate(''); setImage(''); setPrice(''); setDescription('');
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          Create Event
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-700">From</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm"
        />
        <span className="text-sm text-gray-500">
          {filteredEvents.length} of {events?.length ?? 0} events
        </span>
      </div>

      {/* Create event modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Create Event</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input value={venue} onChange={e => setVenue(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input value={date} onChange={e => setDate(e.target.value)} required placeholder="e.g. 15 FEB | 23:00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input value={image} onChange={e => setImage(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 15.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Events list */}
      {!filteredEvents.length ? (
        <p className="text-gray-500">
          {events?.length ? 'No events from this date onwards.' : 'No events yet. Create your first event.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => (
            <Link
              key={event.id}
              to={`/dashboard/events/${event.id}/tables`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {event.image && (
                <div className="h-40 overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">{event.title}</h3>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-gray-600" />
                </div>
                <p className="text-sm text-gray-500 mt-1">{event.venue}</p>
                <p className="text-sm text-gray-500">{event.date}</p>
                {event.price && (
                  <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {event.price}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
