// Mission Control - Realtime Events Store
import { create } from 'zustand';
import { Event, ConnectionStatus } from '@/types';

interface RealtimeState {
  events: Event[];
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  addEvent: (event: Event) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  clearEvents: () => void;
}

const MAX_EVENTS = 100; // Keep last 100 events in memory

export const useRealtimeStore = create<RealtimeState>((set) => ({
  events: [],
  connectionStatus: 'disconnected',
  connectionError: null,

  addEvent: (event) =>
    set((state) => {
      const newEvents = [event, ...state.events].slice(0, MAX_EVENTS);
      return { events: newEvents };
    }),

  setConnectionStatus: (status, error) =>
    set({ connectionStatus: status, connectionError: error || null }),

  clearEvents: () => set({ events: [] }),
}));
