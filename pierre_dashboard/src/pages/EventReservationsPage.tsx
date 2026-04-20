import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X, Search, User, Phone, Mail, FileText, ChevronDown } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { TableReservation, TableResponse } from '../types';
import { trackEvent } from '../config/analytics';

interface ReservationsData {
  reservations: TableReservation[];
}

interface TablesData {
  tables: TableResponse[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa',
  confirmed: 'Confermata',
  completed: 'Completata',
  cancelled: 'Cancellata',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function EventReservationsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { token } = useAuth();

  const { data, loading, refetch } = useFetch<ReservationsData>(`/owner/events/${eventId}/reservations`);
  const { data: tablesData } = useFetch<TablesData>(`/owner/events/${eventId}/tables`);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual reservation form
  const [formTableId, setFormTableId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNumPeople, setFormNumPeople] = useState('1');
  const [formNotes, setFormNotes] = useState('');

  // Status change
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const reservations = data?.reservations ?? [];
  const tables = tablesData?.tables ?? [];

  useEffect(() => {
    if (loading || !eventId) {
      return;
    }

    trackEvent('owner_event_reservations_viewed', {
      event_id: eventId,
      reservation_count: reservations.length,
    });
  }, [eventId, loading, reservations.length]);

  const filtered = reservations.filter((r) => {
    const matchesSearch =
      search === '' ||
      r.contactName.toLowerCase().includes(search.toLowerCase()) ||
      r.reservationCode.toLowerCase().includes(search.toLowerCase()) ||
      r.table.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateManual = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    trackEvent('owner_manual_reservation_create_submitted', {
      event_id: eventId ?? null,
      table_id: formTableId || null,
      num_people: parseInt(formNumPeople, 10),
    });
    try {
      const res = await fetch(`${API_URL}/owner/events/${eventId}/reservations/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          table_id: formTableId,
          contact_name: formName,
          contact_phone: formPhone || undefined,
          contact_email: formEmail || undefined,
          num_people: parseInt(formNumPeople),
          manual_notes: formNotes || undefined,
          is_manual: true,
        }),
      });
      if (!res.ok) throw new Error('Errore nella creazione');
      trackEvent('owner_manual_reservation_created', {
        event_id: eventId ?? null,
        table_id: formTableId || null,
      });
      resetForm();
      setShowForm(false);
      refetch();
    } catch (err) {
      trackEvent('owner_manual_reservation_create_failed', {
        event_id: eventId ?? null,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (reservationId: string, newStatus: string) => {
    setUpdatingId(reservationId);
    trackEvent('owner_reservation_status_update_submitted', {
      reservation_id: reservationId,
      status: newStatus,
    });
    try {
      const res = await fetch(`${API_URL}/owner/reservations/${reservationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Errore aggiornamento');
      trackEvent('owner_reservation_status_updated', {
        reservation_id: reservationId,
        status: newStatus,
      });
      refetch();
    } catch (err) {
      trackEvent('owner_reservation_status_update_failed', {
        reservation_id: reservationId,
        status: newStatus,
        error_message: err instanceof Error ? err.message : 'Errore',
      });
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setUpdatingId(null);
    }
  };

  const resetForm = () => {
    setFormTableId('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNumPeople('1');
    setFormNotes('');
  };

  if (loading) {
    return <div className="text-gray-500">Caricamento...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to={`/dashboard/events/${eventId}/tables`}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-3"
        >
          <ArrowLeft size={16} />
          Torna ai Tavoli
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Prenotazioni</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={18} />
            Prenotazione Manuale
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, codice o tavolo..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm bg-white"
        >
          <option value="all">Tutti gli stati</option>
          <option value="pending">In attesa</option>
          <option value="confirmed">Confermata</option>
          <option value="completed">Completata</option>
          <option value="cancelled">Cancellata</option>
        </select>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 mb-4 text-sm text-gray-500">
        <span>{filtered.length} prenotazioni</span>
        <span>
          {filtered.reduce((sum, r) => sum + r.numPeople, 0)} persone totali
        </span>
      </div>

      {/* Table */}
      {!filtered.length ? (
        <p className="text-gray-500">
          {reservations.length === 0
            ? 'Nessuna prenotazione per questa serata.'
            : 'Nessun risultato per i filtri applicati.'}
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Codice</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tavolo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Persone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Importo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stato</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.isManual ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-700">{r.reservationCode}</span>
                      {r.isManual && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          Manuale
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{r.contactName}</p>
                      {r.contactPhone && (
                        <p className="text-xs text-gray-400">{r.contactPhone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {r.table.name}
                    {r.table.zone && <span className="text-gray-400"> · {r.table.zone}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{r.numPeople}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    <div>
                      <span className="font-medium">{r.amountPaid}</span>
                      {r.amountRemaining !== '0.00 €' && r.amountRemaining !== '€0.00' && (
                        <span className="text-red-500 text-xs block">da pagare: {r.amountRemaining}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <select
                        disabled={updatingId === r.id}
                        value={r.status}
                        onChange={e => handleStatusChange(r.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 bg-white cursor-pointer disabled:opacity-50"
                      >
                        <option value="pending">In attesa</option>
                        <option value="confirmed">Confirma</option>
                        <option value="completed">Completa</option>
                        <option value="cancelled">Cancella</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual reservation modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Prenotazione Manuale</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateManual} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tavolo *</label>
                <select
                  value={formTableId}
                  onChange={e => setFormTableId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 bg-white"
                >
                  <option value="">Seleziona tavolo</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.zone ? ` (${t.zone})` : ''} — cap. {t.capacity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User size={14} className="inline mr-1" />
                  Nome cliente *
                </label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  placeholder="Mario Rossi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone size={14} className="inline mr-1" />
                    Telefono
                  </label>
                  <input
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+39 333 1234567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail size={14} className="inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="mario@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero persone *</label>
                <input
                  type="number"
                  min="1"
                  value={formNumPeople}
                  onChange={e => setFormNumPeople(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText size={14} className="inline mr-1" />
                  Note interne
                </label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Es. Ha chiamato giovedì sera, richiede angolo tranquillo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {submitting ? 'Creazione...' : 'Crea Prenotazione'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
