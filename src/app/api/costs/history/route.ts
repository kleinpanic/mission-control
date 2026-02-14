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

interface DailyDetail {
  date: string;
  totalCost: number;
  modelBreakdowns: { modelName: string; cost: number; inputTokens?: number; outputTokens?: number }[];
}

interface CostHistoryResponse {
  daily: CostHistoryEntry[];
  dailyDetails: DailyDetail[];
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
    const dailyDetailsMap: Record<string, DailyDetail> = {};
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

        // Collect daily details with model breakdowns
        if (!dailyDetailsMap[date]) {
          dailyDetailsMap[date] = { date, totalCost: 0, modelBreakdowns: [] };
        }
        dailyDetailsMap[date].totalCost += dayCost;
        for (const m of day.modelBreakdowns || []) {
          dailyDetailsMap[date].modelBreakdowns.push({
            modelName: m.modelName || "unknown",
            cost: m.cost || 0,
            inputTokens: m.inputTokens,
            outputTokens: m.outputTokens,
          });
        }

        // Model breakdown
        for (const model of day.modelBreakdowns || []) {
          const modelCost = typeof model.cost === 'number' ? model.cost : 0;
          if (modelCost >= 0) {
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

    // Estimate per-agent costs from session data
    const agentMap: Record<string, number> = {};
    try {
      const { stdout: sessionData } = await execAsync(
        'openclaw sessions --json 2>/dev/null || echo "{}"',
        { timeout: 10000 }
      );
      // Skip plugin log lines, find JSON
      const sessionLines = sessionData.split('\n');
      let sessionJsonStart = -1;
      for (let i = 0; i < sessionLines.length; i++) {
        if (sessionLines[i].trim().startsWith('{')) {
          sessionJsonStart = i;
          break;
        }
      }
      if (sessionJsonStart >= 0) {
        const sessionJson = JSON.parse(sessionLines.slice(sessionJsonStart).join('\n'));
        const sessions = sessionJson.sessions || [];
        
        // Rough cost estimation per model ($/1M tokens, blended input/output)
        const modelCostPer1M: Record<string, number> = {
          'claude-sonnet-4-5': 9.0,
          'claude-opus-4-5': 45.0,
          'claude-opus-4-6': 45.0,
          'gpt-5.2': 15.0,
          'gemini-3-flash-preview': 0.5,
          'gemini-3-pro-preview': 5.0,
        };
        
        for (const session of sessions) {
          const agentId = session.key?.split(':')[1] || 'unknown';
          const totalTokens = (session.inputTokens || 0) + (session.outputTokens || 0);
          const model = session.model || 'claude-sonnet-4-5';
          
          // Find matching cost rate
          const costRate = Object.entries(modelCostPer1M).find(([k]) => model.includes(k))?.[1] || 5.0;
          const cost = (totalTokens / 1_000_000) * costRate;
          
          agentMap[agentId] = (agentMap[agentId] || 0) + cost;
        }
        
        // Round values
        Object.keys(agentMap).forEach((key) => {
          agentMap[key] = Math.round(agentMap[key] * 100) / 100;
        });
      }
    } catch (err) {
      console.error('Failed to estimate agent costs:', err);
    }

    // Build dailyDetails sorted array
    const dailyDetails = Object.values(dailyDetailsMap)
      .sort((a, b) => b.date.localeCompare(a.date));

    const response: CostHistoryResponse = {
      daily,
      dailyDetails,
      weekly,
      monthly,
      byAgent: agentMap,
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
        dailyDetails: [],
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
