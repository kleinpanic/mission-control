// Agent name mapping for human-readable display
export const AGENT_NAMES: Record<string, string> = {
  main: "Main",
  dev: "Dev",
  school: "School",
  ops: "Ops",
  research: "Research",
  meta: "Meta",
  taskmaster: "Taskmaster",
  recovery: "Recovery",
  ghost: "Ghost",
};

/**
 * Get human-readable agent name
 * @param agentId Agent ID (e.g., "dev", "main")
 * @returns Human name (e.g., "Dev", "Main") or original ID if not found
 */
export function getAgentName(agentId: string): string {
  return AGENT_NAMES[agentId] || agentId;
}

/**
 * Get agent display with name and ID
 * @param agentId Agent ID
 * @returns Display string like "Dev (dev)" or just the ID if no mapping
 */
export function getAgentDisplay(agentId: string): string {
  const name = AGENT_NAMES[agentId];
  return name ? `${name} (${agentId})` : agentId;
}
