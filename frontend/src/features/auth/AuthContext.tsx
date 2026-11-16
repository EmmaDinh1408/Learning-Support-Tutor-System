import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import type { User } from '../../types';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  loading: boolean;
  authError: string;
}

const Ctx = createContext<AuthState>({
  user: null,
  setUser: () => {},
  signOut: async () => {},
  loading: false,
  authError: '',
});
const KEY = 'g4lms.user';

function load(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as User : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(load);

  useEffect(() => {
    const clearExpiredSession = () => {
      localStorage.removeItem(KEY);
      setUserState(null);
    };
    window.addEventListener('g4lms:unauthorized', clearExpiredSession);
    return () => window.removeEventListener('g4lms:unauthorized', clearExpiredSession);
  }, []);

  const setUser = (nextUser: User | null) => {
    setUserState(nextUser);
    try {
      if (nextUser) localStorage.setItem(KEY, JSON.stringify(nextUser));
      else localStorage.removeItem(KEY);
    } catch (error) {
      console.error('Unable to persist the signed-in user:', error);
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <Ctx.Provider value={{ user, setUser, signOut, loading: false, authError: '' }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
