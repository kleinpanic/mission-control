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

export async function GET(_request: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedCosts && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(cachedCosts);
    }

    // First, get summary from simple text output (most reliable)
    let todayCost = 0;
    let monthCost = 0;
    try {
      const { stdout: textOutput, stderr: textStderr } = await execAsync(
        '/home/broklein/.local/bin/codexbar cost',
        { timeout: 5000, env: { ...process.env, HOME: '/home/broklein' } }
      );
      console.log('codexbar text output:', textOutput);
      if (textStderr) console.warn('codexbar stderr:', textStderr);
      // Parse "Today: $9.08 · 37M tokens" and "Last 30 days: $41.97 · 169M tokens"
      const todayMatch = textOutput.match(/Today:\s*\$([0-9.]+)/);
      if (todayMatch) todayCost = parseFloat(todayMatch[1]);
      const monthMatch = textOutput.match(/Last 30 days:\s*\$([0-9.]+)/);
      if (monthMatch) monthCost = parseFloat(monthMatch[1]);
      console.log('Parsed costs:', { todayCost, monthCost });
    } catch (textError) {
      console.warn('Failed to fetch cost from text output:', textError);
    }

    // Try to get detailed JSON data (may fail for some providers)
    let providers: CodexbarProviderData[] = [];
    try {
      const { stdout, stderr } = await execAsync(
        'codexbar cost --format json --provider all --pretty 2>/dev/null || codexbar cost --format json --pretty 2>/dev/null || echo "[]"',
        { timeout: 10000, shell: '/bin/bash' }
      );
      if (stdout.trim() && stdout.trim() !== '[]') {
        providers = JSON.parse(stdout);
      }
    } catch (jsonError) {
      console.warn('Failed to fetch JSON cost data, using text summary only');
    }
    
    const todayCostFromText = todayCost;

    // Aggregate costs - start with text-parsed values as base
    const summary = {
      today: todayCost,
      week: 0,
      month: monthCost,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
    };

    // If no JSON providers, return text-based summary
    if (providers.length === 0) {
      const result = {
        summary: {
          today: Math.round(todayCost * 100) / 100,
          week: Math.round(monthCost / 4 * 100) / 100, // Estimate week as month/4
          month: Math.round(monthCost * 100) / 100,
          byProvider: { codex: Math.round(monthCost * 100) / 100 },
          byModel: {},
        },
        raw: [],
      };
      cachedCosts = result;
      cacheTimestamp = now;
      return NextResponse.json(result);
    }

    const now_date = new Date();
    // Use local date for "today" comparison (not UTC) to match user's timezone
    const localOffset = now_date.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(now_date.getTime() - localOffset);
    const todayStr = localDate.toISOString().slice(0, 10); // "2026-02-14" in local time
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

        // Calculate day cost from modelBreakdowns if totalCost is missing
        const dayCost = day.totalCost ?? 
          day.modelBreakdowns.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

        // Time-based aggregation
        if (dayDate === todayStr) {
          summary.today += dayCost;
        }
        if (dayDate >= weekAgo) {
          summary.week += dayCost;
        }
        if (dayDate >= monthStart) {
          summary.month += dayCost;
        }

        // Model aggregation from breakdowns
        for (const model of day.modelBreakdowns) {
          const modelCost = typeof model.cost === 'number' ? model.cost : 0;
          if (!summary.byModel[model.modelName]) {
            summary.byModel[model.modelName] = 0;
          }
          summary.byModel[model.modelName] += modelCost;

          // Add to raw for table display
          raw.push({
            timestamp: `${dayDate}T00:00:00Z`,
            provider: provider.provider,
            model: model.modelName,
            input_tokens: day.inputTokens,
            output_tokens: day.outputTokens,
            total_cost: modelCost,
          });
        }
      }
    }

    // Sort raw by date (newest first)
    raw.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Use text output for today if it's more recent than aggregated data
    if (todayCostFromText > summary.today) {
      summary.today = todayCostFromText;
    }
    
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
