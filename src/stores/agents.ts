// Mission Control - Agents Store
import { create } from 'zustand';
import { Agent } from '@/types';

interface AgentsState {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  loading: false,
  error: null,

  setAgents: (agents) => set({ agents, error: null }),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, ...updates } : agent
      ),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),
}));
