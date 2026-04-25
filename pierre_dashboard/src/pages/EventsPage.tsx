import { useEffect, useState, useMemo, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight, X, Pencil, Trash2 } from "lucide-react";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/api";
import type { EventResponse } from "../types";
import { trackEvent } from "../config/analytics";

const MONTH_MAP: Record<string, number> = {
  GEN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAG: 4,
  GIU: 5,
  LUG: 6,
  AGO: 7,
  SET: 8,
  OTT: 9,
  NOV: 10,
  DIC: 11,
};

function extractEventDate(dateStr: string): string | null {
  try {
    if (dateStr.includes("T")) return dateStr.split("T")[0];
    if (dateStr.includes(" ") && !dateStr.includes("|")) {
      const part = dateStr.split(" ")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{1,2}\s+[A-Z]{3}/.test(dateStr)) {
      const parts = dateStr.split("|")[0].trim().split(/\s+/);
      if (parts.length < 2) return null;
      const day = parseInt(parts[0]);
      const month = MONTH_MAP[parts[1]];
      if (month === undefined || isNaN(day)) return null;
      const now = new Date();
      const year =
        month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  } catch {
    return null;
  }
}

function extractEventTime(dateStr: string): string {
  if (dateStr.includes("T")) {
    const part = dateStr.split("T")[1];
    return part ? part.slice(0, 5) : "";
  }
  if (dateStr.includes("|")) {
    return dateStr.split("|")[1]?.trim() ?? "";
  }
  return "";
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface EventFormData {
  title: string;
  venue: string;
  date: string;
  time: string;
  end_time: string;
  image: string;
  status: string;
  age_limit: string;
  price: string;
  description: string;
}

const emptyForm: EventFormData = {
  title: "",
  venue: "",
  date: "",
  time: "",
  end_time: "",
  image: "",
  status: "",
  age_limit: "",
  price: "",
  description: "",
};

export default function EventsPage() {
  const {
    data: events,
    loading,
    refetch,
  } = useFetch<EventResponse[]>("/owner/events");
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventResponse | null>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filterDate, setFilterDate] = useState(todayStr());

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return true;
      return eventDate >= filterDate;
    });
  }, [events, filterDate]);

  const closeForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setForm(emptyForm);
  };

  useEffect(() => {
    if (loading || !events) {
      return;
    }

    trackEvent("owner_events_list_viewed", {
      event_count: events.length,
      filtered_count: filteredEvents.length,
      filter_date: filterDate,
    });
  }, [events, filteredEvents.length, filterDate, loading]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (e: React.MouseEvent, event: EventResponse) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingEvent(event);
    setForm({
      title: event.title,
      venue: event.venue,
      date: extractEventDate(event.date) ?? "",
      time: event.time ?? extractEventTime(event.date),
      end_time: event.endTime ?? "",
      image: event.image,
      status: event.status ?? "",
      age_limit: event.ageLimit ?? "",
      price: event.price ?? "",
      description: event.description ?? "",
    });
    setShowForm(true);
  };

  const handleDelete = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        "Eliminare questo evento? Tutti i tavoli e le prenotazioni associate verranno eliminati.",
      )
    )
      return;
    try {
      const res = await fetch(`${API_URL}/owner/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Impossibile eliminare l'evento");
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const dateToSend = form.time ? `${form.date}T${form.time}:00` : form.date;
      const body = {
        title: form.title,
        venue: form.venue,
        date: dateToSend,
        image: form.image,
        status: form.status,
        age_limit: form.age_limit,
        end_time: form.end_time,
        price: form.price,
        description: form.description,
      };

      trackEvent("owner_event_create_submitted", {
        has_price: Boolean(form.price),
        has_description: Boolean(form.description),
      });

      const url = editingEvent
        ? `${API_URL}/owner/events/${editingEvent.id}`
        : `${API_URL}/owner/events`;
      const method = editingEvent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok)
        throw new Error(
          editingEvent
            ? "Impossibile aggiornare l'evento"
            : "Impossibile creare l'evento",
        );
      trackEvent("owner_event_created", {
        title: form.title,
        venue: form.venue,
      });
      closeForm();
      refetch();
    } catch (err) {
      trackEvent("owner_event_create_failed", {
        error_message: err instanceof Error ? err.message : "Errore",
      });
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Caricamento...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <button
          onClick={openCreate}
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

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingEvent ? "Edit Event" : "Create Event"}
              </h2>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue *
                </label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End time
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      setForm({ ...form, end_time: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age limit
                  </label>
                  <input
                    type="text"
                    value={form.age_limit}
                    onChange={(e) =>
                      setForm({ ...form, age_limit: e.target.value })
                    }
                    placeholder="18+"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  >
                    <option value="">None</option>
                    <option value="HOT">HOT</option>
                    <option value="SOLD OUT">SOLD OUT</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="text"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="es. 15 €"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL *
                </label>
                <input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {submitting
                  ? editingEvent
                    ? "Saving..."
                    : "Creating..."
                  : editingEvent
                    ? "Save Changes"
                    : "Create Event"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Events list */}
      {!filteredEvents.length ? (
        <p className="text-gray-500">
          {events?.length
            ? "No events from this date onwards."
            : "No events yet. Create your first event."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const displayTime = event.time ?? extractEventTime(event.date);
            return (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
              >
                <Link
                  to={`/dashboard/events/${event.id}/tables`}
                  className="block"
                >
                  {event.image && (
                    <div className="h-40 overflow-hidden">
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">{event.title}</h3>
                      <ChevronRight
                        size={18}
                        className="text-gray-400 group-hover:text-gray-600"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{event.venue}</p>
                    <p className="text-sm text-gray-500">
                      {extractEventDate(event.date) ?? event.date}
                      {displayTime && ` · ${displayTime}`}
                      {event.endTime && ` → ${event.endTime}`}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {event.status && (
                        <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded font-medium">
                          {event.status}
                        </span>
                      )}
                      {event.ageLimit && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {event.ageLimit}
                        </span>
                      )}
                      {event.price && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {event.price}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="px-4 pb-3 pt-2 flex gap-2 justify-end border-t border-gray-100">
                  <button
                    onClick={(e) => openEdit(e, event)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, event.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
