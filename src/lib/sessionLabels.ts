/**
 * Session label derivation - human-readable session identifiers
 * 
 * Priority order:
 * 1. Explicit label (if set)
 * 2. Cron job name (if session was spawned by cron)
 * 3. Channel + chat type (e.g., "Slack #dev")
 * 4. Session key fallback (last resort)
 */

export function deriveSessionLabel(session: any): string {
  // 1. Explicit label
  if (session.label) {
    return session.label;
  }

  // 2. Cron job name (check session metadata or context)
  if (session.context?.cronJob) {
    return `Cron: ${session.context.cronJob}`;
  }

  // 3. Channel + chat type
  if (session.channel) {
    const channel = session.channel;
    let chatLabel = "";

    // Slack: show channel name
    if (channel.type === "slack" && channel.chat) {
      chatLabel = `#${channel.chat}`;
    }
    // Discord: show channel name
    else if (channel.type === "discord" && channel.chat) {
      chatLabel = `#${channel.chat}`;
    }
    // WhatsApp/BlueBubbles: show contact name or number
    else if ((channel.type === "whatsapp" || channel.type === "bluebubbles") && channel.contact) {
      chatLabel = channel.contact;
    }
    // Generic fallback
    else if (channel.chat) {
      chatLabel = channel.chat;
    }

    if (chatLabel) {
      return `${capitalize(channel.type)} ${chatLabel}`;
    }

    return capitalize(channel.type);
  }

  // 4. Session key fallback (last resort)
  if (session.sessionKey) {
    return `Session ${session.sessionKey.slice(0, 8)}`;
  }

  return "Unknown Session";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
