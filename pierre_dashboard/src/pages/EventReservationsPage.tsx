import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X, Search, User, Phone, Mail, FileText } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { TableResponse } from '../types';
import { trackEvent } from '../config/analytics';
import { EmptyState, PageHeader, SectionCard } from '../components/ui';
import { ui } from '../components/ui-classes';

// Matches the flat TableReservationResponse from the backend
interface OwnerReservation {
  id: string;
  reservationCode: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  numPeople: number;
  totalAmount: string;
  amountPaid: string;
  amountRemaining: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  specialRequests?: string;
  tableId: string;
  eventId: string;
  isManual: boolean;
  manualNotes?: string;
  createdAt: string;
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

const parseEuroAmount = (value: string) =>
  Number.parseFloat(value.replace(/[^0-9.]/g, '')) || 0;

function getReservationStatusLabel(reservation: OwnerReservation): string {
  if (
    reservation.status === 'pending' &&
    parseEuroAmount(reservation.amountPaid) > 0 &&
    parseEuroAmount(reservation.amountRemaining) > 0
  ) {
    return 'In attesa quote';
  }

  return STATUS_LABELS[reservation.status] ?? reservation.status;
}

function getReservationPaymentNote(reservation: OwnerReservation): string | null {
  if (
    reservation.status === 'pending' &&
    parseEuroAmount(reservation.amountPaid) > 0 &&
    parseEuroAmount(reservation.amountRemaining) > 0
  ) {
    return 'quota iniziale ricevuta';
  }

  return null;
}

export default function EventReservationsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { token } = useAuth();

  const { data: reservationsData, loading, refetch } = useFetch<OwnerReservation[]>(`/owner/events/${eventId}/reservations`);
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

  const reservations = reservationsData ?? [];
  const tables = tablesData?.tables ?? [];

  const getTable = (tableId: string) => tables.find(t => t.id === tableId);

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
    const table = getTable(r.tableId);
    const matchesSearch =
      search === '' ||
      r.contactName.toLowerCase().includes(search.toLowerCase()) ||
      r.reservationCode.toLowerCase().includes(search.toLowerCase()) ||
      (table?.name ?? '').toLowerCase().includes(search.toLowerCase());
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
    return <div className={ui.helperText}>Caricamento prenotazioni...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to={`/dashboard/events/${eventId}/tables`}
          className={`${ui.backLink} mb-3`}
        >
          <ArrowLeft size={16} />
          Torna ai Tavoli
        </Link>
        <PageHeader
          className="mb-0"
          title="Prenotazioni"
          description="Consulta le richieste per tavolo, controlla quote pagate e aggiorna rapidamente lo stato di ogni prenotazione."
          action={
            <button
              onClick={() => setShowForm(true)}
              className={ui.primaryButton}
            >
              <Plus size={18} />
              Prenotazione manuale
            </button>
          }
        />
      </div>

      {/* Filters */}
      <SectionCard className="mb-4 p-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, codice o tavolo..."
            className={`${ui.input} pl-9`}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className={ui.select}
        >
          <option value="all">Tutti gli stati</option>
          <option value="pending">In attesa</option>
          <option value="confirmed">Confermata</option>
          <option value="completed">Completata</option>
          <option value="cancelled">Cancellata</option>
        </select>
      </div>
      </SectionCard>

      {/* Summary bar */}
      <div className={`mb-4 flex gap-4 text-sm text-gray-500 ${ui.tabularNums}`}>
        <span>{filtered.length} prenotazioni</span>
        <span>
          {filtered.reduce((sum, r) => sum + r.numPeople, 0)} persone totali
        </span>
      </div>

      {/* Table */}
      {!filtered.length ? (
        <EmptyState
          title={
            reservations.length === 0
              ? 'Nessuna prenotazione registrata'
              : 'Nessun risultato'
          }
          description={
            reservations.length === 0
              ? 'Per questa serata non ci sono ancora prenotazioni. Puoi inserirne una manualmente.'
              : 'Nessuna prenotazione corrisponde ai filtri attivi. Prova a modificare ricerca o stato.'
          }
        />
      ) : (
        <div className={ui.tableWrap}>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={ui.tableHeader}>Codice</th>
                <th className={ui.tableHeader}>Cliente</th>
                <th className={ui.tableHeader}>Tavolo</th>
                <th className={ui.tableHeader}>Persone</th>
                <th className={ui.tableHeader}>Importo</th>
                <th className={ui.tableHeader}>Stato</th>
                <th className={ui.tableHeader}>Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className={`${ui.tableRow} ${r.isManual ? 'bg-amber-50/30' : ''}`}>
                  <td className={`${ui.tableCell} ${ui.tabularNums}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-700">{r.reservationCode}</span>
                      {r.isManual && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          Manuale
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={ui.tableCell}>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{r.contactName}</p>
                      {r.contactPhone && (
                        <p className="text-xs text-gray-400">{r.contactPhone}</p>
                      )}
                    </div>
                  </td>
                  <td className={ui.tableCell}>
                    {getTable(r.tableId)?.name ?? r.tableId}
                    {getTable(r.tableId)?.zone && <span className="text-gray-400"> · {getTable(r.tableId)?.zone}</span>}
                  </td>
                  <td className={`${ui.tableCell} ${ui.tabularNums}`}>{r.numPeople}</td>
                  <td className={`${ui.tableCell} ${ui.tabularNums}`}>
                    <div>
                      <span className="font-medium">{r.amountPaid}</span>
                      {getReservationPaymentNote(r) && (
                        <span className="text-amber-600 text-xs block">{getReservationPaymentNote(r)}</span>
                      )}
                      {r.amountRemaining !== '0.00 €' && r.amountRemaining !== '€0.00' && (
                        <span className="text-red-500 text-xs block">da pagare: {r.amountRemaining}</span>
                      )}
                    </div>
                  </td>
                  <td className={ui.tableCell}>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {getReservationStatusLabel(r)}
                    </span>
                  </td>
                  <td className={ui.tableCell}>
                    <div className="relative max-w-[150px]">
                      <select
                        disabled={updatingId === r.id}
                        value={r.status}
                        onChange={e => handleStatusChange(r.id, e.target.value)}
                        className={`${ui.select} min-h-8 py-1.5 text-xs`}
                      >
                        <option value="pending">In attesa</option>
                        <option value="confirmed">Confermata</option>
                        <option value="completed">Completata</option>
                        <option value="cancelled">Cancellata</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Manual reservation modal */}
      {showForm && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalPanel}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Prenotazione Manuale</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className={ui.iconButton}>
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
                  className={ui.select}
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
                  className={ui.input}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone size={14} className="inline mr-1" />
                    Telefono *
                  </label>
                  <input
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    required
                    placeholder="+39 333 1234567"
                    className={ui.input}
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
                    className={ui.input}
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
                  className={ui.input}
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
                  className={`${ui.textarea} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`${ui.primaryButton} w-full`}
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
