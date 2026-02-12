// Mission Control - Costs API
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CodexbarCostData {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  timestamp: string;
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

    const data: CodexbarCostData[] = JSON.parse(stdout);

    // Aggregate costs
    const summary = {
      today: 0,
      week: 0,
      month: 0,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
    };

    const now_date = new Date();
    const today_start = new Date(now_date.getFullYear(), now_date.getMonth(), now_date.getDate());
    const week_start = new Date(now_date.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month_start = new Date(now_date.getFullYear(), now_date.getMonth(), 1);

    for (const entry of data) {
      const entry_date = new Date(entry.timestamp);
      const cost = entry.total_cost;

      // Time-based aggregation
      if (entry_date >= today_start) {
        summary.today += cost;
      }
      if (entry_date >= week_start) {
        summary.week += cost;
      }
      if (entry_date >= month_start) {
        summary.month += cost;
      }

      // Provider aggregation
      if (!summary.byProvider[entry.provider]) {
        summary.byProvider[entry.provider] = 0;
      }
      summary.byProvider[entry.provider] += cost;

      // Model aggregation
      if (!summary.byModel[entry.model]) {
        summary.byModel[entry.model] = 0;
      }
      summary.byModel[entry.model] += cost;
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
      raw: data,
    };

    // Update cache
    cachedCosts = result;
    cacheTimestamp = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Costs API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
