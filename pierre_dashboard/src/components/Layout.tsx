import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, QrCode } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { ui } from './ui-classes';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { club } = useAuth();
  const location = useLocation();
  const isOnScanPage = location.pathname === '/dashboard/scan';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-gray-800 bg-gray-900/98 px-4 text-white backdrop-blur">
        <span className="font-bold text-sm truncate">{club?.name || 'Dashboard'}</span>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-xl text-gray-200 transition-colors hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <main className="flex-1 p-4 pt-[72px] md:p-8 md:pt-8">
        <Outlet />
      </main>

      {/* Floating QR scanner button — mobile only, hidden on scan page */}
      {!isOnScanPage && (
        <Link
          to="/dashboard/scan"
          className={`${ui.primaryButton} md:hidden fixed bottom-6 right-6 z-30 size-14 rounded-full bg-violet-600 p-0 shadow-xl hover:bg-violet-700`}
          aria-label="Scanner QR"
        >
          <QrCode size={24} />
        </Link>
      )}
    </div>
  );
}
