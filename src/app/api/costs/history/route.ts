import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CostHistoryEntry {
  date: string;
  cost: number;
  provider?: string;
  model?: string;
  agent?: string;
}

interface CostHistoryResponse {
  daily: CostHistoryEntry[];
  weekly: CostHistoryEntry[];
  monthly: CostHistoryEntry[];
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
}

/**
 * GET /api/costs/history
 * Returns cost data aggregated over time (daily/weekly/monthly)
 * Uses codexbar cost API or session logs to build time series
 */
export async function GET() {
  try {
    // Get cost data from codexbar
    const { stdout: rawCostData } = await execAsync(
      'codexbar cost --provider all --format json --last 30d 2>/dev/null || echo "[]"'
    );

    let costData: any[] = [];
    try {
      costData = JSON.parse(rawCostData.trim() || "[]");
    } catch {
      costData = [];
    }

    // Also check session logs for more granular data
    const { stdout: sessionLogsRaw } = await execAsync(
      `find ~/.openclaw/logs -name "session-*.jsonl" -type f -mtime -30 -exec cat {} \\; 2>/dev/null | tail -10000 || echo ""`
    );

    const sessionLines = sessionLogsRaw
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    const sessionCosts: CostHistoryEntry[] = [];
    for (const line of sessionLines) {
      try {
        const entry = JSON.parse(line);
        if (entry.usage?.cost !== undefined && entry.timestamp) {
          sessionCosts.push({
            date: entry.timestamp.split("T")[0],
            cost: entry.usage.cost,
            provider: entry.usage.provider,
            model: entry.model,
            agent: entry.agentId,
          });
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Aggregate by day
    const dailyMap: Record<string, number> = {};
    const agentMap: Record<string, number> = {};
    const modelMap: Record<string, number> = {};

    sessionCosts.forEach((entry) => {
      dailyMap[entry.date] = (dailyMap[entry.date] || 0) + entry.cost;
      if (entry.agent) {
        agentMap[entry.agent] = (agentMap[entry.agent] || 0) + entry.cost;
      }
      if (entry.model) {
        modelMap[entry.model] = (modelMap[entry.model] || 0) + entry.cost;
      }
    });

    // Convert to sorted arrays
    const daily = Object.entries(dailyMap)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Weekly aggregation (group by week)
    const weeklyMap: Record<string, number> = {};
    daily.forEach((entry) => {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Sunday of that week
      const weekKey = weekStart.toISOString().split("T")[0];
      weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + entry.cost;
    });

    const weekly = Object.entries(weeklyMap)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly aggregation (group by month)
    const monthlyMap: Record<string, number> = {};
    daily.forEach((entry) => {
      const monthKey = entry.date.substring(0, 7); // YYYY-MM
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + entry.cost;
    });

    const monthly = Object.entries(monthlyMap)
      .map(([date, cost]) => ({ date: `${date}-01`, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const response: CostHistoryResponse = {
      daily,
      weekly,
      monthly,
      byAgent: agentMap,
      byModel: modelMap,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching cost history:", error);
    return NextResponse.json(
      {
        daily: [],
        weekly: [],
        monthly: [],
        byAgent: {},
        byModel: {},
      },
      { status: 500 }
    );
  }
}
