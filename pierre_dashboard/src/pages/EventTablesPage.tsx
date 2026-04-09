import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, ArrowLeft, X, Search, ListOrdered, Image, Trash2 } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { TableResponse, TableImage } from '../types';

interface TablesData {
  tables: TableResponse[];
}

type FilterAvailability = 'all' | 'available' | 'reserved';

export default function EventTablesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, loading, refetch } = useFetch<TablesData>(`/owner/events/${eventId}/tables`);
  const { token } = useAuth();

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [capacity, setCapacity] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [locationDescription, setLocationDescription] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterAvailability, setFilterAvailability] = useState<FilterAvailability>('all');

  // Image management
  const [imageTableId, setImageTableId] = useState<string | null>(null);
  const { data: tableImages, loading: imagesLoading, refetch: refetchImages } = useFetch<TableImage[]>(
    imageTableId ? `/owner/tables/${imageTableId}/images` : ''
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [addingImage, setAddingImage] = useState(false);

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

  const handleAddImage = async (e: FormEvent) => {
    e.preventDefault();
    if (!imageTableId) return;
    setAddingImage(true);
    try {
      const res = await fetch(`${API_URL}/owner/tables/${imageTableId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: newImageUrl,
          alt_text: newImageAlt || undefined,
          display_order: (tableImages ?? []).length,
        }),
      });
      if (!res.ok) throw new Error('Errore nel caricamento');
      setNewImageUrl('');
      setNewImageAlt('');
      refetchImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setAddingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Rimuovere questa immagine?')) return;
    try {
      await fetch(`${API_URL}/owner/table-images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      refetchImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    }
  };

  const tables = data?.tables ?? [];

  const zones = ['all', ...Array.from(new Set(tables.map(t => t.zone).filter(Boolean) as string[]))];

  const filtered = tables.filter((t) => {
    const matchesSearch = search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.zone ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesZone = filterZone === 'all' || t.zone === filterZone;
    const matchesAvailability =
      filterAvailability === 'all' ||
      (filterAvailability === 'available' && t.available) ||
      (filterAvailability === 'reserved' && !t.available);
    return matchesSearch && matchesZone && matchesAvailability;
  });

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Tavoli</h1>
          <div className="flex gap-2">
            <Link
              to={`/dashboard/events/${eventId}/reservations`}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <ListOrdered size={16} />
              Prenotazioni
            </Link>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus size={18} />
              Aggiungi Tavolo
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca tavolo..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm"
          />
        </div>
        {zones.length > 1 && (
          <select
            value={filterZone}
            onChange={e => setFilterZone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none"
          >
            {zones.map(z => (
              <option key={z} value={z}>{z === 'all' ? 'Tutte le zone' : z}</option>
            ))}
          </select>
        )}
        <select
          value={filterAvailability}
          onChange={e => setFilterAvailability(e.target.value as FilterAvailability)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none"
        >
          <option value="all">Tutti</option>
          <option value="available">Disponibili</option>
          <option value="reserved">Prenotati</option>
        </select>
      </div>

      {/* Create table modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Aggiungi Tavolo</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="es. VIP-01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <input value={zone} onChange={e => setZone(e.target.value)} placeholder="es. Area VIP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capienza</label>
                  <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Spend (€)</label>
                  <input type="number" value={minSpend} onChange={e => setMinSpend(e.target.value)} required min="0" step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione posizione</label>
                <input value={locationDescription} onChange={e => setLocationDescription(e.target.value)} placeholder="es. Vicino al palco"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Creazione...' : 'Aggiungi Tavolo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Image manager modal */}
      {imageTableId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Immagini – {tables.find(t => t.id === imageTableId)?.name}
              </h2>
              <button onClick={() => setImageTableId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {imagesLoading ? (
              <p className="text-gray-500 text-sm mb-4">Caricamento...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {(tableImages ?? []).map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-video bg-gray-100">
                    <img src={img.url} alt={img.alt_text ?? ''} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {!(tableImages ?? []).length && (
                  <p className="col-span-2 text-sm text-gray-400">Nessuna immagine</p>
                )}
              </div>
            )}

            <form onSubmit={handleAddImage} className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700">Aggiungi immagine</p>
              <input
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                required
                placeholder="URL immagine"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm"
              />
              <input
                value={newImageAlt}
                onChange={e => setNewImageAlt(e.target.value)}
                placeholder="Descrizione (opzionale)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm"
              />
              <button
                type="submit"
                disabled={addingImage}
                className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {addingImage ? 'Aggiungendo...' : 'Aggiungi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tables list */}
      {!tables.length ? (
        <p className="text-gray-500">Nessun tavolo per questo evento.</p>
      ) : !filtered.length ? (
        <p className="text-gray-500">Nessun risultato per i filtri applicati.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Zona</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Capienza</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Min Spend</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((table) => (
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
                      {table.available ? 'Disponibile' : 'Prenotato'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setImageTableId(table.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <Image size={14} />
                        Foto
                      </button>
                      <Link
                        to={`/dashboard/events/${eventId}/reservations`}
                        className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        Prenotazioni
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
