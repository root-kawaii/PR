import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, LogOut, Settings, QrCode, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSafeImageUrl } from '../utils/image';

interface Props {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
    isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
  }`;

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { club, owner, logout } = useAuth();
  const clubImageSrc = getSafeImageUrl(club?.image);

  return (
    <>
      {/* Club header */}
      <div className="p-6 border-b border-gray-700 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {clubImageSrc && (
            <img
              src={clubImageSrc}
              alt={club?.name ?? 'Club'}
              className="w-16 h-16 rounded-lg object-cover mb-3"
            />
          )}
          <h2 className="font-bold text-lg leading-tight">{club?.name || 'My Club'}</h2>
          <p className="text-gray-400 text-sm mt-1 truncate">{owner?.email}</p>
        </div>
        {/* Close button — mobile drawer only */}
        {onClose && (
          <button
            onClick={onClose}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavLink to="/dashboard" end className={navLinkClass} onClick={onClose}>
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>

        <NavLink to="/dashboard/events" className={navLinkClass} onClick={onClose}>
          <CalendarDays size={20} />
          Events
        </NavLink>

        <NavLink to="/dashboard/scan" className={navLinkClass} onClick={onClose}>
          <QrCode size={20} />
          Scanner QR
        </NavLink>

        <NavLink to="/dashboard/club" className={navLinkClass} onClick={onClose}>
          <Settings size={20} />
          Impostazioni Locale
        </NavLink>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-gray-900 text-white flex-col min-h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-gray-900 text-white flex flex-col">
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
