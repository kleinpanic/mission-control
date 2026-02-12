import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CostHistoryEntry {
  date: string;
  cost: number;
  provider?: string;
  model?: string;
}

interface CostHistoryResponse {
  daily: CostHistoryEntry[];
  weekly: CostHistoryEntry[];
  monthly: CostHistoryEntry[];
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
}

// Cache for 5 minutes
let cache: CostHistoryResponse | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * GET /api/costs/history
 * Returns cost data aggregated over time (daily/weekly/monthly)
 * Uses codexbar cost API to build time series
 */
export async function GET() {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cache && (now - cacheTime) < CACHE_TTL) {
      return NextResponse.json(cache);
    }

    // Get cost data from codexbar (all providers)
    const { stdout: rawCostData } = await execAsync(
      'codexbar cost --provider all --format json 2>/dev/null || echo "[]"'
    );

    let providers: any[] = [];
    try {
      providers = JSON.parse(rawCostData.trim() || "[]");
    } catch {
      providers = [];
    }

    // Aggregate by day from codexbar data
    const dailyMap: Record<string, number> = {};
    const modelMap: Record<string, number> = {};
    const providerMap: Record<string, number> = {};

    for (const provider of providers) {
      const providerName = provider.provider || "unknown";
      
      // Add to provider totals
      const providerTotal = provider.totals?.totalCost || 0;
      providerMap[providerName] = (providerMap[providerName] || 0) + providerTotal;

      // Process daily entries
      for (const day of provider.daily || []) {
        const date = day.date;
        // Calculate day cost from modelBreakdowns if totalCost is missing
        const dayCost = day.totalCost ?? 
          (day.modelBreakdowns || []).reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

        if (dayCost > 0) {
          dailyMap[date] = (dailyMap[date] || 0) + dayCost;
        }

        // Model breakdown
        for (const model of day.modelBreakdowns || []) {
          const modelCost = model.cost || 0;
          if (modelCost > 0) {
            const modelName = model.modelName || "unknown";
            modelMap[modelName] = (modelMap[modelName] || 0) + modelCost;
          }
        }
      }
    }

    // Convert to sorted array
    const daily = Object.entries(dailyMap)
      .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Weekly aggregation (group by week start - Sunday)
    const weeklyMap: Record<string, number> = {};
    daily.forEach((entry) => {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];
      weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + entry.cost;
    });

    const weekly = Object.entries(weeklyMap)
      .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly aggregation
    const monthlyMap: Record<string, number> = {};
    daily.forEach((entry) => {
      const monthKey = entry.date.substring(0, 7); // YYYY-MM
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + entry.cost;
    });

    const monthly = Object.entries(monthlyMap)
      .map(([date, cost]) => ({ date: `${date}-01`, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Round all values
    Object.keys(modelMap).forEach((key) => {
      modelMap[key] = Math.round(modelMap[key] * 100) / 100;
    });
    Object.keys(providerMap).forEach((key) => {
      providerMap[key] = Math.round(providerMap[key] * 100) / 100;
    });

    const response: CostHistoryResponse = {
      daily,
      weekly,
      monthly,
      byAgent: {}, // Agent data would need session logs - keeping empty for now
      byModel: modelMap,
      byProvider: providerMap,
    };

    // Update cache
    cache = response;
    cacheTime = now;

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
        byProvider: {},
      },
      { status: 500 }
    );
  }
}
