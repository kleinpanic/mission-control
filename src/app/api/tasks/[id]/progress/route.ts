import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask } from "@/lib/db";

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
    // 1. Load the task
    const task = getTask(taskId);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // 2. Prepare updates
    const updates: any = {};
    if (body.status) updates.status = body.status;
    
    // If status changed to 'in_progress', set assignedTo if not already set
    if (body.status === "in_progress" && !task.assignedTo) {
      updates.assignedTo = body.agentId;
    }

    // Store progress and message in metadata
    updates.metadata = {
      ...(task.metadata || {}),
      progress: body.progress !== undefined ? body.progress : (task.metadata?.progress),
      message: body.message || (task.metadata?.message),
      lastProgressUpdate: new Date().toISOString(),
      lastProgressAgent: body.agentId,
    };

    // 3. Update task (this automatically triggers WebSocket broadcast via lib/db)
    const updatedTask = updateTask(taskId, updates);

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
    console.error("[tasks/progress] Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
