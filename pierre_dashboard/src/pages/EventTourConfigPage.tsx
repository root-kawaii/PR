import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TourConfigurator from '../components/tour/TourConfigurator';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import type {
  Area,
  Club,
  EventResponse,
  MarzipanoScene,
  TableResponse,
  TourConfigPayload,
} from '../types';

interface TablesData {
  tables: TableResponse[];
}

export default function EventTourConfigPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { token } = useAuth();
  const { data: events, loading: eventsLoading, refetch: refetchEvents } = useFetch<
    EventResponse[]
  >('/owner/events');
  const { data: club } = useFetch<Club>('/owner/club');
  const { data: tables, loading: tablesLoading } = useFetch<TablesData>(
    eventId ? `/owner/events/${eventId}/tables` : '',
  );
  const { data: areas, loading: areasLoading } = useFetch<Area[]>('/owner/areas');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const event = events?.find((e) => e.id === eventId) ?? null;
  const loading = eventsLoading || tablesLoading || areasLoading;
  const isOverriding = !!event?.marzipanoScenes;
  const inheritedScenes =
    (event?.marzipanoScenes as MarzipanoScene[] | null) ??
    (club?.marzipanoScenes as MarzipanoScene[] | null) ??
    [];

  const putConfig = async (payload: TourConfigPayload) => {
    if (!eventId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/owner/events/${eventId}/marzipano-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOverride = async () => {
    if (!confirm('Rimuovere l\'override e tornare alla configurazione del club?')) return;
    await putConfig({ scenes: null, tablePositions: [], areaPositions: [] });
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link
            to={`/dashboard/events/${eventId}/tables`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Tavoli evento
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">
            Tour 360° – {event?.title ?? 'evento'}
          </h1>
          <p className="text-xs text-gray-500">
            {isOverriding
              ? 'Override attivo: questo evento ha una configurazione propria.'
              : 'Usa la configurazione del club. Modificando qui creerai un override.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Caricamento…</div>
      ) : (
        <TourConfigurator
          scope="event"
          initialScenes={inheritedScenes}
          tables={tables?.tables ?? []}
          areas={areas ?? []}
          saving={saving}
          onSave={putConfig}
          isOverriding={isOverriding}
          onResetOverride={handleResetOverride}
        />
      )}
    </div>
  );
}
