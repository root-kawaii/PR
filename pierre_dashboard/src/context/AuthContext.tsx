import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { API_URL } from '../config/api';
import type { ClubOwner, Club, AuthResponse } from '../types';
import { identifyAnalyticsOwner, resetAnalytics, trackEvent } from '../config/analytics';

interface AuthContextType {
  token: string | null;
  owner: ClubOwner | null;
  club: Club | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [owner, setOwner] = useState<ClubOwner | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const previousOwnerIdRef = useRef<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedOwner = localStorage.getItem('auth_owner');
    const savedClub = localStorage.getItem('auth_club');

    if (savedToken && savedOwner) {
      setToken(savedToken);
      setOwner(JSON.parse(savedOwner));
      if (savedClub) setClub(JSON.parse(savedClub));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!owner) {
      if (previousOwnerIdRef.current) {
        resetAnalytics();
        previousOwnerIdRef.current = null;
      }
      return;
    }

    identifyAnalyticsOwner(owner, club);
    previousOwnerIdRef.current = owner.id;
  }, [owner, club]);

  const login = async (email: string, password: string) => {
    trackEvent('owner_auth_login_submitted', {
      email_domain: email.includes('@') ? email.split('@')[1] : null,
    });

    const res = await fetch(`${API_URL}/auth/club-owner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      trackEvent('owner_auth_login_failed', {
        status_code: res.status,
        error_message: text || 'Login failed',
      });
      throw new Error(text || 'Login failed');
    }

    const data: AuthResponse = await res.json();

    setToken(data.token);
    setOwner(data.owner);
    setClub(data.club);

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_owner', JSON.stringify(data.owner));
    if (data.club) localStorage.setItem('auth_club', JSON.stringify(data.club));

    trackEvent('owner_auth_login_succeeded', {
      owner_id: data.owner.id,
      club_id: data.club?.id ?? null,
      has_club: Boolean(data.club),
    });
  };

  const logout = () => {
    if (owner) {
      trackEvent('owner_auth_logout', {
        owner_id: owner.id,
        club_id: club?.id ?? null,
      });
    }

    setToken(null);
    setOwner(null);
    setClub(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_owner');
    localStorage.removeItem('auth_club');
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ token, owner, club, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
