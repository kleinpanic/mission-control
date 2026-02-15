import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { existsSync } from "fs";

const DB_PATH = `${process.env.HOME}/.openclaw/data/tasks.db`;

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  assignedTo: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
  project: string | null;
  lobsterWorkflow: string | null;
}

/**
 * GET /api/tasks/next?agent=<agentId>
 * 
 * Returns the next highest-priority ready task for the specified agent.
 * Used by agent heartbeats to check for work.
 * 
 * Query params:
 *   - agent: Agent ID (required)
 *   - skills: Comma-separated skills (optional, for filtering)
 * 
 * Response:
 *   - 200: { task: Task } if work available
 *   - 204: No content if no work available
 *   - 400: Missing agent parameter
 *   - 500: Database error
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get("agent");
  const _skills = searchParams.get("skills")?.split(",") || [];

  if (!agentId) {
    return NextResponse.json(
      { error: "Missing required parameter: agent" },
      { status: 400 }
    );
  }

  if (!existsSync(DB_PATH)) {
    return NextResponse.json(
      { error: "Task database not found" },
      { status: 500 }
    );
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Query for next ready task:
    // 1. status = 'ready'
    // 2. assigned to this agent OR unassigned
    // 3. ordered by priority DESC, createdAt ASC
    // 4. limit 1
    const query = `
      SELECT * FROM tasks
      WHERE status = 'ready'
      AND (assignedTo = ? OR assignedTo IS NULL)
      ORDER BY priority DESC, createdAt ASC
      LIMIT 1
    `;

    const task = db.prepare(query).get(agentId) as Task | undefined;

    db.close();

    if (!task) {
      // No work available - return 204 No Content
      return new NextResponse(null, { status: 204 });
    }

    // Parse tags if present
    const parsedTask = {
      ...task,
      tags: task.tags ? task.tags.split(",").map((t) => t.trim()) : [],
    };

    return NextResponse.json({ task: parsedTask });
  } catch (error) {
    console.error("[tasks/next] Database error:", error);
    return NextResponse.json(
      { error: "Failed to query tasks" },
      { status: 500 }
    );
  }
}
