import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_URL } from '../config/api';
import type { ClubOwner, Club, AuthResponse } from '../types';

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

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/club-owner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Login failed');
    }

    const data: AuthResponse = await res.json();

    setToken(data.token);
    setOwner(data.owner);
    setClub(data.club);

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_owner', JSON.stringify(data.owner));
    if (data.club) localStorage.setItem('auth_club', JSON.stringify(data.club));
  };

  const logout = () => {
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
