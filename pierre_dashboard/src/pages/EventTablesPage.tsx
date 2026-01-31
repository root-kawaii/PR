import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ArrowLeft, X } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { TableResponse } from '../types';

interface TablesData {
  tables: TableResponse[];
}

export default function EventTablesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, loading, refetch } = useFetch<TablesData>(`/owner/events/${eventId}/tables`);
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [capacity, setCapacity] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [locationDescription, setLocationDescription] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/owner/events/${eventId}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_id: eventId,
          name,
          zone: zone || undefined,
          capacity: parseInt(capacity),
          min_spend: parseFloat(minSpend),
          location_description: locationDescription || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create table');
      setShowForm(false);
      setName(''); setZone(''); setCapacity(''); setMinSpend(''); setLocationDescription('');
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const tables = data?.tables ?? [];

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/dashboard/events" className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-3">
          <ArrowLeft size={16} />
          Back to Events
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={18} />
            Add Table
          </button>
        </div>
      </div>

      {/* Create table modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Table</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. VIP-01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <input value={zone} onChange={e => setZone(e.target.value)} placeholder="e.g. VIP Area"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Spend</label>
                  <input type="number" value={minSpend} onChange={e => setMinSpend(e.target.value)} required min="0" step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Description</label>
                <input value={locationDescription} onChange={e => setLocationDescription(e.target.value)} placeholder="e.g. Near the stage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Creating...' : 'Add Table'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tables list */}
      {!tables.length ? (
        <p className="text-gray-500">No tables for this event yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Zone</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Capacity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Min Spend</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tables.map((table) => (
                <tr key={table.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{table.name}</td>
                  <td className="px-6 py-4 text-gray-500">{table.zone || '-'}</td>
                  <td className="px-6 py-4 text-gray-500">{table.capacity}</td>
                  <td className="px-6 py-4 text-gray-500">{table.minSpend}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                      table.available
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {table.available ? 'Available' : 'Reserved'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
