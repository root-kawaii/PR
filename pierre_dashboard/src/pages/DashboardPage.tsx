import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import type { Club } from '../types';
import { trackEvent } from '../config/analytics';

export default function DashboardPage() {
  const { owner } = useAuth();
  const { data: club, loading, error } = useFetch<Club>('/owner/club');

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Club header with image */}
        {club?.image && (
          <div className="h-48 overflow-hidden">
            <img
              src={club.image}
              alt={club.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900">{club?.name}</h2>
          {club?.subtitle && (
            <p className="text-gray-500 mt-1">{club.subtitle}</p>
          )}

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
    </div>
  );
}
