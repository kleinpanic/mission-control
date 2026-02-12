import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentsStore } from './agents';
import { Agent } from '@/types';

describe('Agents Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useAgentsStore.setState({ agents: [], loading: false });
  });

  it('should initialize with empty agents and not loading', () => {
    const { agents, loading } = useAgentsStore.getState();
    expect(agents).toEqual([]);
    expect(loading).toBe(false);
  });

  it('should set agents', () => {
    const mockAgents: Agent[] = [
      {
        id: 'main',
        name: 'Main',
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
        sessions: [],
        context: { used: 50000, limit: 200000 },
      },
      {
        id: 'dev',
        name: 'Dev',
        status: 'idle',
        lastHeartbeat: new Date().toISOString(),
        sessions: [],
        context: { used: 30000, limit: 200000 },
      },
    ];

    useAgentsStore.getState().setAgents(mockAgents);
    const { agents } = useAgentsStore.getState();
    expect(agents).toEqual(mockAgents);
    expect(agents).toHaveLength(2);
  });

  it('should set loading state', () => {
    useAgentsStore.getState().setLoading(true);
    expect(useAgentsStore.getState().loading).toBe(true);

    useAgentsStore.getState().setLoading(false);
    expect(useAgentsStore.getState().loading).toBe(false);
  });

  it('should update a single agent', () => {
    const initialAgents: Agent[] = [
      {
        id: 'main',
        name: 'Main',
        status: 'active',
        lastHeartbeat: '2026-01-01T00:00:00Z',
        sessions: [],
        context: { used: 50000, limit: 200000 },
      },
      {
        id: 'dev',
        name: 'Dev',
        status: 'idle',
        lastHeartbeat: '2026-01-01T00:00:00Z',
        sessions: [],
        context: { used: 30000, limit: 200000 },
      },
    ];

    useAgentsStore.setState({ agents: initialAgents });

    const updates = {
      status: 'active' as const,
      context: { used: 60000, limit: 200000 },
    };

    useAgentsStore.getState().updateAgent('dev', updates);
    const { agents } = useAgentsStore.getState();

    expect(agents[1].status).toBe('active');
    expect(agents[1].context.used).toBe(60000);
    expect(agents[0].status).toBe('active'); // main unchanged
  });

  it('should not update non-existent agent', () => {
    const initialAgents: Agent[] = [
      {
        id: 'main',
        name: 'Main',
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
        sessions: [],
        context: { used: 50000, limit: 200000 },
      },
    ];

    useAgentsStore.setState({ agents: initialAgents });
    useAgentsStore.getState().updateAgent('nonexistent', { status: 'idle' });

    const { agents } = useAgentsStore.getState();
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('main');
  });

  it('should preserve other agent fields when updating', () => {
    const agent: Agent = {
      id: 'dev',
      name: 'Dev Agent',
      status: 'active',
      lastHeartbeat: '2026-01-01T00:00:00Z',
      sessions: [{ key: 'session1', kind: 'direct' }],
      context: { used: 10000, limit: 200000 },
    };

    useAgentsStore.setState({ agents: [agent] });
    useAgentsStore.getState().updateAgent('dev', { status: 'idle' });

    const { agents } = useAgentsStore.getState();
    expect(agents[0].name).toBe('Dev Agent');
    expect(agents[0].sessions).toHaveLength(1);
    expect(agents[0].context.used).toBe(10000);
    expect(agents[0].status).toBe('idle');
  });
});
