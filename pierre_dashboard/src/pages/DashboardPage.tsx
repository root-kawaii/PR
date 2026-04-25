import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { Link } from 'react-router-dom';
import { CalendarDays, Users, TrendingUp } from 'lucide-react';
import type { Club, OwnerStats } from '../types';
import { trackEvent } from '../config/analytics';

export default function DashboardPage() {
  const { owner } = useAuth();
  const { data: club, loading, error } = useFetch<Club>('/owner/club');
  const { data: stats } = useFetch<OwnerStats>('/owner/stats');

  useEffect(() => {
    if (loading || !owner) {
      return;
    }

    trackEvent('owner_dashboard_loaded', {
      owner_id: owner.id,
      club_id: club?.id ?? null,
      has_club_image: Boolean(club?.image),
    });
  }, [club?.id, club?.image, loading, owner]);

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Club card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        {club?.image && (
          <div className="h-48 overflow-hidden">
            <img src={club.image} alt={club.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900">{club?.name}</h2>
          {club?.subtitle && <p className="text-gray-500 mt-1">{club.subtitle}</p>}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Owner</p>
              <p className="font-medium text-gray-900">{owner?.name}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{owner?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <Users size={22} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Prenotazioni attive</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeReservations}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
              <div className="bg-green-50 rounded-lg p-3">
                <TrendingUp size={22} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ricavi totali</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRevenue} €</p>
              </div>
            </div>
          </div>

          {/* Events summary */}
          {stats.events.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <CalendarDays size={18} className="text-gray-500" />
                <h3 className="font-semibold text-gray-900">Ultimi eventi</h3>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Evento</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Tavoli</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.events.map((ev) => (
                    <tr key={ev.eventId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 text-sm">{ev.title}</td>
                      <td className="px-5 py-3 text-gray-500 text-sm">
                        {new Date(ev.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className={`font-medium ${ev.reservedTables > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {ev.reservedTables}
                        </span>
                        <span className="text-gray-400"> / {ev.totalTables}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          to={`/dashboard/events/${ev.eventId}/reservations`}
                          className="text-xs text-gray-500 hover:text-gray-800 underline"
                        >
                          Prenotazioni
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
