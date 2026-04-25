import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, QrCode } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { club } = useAuth();
  const location = useLocation();
  const isOnScanPage = location.pathname === '/dashboard/scan';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center justify-between px-4 h-14">
        <span className="font-bold text-sm truncate">{club?.name || 'Dashboard'}</span>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <main className="flex-1 p-4 md:p-8 pt-18 md:pt-8">
        <Outlet />
      </main>

      {/* Floating QR scanner button — mobile only, hidden on scan page */}
      {!isOnScanPage && (
        <Link
          to="/dashboard/scan"
          className="md:hidden fixed bottom-6 right-6 z-30 bg-violet-600 hover:bg-violet-700 text-white rounded-full p-4 shadow-xl transition-colors"
          aria-label="Scanner QR"
        >
          <QrCode size={24} />
        </Link>
      )}
    </div>
  );
}
