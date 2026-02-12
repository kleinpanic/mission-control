// Mission Control - Sessions Store
import { create } from 'zustand';
import { Session } from '@/types';

interface SessionsState {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  setSessions: (sessions: Session[]) => void;
  updateSession: (key: string, updates: Partial<Session>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions, error: null }),

  updateSession: (key, updates) =>
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.key === key ? { ...session, ...updates } : session
      ),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),
}));
