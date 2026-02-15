import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { existsSync } from "fs";

const DB_PATH = `${process.env.HOME}/.openclaw/data/tasks.db`;

interface ProgressUpdate {
  status?: "in_progress" | "review" | "done" | "blocked";
  progress?: number; // 0-100
  message?: string;
  agentId: string;
}

/**
 * POST /api/tasks/:id/progress
 * 
 * Update task progress from autonomous agent session.
 * Called periodically during autonomous work.
 * 
 * Body:
 *   {
 *     "status": "in_progress" | "review" | "done" | "blocked",
 *     "progress": 0-100 (optional),
 *     "message": "Current activity description" (optional),
 *     "agentId": "dev" (required)
 *   }
 * 
 * Response:
 *   - 200: { success: true, task: Task }
 *   - 400: Invalid request
 *   - 404: Task not found
 *   - 500: Database error
 * 
 * Side effects:
 *   - Updates task in database
 *   - Broadcasts WebSocket update (TODO)
 *   - Posts Slack notification (TODO)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  if (!existsSync(DB_PATH)) {
    return NextResponse.json(
      { error: "Task database not found" },
      { status: 500 }
    );
  }

  let body: ProgressUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.agentId) {
    return NextResponse.json(
      { error: "Missing required field: agentId" },
      { status: 400 }
    );
  }

  if (body.progress !== undefined && (body.progress < 0 || body.progress > 100)) {
    return NextResponse.json(
      { error: "Progress must be 0-100" },
      { status: 400 }
    );
  }

  try {
    const db = new Database(DB_PATH);

    // Check if task exists
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;

    if (!task) {
      db.close();
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.status) {
      updates.push("status = ?");
      values.push(body.status);
    }

    // Store progress and message in metadata JSON field (if exists)
    // For now, just update updatedAt timestamp
    updates.push("updatedAt = ?");
    values.push(new Date().toISOString());

    // If status changed to 'in_progress', set assignedTo if not already set
    if (body.status === "in_progress" && !task.assignedTo) {
      updates.push("assignedTo = ?");
      values.push(body.agentId);
    }

    values.push(taskId);

    const updateQuery = `
      UPDATE tasks
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    db.prepare(updateQuery).run(...values);

    const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);

    db.close();

    // TODO: Broadcast WebSocket update
    // TODO: Post Slack notification if significant status change

    console.log(`[progress] Task ${taskId} updated by ${body.agentId}:`, {
      status: body.status,
      progress: body.progress,
      message: body.message,
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error("[tasks/progress] Database error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
