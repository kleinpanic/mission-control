/**
 * Agent name mapping - human-readable names for agent IDs
 */

export const AGENT_NAMES: Record<string, string> = {
  main: "Main",
  dev: "Dev",
  school: "School",
  ops: "Ops",
  research: "Research",
  taskmaster: "Taskmaster",
  meta: "Meta",
  recovery: "Recovery",
  ghost: "Ghost",
};

/**
 * Get human-readable agent name
 */
export function getAgentName(agentId: string): string {
  return AGENT_NAMES[agentId] || agentId;
}

/**
 * Get agent display with ID on hover
 */
export function formatAgentName(agentId: string): { name: string; id: string } {
  return {
    name: getAgentName(agentId),
    id: agentId,
  };
}
