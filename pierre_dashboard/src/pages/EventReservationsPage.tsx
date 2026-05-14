import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import type { EventReservationStats, EventResponse, TableResponse } from '../types';
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

function formatEventDate(dateStr: string): string {
  const isoCandidate = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const d = new Date(isoCandidate);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
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

// Default gender split: 50/50 if even, the extra unit goes to male if odd.
function defaultGenderSplit(total: number): { male: number; female: number } {
  const safe = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const male = Math.ceil(safe / 2);
  const female = safe - male;
  return { male, female };
}

type SortKey =
  | 'reservationCode'
  | 'contactName'
  | 'table'
  | 'numPeople'
  | 'genderRatio'
  | 'amountPaid'
  | 'status'
  | 'createdAt';
type SortDir = 'asc' | 'desc';

const SORTABLE_COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'reservationCode', label: 'Codice' },
  { key: 'contactName', label: 'Cliente' },
  { key: 'table', label: 'Tavolo' },
  { key: 'numPeople', label: 'Persone' },
  { key: 'genderRatio', label: 'M/F' },
  { key: 'amountPaid', label: 'Importo' },
  { key: 'status', label: 'Stato' },
];

export default function EventReservationsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { token } = useAuth();

  const { data: reservationsData, loading, refetch } = useFetch<OwnerReservation[]>(
    `/owner/events/${eventId}/reservations`,
  );
  const { data: tablesData } = useFetch<TablesData>(`/owner/events/${eventId}/tables`);
  const { data: statsData } = useFetch<EventReservationStats>(`/owner/events/${eventId}/stats`);
  const { data: eventData } = useFetch<EventResponse>(`/events/${eventId}`);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAreaId, setFilterAreaId] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<OwnerReservation | null>(null);

  const [formTableId, setFormTableId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNumPeople, setFormNumPeople] = useState('1');
  const [formMaleCount, setFormMaleCount] = useState(1);
  const [formNotes, setFormNotes] = useState('');

  const [editTableId, setEditTableId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNumPeople, setEditNumPeople] = useState('1');
  const [editMaleCount, setEditMaleCount] = useState(0);
  const [editStatus, setEditStatus] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('pending');
  const [editNotes, setEditNotes] = useState('');

  const reservations = useMemo(() => reservationsData ?? [], [reservationsData]);
  const tables = useMemo(() => tablesData?.tables ?? [], [tablesData]);

  const getTable = (tableId: string) => tables.find(t => t.id === tableId);

  const areaOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tables) {
      if (t.areaId && t.areaName) {
        map.set(t.areaId, t.areaName);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'it'),
    );
  }, [tables]);

  useEffect(() => {
    if (loading || !eventId) {
      return;
    }

    trackEvent('owner_event_reservations_viewed', {
      event_id: eventId,
      reservation_count: reservations.length,
    });
  }, [eventId, loading, reservations.length]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const table = getTable(reservation.tableId);
      const tableLabel = table?.areaName ?? table?.name ?? '';
      const matchesSearch =
        needle === '' ||
        reservation.contactName.toLowerCase().includes(needle) ||
        reservation.reservationCode.toLowerCase().includes(needle) ||
        tableLabel.toLowerCase().includes(needle);
      const matchesStatus = filterStatus === 'all' || reservation.status === filterStatus;
      const matchesArea = filterAreaId === 'all' || table?.areaId === filterAreaId;
      return matchesSearch && matchesStatus && matchesArea;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, search, filterStatus, filterAreaId, tables]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;

    const valueFor = (r: OwnerReservation): string | number => {
      switch (sortKey) {
        case 'reservationCode':
          return r.reservationCode.toLowerCase();
        case 'contactName':
          return r.contactName.toLowerCase();
        case 'table': {
          const t = getTable(r.tableId);
          const area = t?.areaName ?? '';
          return `${area} · ${t?.name ?? ''}`.toLowerCase();
        }
        case 'numPeople':
          return r.numPeople;
        case 'genderRatio':
          return r.maleGuestCount * 1000 + r.femaleGuestCount;
        case 'amountPaid':
          return parseEuroAmount(r.amountPaid);
        case 'status':
          return r.status;
        case 'createdAt':
          return r.createdAt;
      }
    };

    return [...filtered].sort((a, b) => {
      const va = valueFor(a);
      const vb = valueFor(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb), 'it', { numeric: true }) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, tables]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortKey(null);
    setSortDir('asc');
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={12} className="text-gray-700" />
    ) : (
      <ArrowDown size={12} className="text-gray-700" />
    );
  };

  const resetForm = () => {
    setFormTableId('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNumPeople('1');
    setFormMaleCount(1);
    setFormNotes('');
  };

  const openEditModal = (reservation: OwnerReservation) => {
    setEditingReservation(reservation);
    setEditTableId(reservation.tableId);
    setEditName(reservation.contactName);
    setEditPhone(reservation.contactPhone);
    setEditEmail(reservation.contactEmail);
    setEditNumPeople(String(reservation.numPeople));
    setEditMaleCount(reservation.maleGuestCount);
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

  const handleNumPeopleChange = (
    raw: string,
    setNum: (v: string) => void,
    setMale: (v: number) => void,
  ) => {
    setNum(raw);
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      setMale(defaultGenderSplit(parsed).male);
    } else {
      setMale(0);
    }
  };

  const handleCreateManual = async (e: FormEvent) => {
    e.preventDefault();
    const numPeople = parseInt(formNumPeople, 10);
    if (!Number.isFinite(numPeople) || numPeople < 1) {
      alert('Inserire un numero di persone valido.');
      return;
    }
    const maleCount = Math.max(0, Math.min(numPeople, formMaleCount));
    const femaleCount = numPeople - maleCount;

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
          contact_phone: formPhone.trim() || undefined,
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
    if (!Number.isFinite(numPeople) || numPeople < 1) {
      alert('Inserire un numero di persone valido.');
      return;
    }
    const maleCount = Math.max(0, Math.min(numPeople, editMaleCount));
    const femaleCount = numPeople - maleCount;

    setUpdatingId(editingReservation.id);
    try {
      await patchReservation(editingReservation.id, {
        tableId: editTableId,
        contactName: editName,
        contactPhone: editPhone.trim() || undefined,
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

  const formNum = parseInt(formNumPeople, 10);
  const formTotal = Number.isFinite(formNum) && formNum > 0 ? formNum : 0;
  const formMale = Math.max(0, Math.min(formTotal, formMaleCount));
  const formFemale = formTotal - formMale;

  const editNum = parseInt(editNumPeople, 10);
  const editTotal = Number.isFinite(editNum) && editNum > 0 ? editNum : 0;
  const editMale = Math.max(0, Math.min(editTotal, editMaleCount));
  const editFemale = editTotal - editMale;

  return (
    <div>
      <div className="mb-6">
        <Link to="/dashboard/events" className={`${ui.backLink} mb-3`}>
          <ArrowLeft size={16} />
          Torna agli Eventi
        </Link>
        <PageHeader
          className="mb-0"
          title={eventData ? `Prenotazioni · ${eventData.title}` : 'Prenotazioni'}
          description={
            eventData
              ? `${formatEventDate(eventData.date)}${eventData.time ? ` · ${eventData.time}` : ''}${eventData.venue ? ` · ${eventData.venue}` : ''}`
              : 'Gestisci stato, area/tavolo e composizione delle prenotazioni della serata.'
          }
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
            value={filterAreaId}
            onChange={e => setFilterAreaId(e.target.value)}
            className={ui.select}
          >
            <option value="all">Tutte le aree</option>
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
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
        <span>{sorted.length} prenotazioni</span>
        <span>{sorted.reduce((sum, reservation) => sum + reservation.numPeople, 0)} persone totali</span>
      </div>

      {!sorted.length ? (
        <EmptyState
          title={reservations.length === 0 ? 'Nessuna prenotazione registrata' : 'Nessun risultato'}
          description={
            reservations.length === 0
              ? 'Per questa serata non ci sono ancora prenotazioni. Puoi inserirne una manualmente.'
              : 'Nessuna prenotazione corrisponde ai filtri attivi. Prova a modificare ricerca, area o stato.'
          }
        />
      ) : (
        <div className={ui.tableWrap}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th key={col.key} className={ui.tableHeader}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="group inline-flex items-center gap-1 hover:text-gray-900"
                      >
                        {col.label}
                        {renderSortIcon(col.key)}
                      </button>
                    </th>
                  ))}
                  <th className={ui.tableHeader}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((reservation) => {
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
                              {item.areaName ?? item.name} · {item.name}
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
                      {table.areaName ?? table.name} · {table.name} — cap. {table.capacity}
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
                    Telefono
                  </label>
                  <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+39 333 1234567" className={ui.input} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail size={14} className="inline mr-1" />
                    Email
                  </label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="mario@example.com" className={ui.input} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Persone *</label>
                <input
                  type="number"
                  min="1"
                  value={formNumPeople}
                  onChange={(e) => handleNumPeopleChange(e.target.value, setFormNumPeople, setFormMaleCount)}
                  required
                  className={ui.input}
                />
                <GenderSlider
                  total={formTotal}
                  male={formMale}
                  female={formFemale}
                  onChange={setFormMaleCount}
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
                      {table.areaName ?? table.name} · {table.name}
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
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className={ui.input} />
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
                  <input
                    type="number"
                    min="1"
                    value={editNumPeople}
                    onChange={(e) => handleNumPeopleChange(e.target.value, setEditNumPeople, setEditMaleCount)}
                    className={ui.input}
                  />
                </div>
              </div>

              <GenderSlider
                total={editTotal}
                male={editMale}
                female={editFemale}
                onChange={setEditMaleCount}
              />

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

interface GenderSliderProps {
  total: number;
  male: number;
  female: number;
  onChange: (male: number) => void;
}

function GenderSlider({ total, male, female, onChange }: GenderSliderProps) {
  const pct = total > 0 ? (male / total) * 100 : 50;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-blue-600 tabular-nums whitespace-nowrap">
          <span aria-hidden>♂</span> Maschi <strong>{male}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0, total)}
          step={1}
          value={male}
          disabled={total <= 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="gender-slider flex-1 disabled:opacity-50"
          style={{ ['--gender-pct' as string]: `${pct}%` }}
          aria-label="Ripartizione maschi/femmine"
        />
        <span className="text-xs text-pink-600 tabular-nums whitespace-nowrap">
          <strong>{female}</strong> Femmine <span aria-hidden>♀</span>
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        Lo slider regola la ripartizione M/F mantenendo sempre la somma uguale a Persone.
      </p>
    </div>
  );
}
