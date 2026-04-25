import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import TourConfigurator from '../components/tour/TourConfigurator';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import type { Area, Club, MarzipanoScene, TourConfigPayload } from '../types';

export default function ClubTourConfigPage() {
  const { token } = useAuth();
  const { data: club, loading: clubLoading, refetch: refetchClub } = useFetch<Club>('/owner/club');
  const { data: areas, loading: areasLoading } = useFetch<Area[]>('/owner/areas');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = clubLoading || areasLoading;

  const handleSave = async (payload: TourConfigPayload) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/owner/club/marzipano-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchClub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link
            to="/dashboard/club"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Impostazioni club
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Tour 360° del club</h1>
          <p className="text-xs text-gray-500">
            Configurazione condivisa da tutti gli eventi. Un singolo evento può sovrascriverla.
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
          scope="club"
          initialScenes={(club?.marzipanoScenes as MarzipanoScene[] | null) ?? []}
          tables={[]}
          areas={areas ?? []}
          saving={saving}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
