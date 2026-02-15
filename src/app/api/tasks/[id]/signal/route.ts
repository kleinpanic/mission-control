import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const ACTIVITY_DIR = `${process.env.HOME}/.openclaw/autonomous`;

interface SignalPayload {
  agentId: string;
  activity: string; // What the agent is currently doing
  timestamp?: string;
}

interface ActivityState {
  taskId: string;
  agentId: string;
  activity: string;
  lastSignal: string;
  startedAt: string;
}

/**
 * POST /api/tasks/:id/signal
 * 
 * Liveness signal from autonomous agent session.
 * Prevents "stuck" detection by updating last-seen timestamp.
 * 
 * Body:
 *   {
 *     "agentId": "dev",
 *     "activity": "Running tests"
 *   }
 * 
 * Response:
 *   - 200: { success: true }
 *   - 400: Invalid request
 *   - 500: File system error
 * 
 * Side effects:
 *   - Updates ~/.openclaw/autonomous/<agent>.activity.json
 *   - Used by ops for stuck detection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  let body: SignalPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.agentId || !body.activity) {
    return NextResponse.json(
      { error: "Missing required fields: agentId, activity" },
      { status: 400 }
    );
  }

  try {
    // Ensure activity directory exists
    if (!existsSync(ACTIVITY_DIR)) {
      mkdirSync(ACTIVITY_DIR, { recursive: true });
    }

    const activityFile = join(ACTIVITY_DIR, `${body.agentId}.activity.json`);

    // Load existing state or create new
    let state: ActivityState;

    if (existsSync(activityFile)) {
      const existing = JSON.parse(readFileSync(activityFile, "utf-8"));
      state = {
        ...existing,
        taskId,
        activity: body.activity,
        lastSignal: body.timestamp || new Date().toISOString(),
      };
    } else {
      state = {
        taskId,
        agentId: body.agentId,
        activity: body.activity,
        lastSignal: body.timestamp || new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };
    }

    writeFileSync(activityFile, JSON.stringify(state, null, 2));

    console.log(`[signal] Task ${taskId} signal from ${body.agentId}: ${body.activity}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[tasks/signal] File system error:", error);
    return NextResponse.json(
      { error: "Failed to update activity state" },
      { status: 500 }
    );
  }
}
