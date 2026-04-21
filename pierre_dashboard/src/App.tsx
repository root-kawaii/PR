import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import EventTablesPage from './pages/EventTablesPage';
import EventReservationsPage from './pages/EventReservationsPage';
import ClubSettingsPage from './pages/ClubSettingsPage';
import QRScannerPage from './pages/QRScannerPage';
import { trackScreen } from './config/analytics';

function RouteAnalyticsTracker() {
  const location = useLocation();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current === path) {
      return;
    }

    trackScreen(path);
    lastTrackedPathRef.current = path;
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteAnalyticsTracker />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/club" element={<ClubSettingsPage />} />
              <Route path="/dashboard/scan" element={<QRScannerPage />} />
              <Route path="/dashboard/events" element={<EventsPage />} />
              <Route path="/dashboard/events/:eventId/tables" element={<EventTablesPage />} />
              <Route path="/dashboard/events/:eventId/reservations" element={<EventReservationsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
