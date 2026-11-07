import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '../../types';

interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthState>({ user: null, setUser: () => {} });
const KEY = 'g4lms.user';

function load(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(load);
  const setUser = (u: User | null) => {
    setUserState(u);
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  };
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
