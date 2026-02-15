/**
 * Derive human-readable session label from session data
 * Priority:
 * 1. Explicit label if set
 * 2. Cron job name (if cron-spawned)
 * 3. Channel + chat type (e.g., "Slack #dev-openclaw")
 * 4. Fallback to key first 8 chars
 */
export function getSessionLabel(session: any): string {
  // 1. Explicit label
  if (session.label && session.label.trim()) {
    return session.label;
  }

  // 2. Cron job name (check metadata or session source)
  if (session.metadata?.cronJob || session.source?.includes("cron")) {
    const jobName = session.metadata?.cronJobName || session.metadata?.cronJob || "Cron Job";
    return `⏰ ${jobName}`;
  }

  // 3. Channel + chat type
  if (session.channel) {
    const channelName = session.channelName || session.channel;
    const chatType = session.chatType || "";
    if (chatType) {
      return `${channelName} (${chatType})`;
    }
    return channelName;
  }

  // 4. Fallback to key
  const key = session.key || session.sessionKey || "";
  return key.slice(0, 8) || "Unknown";
}

/**
 * Get short session identifier (for compact display)
 * Shows first 8 chars of key or label if very short
 */
export function getSessionShortId(session: any): string {
  if (session.label && session.label.length <= 12) {
    return session.label;
  }
  
  const key = session.key || session.sessionKey || "";
  return key.slice(0, 8) || "???";
}
