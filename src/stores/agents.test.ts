import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentsStore } from './agents';
import { Agent } from '@/types';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'main',
    name: 'Main',
    status: 'active',
    model: null,
    lastActivity: null,
    activeSession: null,
    heartbeatNext: null,
    heartbeatOverdue: false,
    activeSessions: 0,
    tokenLimited: false,
    rateLimited: false,
    contextUsagePercent: 0,
    ...overrides,
  };
}

describe('Agents Store', () => {
  beforeEach(() => {
    useAgentsStore.setState({ agents: [], loading: false });
  });

  it('should initialize with empty agents and not loading', () => {
    const { agents, loading } = useAgentsStore.getState();
    expect(agents).toEqual([]);
    expect(loading).toBe(false);
  });

  it('should set agents', () => {
    const mockAgents: Agent[] = [
      makeAgent({ id: 'main', name: 'Main', status: 'active', contextUsagePercent: 25 }),
      makeAgent({ id: 'dev', name: 'Dev', status: 'idle', contextUsagePercent: 15 }),
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
      makeAgent({ id: 'main', status: 'active', contextUsagePercent: 25 }),
      makeAgent({ id: 'dev', name: 'Dev', status: 'idle', contextUsagePercent: 15 }),
    ];

    useAgentsStore.setState({ agents: initialAgents });
    useAgentsStore.getState().updateAgent('dev', { status: 'active', contextUsagePercent: 30 });
    
    const { agents } = useAgentsStore.getState();
    expect(agents[1].status).toBe('active');
    expect(agents[1].contextUsagePercent).toBe(30);
    expect(agents[0].status).toBe('active'); // main unchanged
  });

  it('should not update non-existent agent', () => {
    const initialAgents: Agent[] = [
      makeAgent({ id: 'main', status: 'active' }),
    ];

    useAgentsStore.setState({ agents: initialAgents });
    useAgentsStore.getState().updateAgent('nonexistent', { status: 'idle' });

    const { agents } = useAgentsStore.getState();
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('main');
  });

  it('should preserve other agent fields when updating', () => {
    const agent = makeAgent({
      id: 'dev',
      name: 'Dev Agent',
      status: 'active',
      model: 'anthropic/claude-sonnet-4-5',
      activeSessions: 3,
      contextUsagePercent: 50,
    });

    useAgentsStore.setState({ agents: [agent] });
    useAgentsStore.getState().updateAgent('dev', { status: 'idle' });

    const { agents } = useAgentsStore.getState();
    expect(agents[0].name).toBe('Dev Agent');
    expect(agents[0].model).toBe('anthropic/claude-sonnet-4-5');
    expect(agents[0].activeSessions).toBe(3);
    expect(agents[0].contextUsagePercent).toBe(50);
    expect(agents[0].status).toBe('idle');
  });
});
