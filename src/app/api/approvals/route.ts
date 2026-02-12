import { NextRequest, NextResponse } from "next/server";
import {
  readApprovals,
  addApproval,
  updateApproval,
  approveRequest,
  rejectRequest,
  deleteApproval,
  getPendingApprovals,
  getApprovalStats,
} from "@/lib/approvals";

/**
 * GET /api/approvals
 * Query params:
 *  - status: "pending" | "approved" | "rejected" | "all" (default: "all")
 *  - stats: "true" to get statistics only
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "all";
    const statsOnly = searchParams.get("stats") === "true";

    if (statsOnly) {
      const stats = await getApprovalStats();
      return NextResponse.json(stats);
    }

    if (status === "pending") {
      const approvals = await getPendingApprovals();
      return NextResponse.json({ approvals });
    }

    const approvals = await readApprovals();
    const filtered = status === "all"
      ? approvals
      : approvals.filter((req) => req.status === status);

    return NextResponse.json({ approvals: filtered });
  } catch (error) {
    console.error("GET /api/approvals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals
 * Create a new approval request
 * Body: { agent, type, title, description, details }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent, type, title, description, details } = body;

    if (!agent || !type || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: agent, type, title, description" },
        { status: 400 }
      );
    }

    const approval = await addApproval({
      agent,
      type,
      title,
      description,
      details: details || {},
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    console.error("POST /api/approvals error:", error);
    return NextResponse.json(
      { error: "Failed to create approval" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/approvals
 * Update an approval request
 * Body: { id, action: "approve" | "reject" | "update", notes?, updates? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, notes, updates } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "Missing required fields: id, action" },
        { status: 400 }
      );
    }

    let approval;

    switch (action) {
      case "approve":
        approval = await approveRequest(id, notes);
        break;
      case "reject":
        approval = await rejectRequest(id, notes);
        break;
      case "update":
        approval = await updateApproval(id, updates || {});
        break;
      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ approval });
  } catch (error) {
    console.error("PATCH /api/approvals error:", error);
    return NextResponse.json(
      { error: "Failed to update approval" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/approvals
 * Delete an approval request
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const deleted = await deleteApproval(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/approvals error:", error);
    return NextResponse.json(
      { error: "Failed to delete approval" },
      { status: 500 }
    );
  }
}
