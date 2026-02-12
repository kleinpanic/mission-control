// Mission Control - Costs API
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Codexbar actual format (from `codexbar cost --format json`)
interface CodexbarProviderData {
  provider: string;
  daily: {
    date: string;  // "2026-02-07"
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    totalTokens: number;
    modelsUsed: string[];
    modelBreakdowns: {
      modelName: string;
      cost: number;
    }[];
  }[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    totalTokens: number;
  };
  last30DaysCostUSD: number;
  last30DaysTokens: number;
  updatedAt: string;
}

// Normalized format for the table
interface NormalizedEntry {
  timestamp: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
}

// Cache costs for 5 minutes
let cachedCosts: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedCosts && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(cachedCosts);
    }

    // Fetch fresh data from codexbar
    const { stdout, stderr } = await execAsync(
      'codexbar cost --format json --provider all --pretty',
      { timeout: 10000 }
    );

    if (stderr) {
      console.warn('codexbar stderr:', stderr);
    }

    const providers: CodexbarProviderData[] = JSON.parse(stdout);

    // Aggregate costs
    const summary = {
      today: 0,
      week: 0,
      month: 0,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
    };

    const now_date = new Date();
    const todayStr = now_date.toISOString().slice(0, 10); // "2026-02-12"
    const weekAgo = new Date(now_date.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const monthStart = `${now_date.getFullYear()}-${String(now_date.getMonth() + 1).padStart(2, '0')}-01`;

    // Flatten daily entries for the table
    const raw: NormalizedEntry[] = [];

    for (const provider of providers) {
      // Provider total
      if (!summary.byProvider[provider.provider]) {
        summary.byProvider[provider.provider] = 0;
      }
      summary.byProvider[provider.provider] += provider.totals.totalCost;

      for (const day of provider.daily) {
        const dayDate = day.date; // "2026-02-07"

        // Time-based aggregation
        if (dayDate === todayStr) {
          summary.today += day.totalCost;
        }
        if (dayDate >= weekAgo) {
          summary.week += day.totalCost;
        }
        if (dayDate >= monthStart) {
          summary.month += day.totalCost;
        }

        // Model aggregation from breakdowns
        for (const model of day.modelBreakdowns) {
          if (!summary.byModel[model.modelName]) {
            summary.byModel[model.modelName] = 0;
          }
          summary.byModel[model.modelName] += model.cost;

          // Add to raw for table display
          raw.push({
            timestamp: `${dayDate}T00:00:00Z`,
            provider: provider.provider,
            model: model.modelName,
            input_tokens: day.inputTokens,
            output_tokens: day.outputTokens,
            total_cost: model.cost,
          });
        }
      }
    }

    // Sort raw by date (newest first)
    raw.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Round to 2 decimal places
    summary.today = Math.round(summary.today * 100) / 100;
    summary.week = Math.round(summary.week * 100) / 100;
    summary.month = Math.round(summary.month * 100) / 100;

    Object.keys(summary.byProvider).forEach((key) => {
      summary.byProvider[key] = Math.round(summary.byProvider[key] * 100) / 100;
    });

    Object.keys(summary.byModel).forEach((key) => {
      summary.byModel[key] = Math.round(summary.byModel[key] * 100) / 100;
    });

    const result = {
      summary,
      raw,
    };

    // Update cache
    cachedCosts = result;
    cacheTimestamp = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Costs API error:', error);
    // Return empty but valid data structure on error
    return NextResponse.json({
      summary: {
        today: 0,
        week: 0,
        month: 0,
        byProvider: {},
        byModel: {},
      },
      raw: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
