import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getCostJsonProviders } from "@/lib/costCache";
import { getOpenClawStatus } from "@/lib/statusCache";
import { calculateTokenCost, identifyProvider, getProviderColor } from "@/lib/providerCosts";

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

    // Get cost data from shared cache (deduped with /api/costs)
    const providers = await getCostJsonProviders();

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

    // Build daily-by-provider for multi-line charts (codexbar providers first)
    const dailyByProvider: Record<string, { date: string; cost: number }[]> = {};
    for (const provider of providers) {
      const name = provider.provider || "unknown";
      if (!dailyByProvider[name]) dailyByProvider[name] = [];
      for (const day of provider.daily || []) {
        const cost = day.totalCost ?? (day.modelBreakdowns || []).reduce((s: number, m: any) => s + (m.cost || 0), 0);
        if (cost > 0) dailyByProvider[name].push({ date: day.date, cost: Math.round(cost * 100) / 100 });
      }
      dailyByProvider[name].sort((a, b) => a.date.localeCompare(b.date));
    }

    // Build daily-by-model for multi-line charts (codexbar models first)
    const dailyByModel: Record<string, { date: string; cost: number }[]> = {};
    for (const detail of Object.values(dailyDetailsMap)) {
      for (const mb of detail.modelBreakdowns) {
        if (mb.cost <= 0) continue;
        if (!dailyByModel[mb.modelName]) dailyByModel[mb.modelName] = [];
        const existing = dailyByModel[mb.modelName].find(e => e.date === detail.date);
        if (existing) existing.cost += mb.cost;
        else dailyByModel[mb.modelName].push({ date: detail.date, cost: Math.round(mb.cost * 100) / 100 });
      }
    }
    for (const key of Object.keys(dailyByModel)) {
      dailyByModel[key].sort((a, b) => a.date.localeCompare(b.date));
    }

    // ──────────────────────────────────────────────
    // Estimate per-agent costs AND merge session-based provider/model costs
    // This fills in Gemini, xAI, Perplexity, etc. that codexbar doesn't track
    // ──────────────────────────────────────────────
    const agentMap: Record<string, number> = {};
    try {
      const statusData = await getOpenClawStatus();
      const byAgent = statusData?.sessions?.byAgent || [];
      const todayStr = new Date().toISOString().slice(0, 10);

      for (const ba of byAgent) {
        const agentId = ba.agentId || "unknown";

        for (const s of ba.recent || []) {
          const model = s.model || "unknown";
          const providerId = identifyProvider(model);
          const inputTokens = s.inputTokens || 0;
          const outputTokens = s.outputTokens || 0;
          const totalTokens = s.totalTokens || (inputTokens + outputTokens);

          const estInput = inputTokens > 0 ? inputTokens : Math.round(totalTokens * 0.85);
          const estOutput = outputTokens > 0 ? outputTokens : Math.round(totalTokens * 0.15);
          const { cost } = calculateTokenCost(model, estInput, estOutput);

          // Per-agent attribution (all providers)
          agentMap[agentId] = (agentMap[agentId] || 0) + cost;

          // For non-codexbar providers: merge into provider/model maps + daily series
          if (providerId !== "claude" && providerId !== "codex") {
            // Provider totals
            providerMap[providerId] = (providerMap[providerId] || 0) + cost;

            // Model totals
            const modelKey = model || "unknown";
            modelMap[modelKey] = (modelMap[modelKey] || 0) + cost;

            // Daily provider series — attribute to today (sessions are current)
            if (!dailyByProvider[providerId]) dailyByProvider[providerId] = [];
            const existingDay = dailyByProvider[providerId].find(d => d.date === todayStr);
            if (existingDay) {
              existingDay.cost += Math.round(cost * 100) / 100;
            } else if (cost > 0) {
              dailyByProvider[providerId].push({ date: todayStr, cost: Math.round(cost * 100) / 100 });
            }

            // Daily model series — attribute to today
            if (!dailyByModel[modelKey]) dailyByModel[modelKey] = [];
            const existingModelDay = dailyByModel[modelKey].find(d => d.date === todayStr);
            if (existingModelDay) {
              existingModelDay.cost += Math.round(cost * 100) / 100;
            } else if (cost > 0) {
              dailyByModel[modelKey].push({ date: todayStr, cost: Math.round(cost * 100) / 100 });
            }

            // Add to daily total too
            dailyMap[todayStr] = (dailyMap[todayStr] || 0) + cost;

            // Add to daily details
            if (!dailyDetailsMap[todayStr]) {
              dailyDetailsMap[todayStr] = { date: todayStr, totalCost: 0, modelBreakdowns: [] };
            }
            dailyDetailsMap[todayStr].totalCost += cost;
            dailyDetailsMap[todayStr].modelBreakdowns.push({
              modelName: modelKey,
              cost: Math.round(cost * 100) / 100,
              inputTokens: estInput,
              outputTokens: estOutput,
            });
          }
        }
      }

      // Round agent values
      Object.keys(agentMap).forEach((key) => {
        agentMap[key] = Math.round(agentMap[key] * 100) / 100;
      });
    } catch (err) {
      console.error('Failed to estimate agent/session costs:', err);
    }

    // ──────────────────────────────────────────────
    // Final aggregation — after all sources are merged
    // ──────────────────────────────────────────────

    // Round all values
    Object.keys(modelMap).forEach((key) => {
      modelMap[key] = Math.round(modelMap[key] * 100) / 100;
    });
    Object.keys(providerMap).forEach((key) => {
      providerMap[key] = Math.round(providerMap[key] * 100) / 100;
    });

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

    // Build dailyDetails sorted array
    const dailyDetails = Object.values(dailyDetailsMap)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Sort all daily series
    for (const key of Object.keys(dailyByProvider)) {
      dailyByProvider[key].sort((a, b) => a.date.localeCompare(b.date));
    }
    for (const key of Object.keys(dailyByModel)) {
      dailyByModel[key].sort((a, b) => a.date.localeCompare(b.date));
    }

    const response: CostHistoryResponse & { dailyByProvider: any; dailyByModel: any } = {
      daily,
      dailyDetails,
      weekly,
      monthly,
      byAgent: agentMap,
      byModel: modelMap,
      byProvider: providerMap,
      dailyByProvider,
      dailyByModel,
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
