import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  X,
  Search,
  User,
  Phone,
  Mail,
  FileText,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { EventReservationStats, TableResponse } from '../types';
import { trackEvent } from '../config/analytics';
import { EmptyState, PageHeader, SectionCard } from '../components/ui';
import { ui } from '../components/ui-classes';

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
  maleGuestCount: number;
  femaleGuestCount: number;
  createdAt: string;
}

interface TablesData {
  tables: TableResponse[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa',
  confirmed: 'Prenotato',
  completed: 'Accesso effettuato',
  cancelled: 'Rifiutato',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const parseEuroAmount = (value: string | number) =>
  Number.parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;

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

  const { data: reservationsData, loading, refetch } = useFetch<OwnerReservation[]>(
    `/owner/events/${eventId}/reservations`,
  );
  const { data: tablesData } = useFetch<TablesData>(`/owner/events/${eventId}/tables`);
  const { data: statsData } = useFetch<EventReservationStats>(`/owner/events/${eventId}/stats`);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<OwnerReservation | null>(null);

  const [formTableId, setFormTableId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNumPeople, setFormNumPeople] = useState('1');
  const [formMaleCount, setFormMaleCount] = useState('0');
  const [formFemaleCount, setFormFemaleCount] = useState('0');
  const [formNotes, setFormNotes] = useState('');

  const [editTableId, setEditTableId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNumPeople, setEditNumPeople] = useState('1');
  const [editMaleCount, setEditMaleCount] = useState('0');
  const [editFemaleCount, setEditFemaleCount] = useState('0');
  const [editStatus, setEditStatus] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('pending');
  const [editNotes, setEditNotes] = useState('');

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

  const filtered = reservations.filter((reservation) => {
    const table = getTable(reservation.tableId);
    const tableLabel = table?.areaName ?? table?.zone ?? table?.name ?? '';
    const matchesSearch =
      search === '' ||
      reservation.contactName.toLowerCase().includes(search.toLowerCase()) ||
      reservation.reservationCode.toLowerCase().includes(search.toLowerCase()) ||
      tableLabel.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || reservation.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const validateGenderCounts = (numPeople: number, maleCount: number, femaleCount: number) => {
    if (maleCount < 0 || femaleCount < 0) {
      return 'I contatori M/F non possono essere negativi.';
    }

    if (maleCount + femaleCount > numPeople) {
      return 'La somma di maschi e femmine non puo superare il totale persone.';
    }

    return null;
  };

  const resetForm = () => {
    setFormTableId('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNumPeople('1');
    setFormMaleCount('0');
    setFormFemaleCount('0');
    setFormNotes('');
  };

  const openEditModal = (reservation: OwnerReservation) => {
    setEditingReservation(reservation);
    setEditTableId(reservation.tableId);
    setEditName(reservation.contactName);
    setEditPhone(reservation.contactPhone);
    setEditEmail(reservation.contactEmail);
    setEditNumPeople(String(reservation.numPeople));
    setEditMaleCount(String(reservation.maleGuestCount));
    setEditFemaleCount(String(reservation.femaleGuestCount));
    setEditStatus(reservation.status);
    setEditNotes(reservation.manualNotes ?? reservation.specialRequests ?? '');
  };

  const closeEditModal = () => {
    setEditingReservation(null);
  };

  const patchReservation = async (reservationId: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/owner/reservations/${reservationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error('Errore aggiornamento prenotazione');
    }
  };

  const handleCreateManual = async (e: FormEvent) => {
    e.preventDefault();
    const numPeople = parseInt(formNumPeople, 10);
    const maleCount = parseInt(formMaleCount, 10);
    const femaleCount = parseInt(formFemaleCount, 10);
    const validationError = validateGenderCounts(numPeople, maleCount, femaleCount);

    if (validationError) {
      alert(validationError);
      return;
    }

    setSubmitting(true);
    trackEvent('owner_manual_reservation_create_submitted', {
      event_id: eventId ?? null,
      table_id: formTableId || null,
      num_people: numPeople,
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
          num_people: numPeople,
          manual_notes: formNotes || undefined,
          male_guest_count: maleCount,
          female_guest_count: femaleCount,
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
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTableChange = async (reservationId: string, tableId: string) => {
    setUpdatingId(reservationId);
    trackEvent('owner_reservation_table_change_submitted', {
      reservation_id: reservationId,
      table_id: tableId,
    });
    try {
      await patchReservation(reservationId, { tableId });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingReservation) return;

    const numPeople = parseInt(editNumPeople, 10);
    const maleCount = parseInt(editMaleCount, 10);
    const femaleCount = parseInt(editFemaleCount, 10);
    const validationError = validateGenderCounts(numPeople, maleCount, femaleCount);
    if (validationError) {
      alert(validationError);
      return;
    }

    setUpdatingId(editingReservation.id);
    try {
      await patchReservation(editingReservation.id, {
        tableId: editTableId,
        contactName: editName,
        contactPhone: editPhone,
        contactEmail: editEmail || undefined,
        numPeople,
        maleGuestCount: maleCount,
        femaleGuestCount: femaleCount,
        status: editStatus,
        manualNotes: editNotes || undefined,
      });
      closeEditModal();
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (reservation: OwnerReservation) => {
    if (!confirm(`Eliminare la prenotazione ${reservation.reservationCode}?`)) {
      return;
    }

    setUpdatingId(reservation.id);
    try {
      const res = await fetch(`${API_URL}/owner/reservations/${reservation.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Errore eliminazione');
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <div className={ui.helperText}>Caricamento prenotazioni...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to={`/dashboard/events/${eventId}/tables`} className={`${ui.backLink} mb-3`}>
          <ArrowLeft size={16} />
          Torna ai Tavoli
        </Link>
        <PageHeader
          className="mb-0"
          title="Prenotazioni"
          description="Gestisci stato, area/tavolo e composizione delle prenotazioni della serata."
          action={
            <button onClick={() => setShowForm(true)} className={ui.primaryButton}>
              <Plus size={18} />
              Prenotazione manuale
            </button>
          }
        />
      </div>

      {statsData && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <SectionCard className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Prenotazioni</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{statsData.totalReservations}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Persone</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{statsData.totalPeople}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">M/F</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {statsData.maleGuests} / {statsData.femaleGuests}
            </p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Incassato</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {parseEuroAmount(statsData.amountPaid).toFixed(2)} €
            </p>
          </SectionCard>
        </div>
      )}

      <SectionCard className="mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nome, codice o area..."
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
            <option value="confirmed">Prenotato</option>
            <option value="completed">Accesso effettuato</option>
            <option value="cancelled">Rifiutato</option>
          </select>
        </div>
      </SectionCard>

      <div className={`mb-4 flex gap-4 text-sm text-gray-500 ${ui.tabularNums}`}>
        <span>{filtered.length} prenotazioni</span>
        <span>{filtered.reduce((sum, reservation) => sum + reservation.numPeople, 0)} persone totali</span>
      </div>

      {!filtered.length ? (
        <EmptyState
          title={reservations.length === 0 ? 'Nessuna prenotazione registrata' : 'Nessun risultato'}
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
                  <th className={ui.tableHeader}>M/F</th>
                  <th className={ui.tableHeader}>Importo</th>
                  <th className={ui.tableHeader}>Stato</th>
                  <th className={ui.tableHeader}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((reservation) => {
                  const table = getTable(reservation.tableId);
                  return (
                    <tr
                      key={reservation.id}
                      className={`${ui.tableRow} ${reservation.isManual ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className={`${ui.tableCell} ${ui.tabularNums}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-gray-700">{reservation.reservationCode}</span>
                          {reservation.isManual && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                              Manuale
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={ui.tableCell}>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{reservation.contactName}</p>
                          {reservation.contactPhone && (
                            <p className="text-xs text-gray-400">{reservation.contactPhone}</p>
                          )}
                        </div>
                      </td>
                      <td className={ui.tableCell}>
                        <select
                          disabled={updatingId === reservation.id}
                          value={reservation.tableId}
                          onChange={e => handleTableChange(reservation.id, e.target.value)}
                          className={`${ui.select} min-h-8 py-1.5 text-xs min-w-44`}
                        >
                          {tables.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.areaName ?? item.zone ?? item.name} · {item.name}
                            </option>
                          ))}
                        </select>
                        {table?.areaName && (
                          <p className="mt-1 text-xs text-gray-400">{table.areaName}</p>
                        )}
                      </td>
                      <td className={`${ui.tableCell} ${ui.tabularNums}`}>{reservation.numPeople}</td>
                      <td className={`${ui.tableCell} ${ui.tabularNums}`}>
                        {reservation.maleGuestCount}/{reservation.femaleGuestCount}
                      </td>
                      <td className={`${ui.tableCell} ${ui.tabularNums}`}>
                        <div>
                          <span className="font-medium">{reservation.amountPaid}</span>
                          {getReservationPaymentNote(reservation) && (
                            <span className="text-amber-600 text-xs block">
                              {getReservationPaymentNote(reservation)}
                            </span>
                          )}
                          {reservation.amountRemaining !== '0.00 €' && reservation.amountRemaining !== '€0.00' && (
                            <span className="text-red-500 text-xs block">da pagare: {reservation.amountRemaining}</span>
                          )}
                        </div>
                      </td>
                      <td className={ui.tableCell}>
                        <select
                          disabled={updatingId === reservation.id}
                          value={reservation.status}
                          onChange={e => handleStatusChange(reservation.id, e.target.value)}
                          className={`${ui.select} min-h-8 py-1.5 text-xs`}
                        >
                          <option value="pending">In attesa</option>
                          <option value="confirmed">Prenotato</option>
                          <option value="completed">Accesso effettuato</option>
                          <option value="cancelled">Rifiutato</option>
                        </select>
                        <span className={`mt-1 inline-block px-2 py-1 text-xs rounded-full font-medium ${STATUS_COLORS[reservation.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {getReservationStatusLabel(reservation)}
                        </span>
                      </td>
                      <td className={ui.tableCell}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(reservation)}
                            className={ui.iconButton}
                            title="Modifica prenotazione"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(reservation)}
                            className={`${ui.iconButton} text-red-600 hover:text-red-700`}
                            title="Elimina prenotazione"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <select value={formTableId} onChange={e => setFormTableId(e.target.value)} required className={ui.select}>
                  <option value="">Seleziona tavolo</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.areaName ?? table.zone ?? table.name} · {table.name} — cap. {table.capacity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User size={14} className="inline mr-1" />
                  Nome cliente *
                </label>
                <input value={formName} onChange={e => setFormName(e.target.value)} required placeholder="Mario Rossi" className={ui.input} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone size={14} className="inline mr-1" />
                    Telefono *
                  </label>
                  <input value={formPhone} onChange={e => setFormPhone(e.target.value)} required placeholder="+39 333 1234567" className={ui.input} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail size={14} className="inline mr-1" />
                    Email
                  </label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="mario@example.com" className={ui.input} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persone *</label>
                  <input type="number" min="1" value={formNumPeople} onChange={e => setFormNumPeople(e.target.value)} required className={ui.input} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maschi</label>
                  <input type="number" min="0" value={formMaleCount} onChange={e => setFormMaleCount(e.target.value)} className={ui.input} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Femmine</label>
                  <input type="number" min="0" value={formFemaleCount} onChange={e => setFormFemaleCount(e.target.value)} className={ui.input} />
                </div>
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
                  placeholder="Es. Ha chiamato giovedi sera, richiede angolo tranquillo..."
                  className={`${ui.textarea} resize-none`}
                />
              </div>

              <button type="submit" disabled={submitting} className={`${ui.primaryButton} w-full`}>
                {submitting ? 'Creazione...' : 'Crea Prenotazione'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingReservation && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalPanel}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Modifica Prenotazione</h2>
              <button onClick={closeEditModal} className={ui.iconButton}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tavolo</label>
                <select value={editTableId} onChange={e => setEditTableId(e.target.value)} className={ui.select}>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.areaName ?? table.zone ?? table.name} · {table.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome cliente</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} required className={ui.input} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} required className={ui.input} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className={ui.input} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value as typeof editStatus)} className={ui.select}>
                    <option value="pending">In attesa</option>
                    <option value="confirmed">Prenotato</option>
                    <option value="completed">Accesso effettuato</option>
                    <option value="cancelled">Rifiutato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persone</label>
                  <input type="number" min="1" value={editNumPeople} onChange={e => setEditNumPeople(e.target.value)} className={ui.input} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maschi</label>
                  <input type="number" min="0" value={editMaleCount} onChange={e => setEditMaleCount(e.target.value)} className={ui.input} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Femmine</label>
                  <input type="number" min="0" value={editFemaleCount} onChange={e => setEditFemaleCount(e.target.value)} className={ui.input} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className={`${ui.textarea} resize-none`} />
              </div>

              <button type="submit" disabled={updatingId === editingReservation.id} className={`${ui.primaryButton} w-full`}>
                {updatingId === editingReservation.id ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
