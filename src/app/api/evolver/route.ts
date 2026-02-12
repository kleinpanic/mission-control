import { NextRequest, NextResponse } from "next/server";
import {
  readGenes,
  readCapsules,
  readEvents,
  readPendingEvolutions,
  approveEvolution,
  rejectEvolution,
  toggleGene,
  getEvolverStats,
  triggerEvolutionReview,
} from "@/lib/evolver";

/**
 * GET /api/evolver
 * Query params:
 *  - type: "genes" | "capsules" | "events" | "pending" | "stats" | "all"
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all";

    if (type === "stats") {
      const stats = await getEvolverStats();
      return NextResponse.json(stats);
    }

    if (type === "genes") {
      const genes = await readGenes();
      return NextResponse.json({ genes });
    }

    if (type === "capsules") {
      const capsules = await readCapsules();
      return NextResponse.json({ capsules });
    }

    if (type === "events") {
      const events = await readEvents();
      return NextResponse.json({ events });
    }

    if (type === "pending") {
      const pending = await readPendingEvolutions();
      return NextResponse.json({ pending });
    }

    // Default: return all
    const [genes, capsules, events, pending, stats] = await Promise.all([
      readGenes(),
      readCapsules(),
      readEvents(),
      readPendingEvolutions(),
      getEvolverStats(),
    ]);

    return NextResponse.json({ genes, capsules, events, pending, stats });
  } catch (error) {
    console.error("GET /api/evolver error:", error);
    return NextResponse.json(
      { error: "Failed to fetch evolver data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evolver
 * Trigger actions
 * Body: { action: "approve" | "reject" | "toggle-gene" | "run-review", id?, enabled? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, enabled } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing required field: action" },
        { status: 400 }
      );
    }

    switch (action) {
      case "approve":
        if (!id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }
        const approved = await approveEvolution(id);
        if (!approved) {
          return NextResponse.json(
            { error: "Evolution not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, message: "Evolution approved" });

      case "reject":
        if (!id) {
          return NextResponse.json(
            { error: "Missing required field: id" },
            { status: 400 }
          );
        }
        const rejected = await rejectEvolution(id);
        if (!rejected) {
          return NextResponse.json(
            { error: "Evolution not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, message: "Evolution rejected" });

      case "toggle-gene":
        if (!id || enabled === undefined) {
          return NextResponse.json(
            { error: "Missing required fields: id, enabled" },
            { status: 400 }
          );
        }
        const toggled = await toggleGene(id, enabled);
        if (!toggled) {
          return NextResponse.json(
            { error: "Gene not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, message: "Gene toggled" });

      case "run-review":
        const result = await triggerEvolutionReview();
        return NextResponse.json({
          success: !result.error,
          output: result.output,
          error: result.error,
        });

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("POST /api/evolver error:", error);
    return NextResponse.json(
      { error: "Failed to process evolver action" },
      { status: 500 }
    );
  }
}
