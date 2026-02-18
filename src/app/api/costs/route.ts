// Mission Control - Costs API
import { NextRequest, NextResponse } from 'next/server';
import { getCostTextSummary, getCostJsonProviders } from '@/lib/costCache';

export async function GET(_request: NextRequest) {
  try {
    // Run text FIRST (fast ~5s), then JSON (slow ~12s but cached for 5min)
    // Sequential avoids CPU contention that caused text timeouts when parallel
    const textSummaries = await getCostTextSummary();
    const providers = await getCostJsonProviders();

    // Aggregate text summaries across ALL providers (codex + claude + etc.)
    let todayCost = 0;
    let monthCost = 0;
    const textByProvider: Record<string, number> = {};

    for (const p of textSummaries) {
      todayCost += p.today;
      monthCost += p.month;
      textByProvider[p.provider] = p.month;
    }

    // If no JSON providers available, return text-based summary
    if (providers.length === 0) {
      return NextResponse.json({
        summary: {
          today: round2(todayCost),
          week: round2(monthCost / 4), // Estimate
          month: round2(monthCost),
          byProvider: Object.fromEntries(
            Object.entries(textByProvider).map(([k, v]) => [k, round2(v)])
          ),
          byModel: {},
        },
        raw: [],
      });
    }

    // Build detailed summary from JSON data
    const now = new Date();
    const localOffset = now.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(now.getTime() - localOffset);
    const todayStr = localDate.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const summary = {
      today: 0,
      week: 0,
      month: 0,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
    };

    const raw: { timestamp: string; provider: string; model: string; input_tokens: number; output_tokens: number; total_cost: number }[] = [];

    for (const provider of providers) {
      const pName = provider.provider || 'unknown';
      if (!summary.byProvider[pName]) summary.byProvider[pName] = 0;
      summary.byProvider[pName] += provider.totals?.totalCost || 0;

      for (const day of provider.daily || []) {
        const dayDate = day.date;
        const dayCost = day.totalCost ??
          (day.modelBreakdowns || []).reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

        if (dayDate === todayStr) summary.today += dayCost;
        if (dayDate >= weekAgo) summary.week += dayCost;
        if (dayDate >= monthStart) summary.month += dayCost;

        for (const model of day.modelBreakdowns || []) {
          const modelCost = typeof model.cost === 'number' ? model.cost : 0;
          const modelName = model.modelName || 'unknown';
          if (!summary.byModel[modelName]) summary.byModel[modelName] = 0;
          summary.byModel[modelName] += modelCost;

          raw.push({
            timestamp: `${dayDate}T00:00:00Z`,
            provider: pName,
            model: modelName,
            input_tokens: day.inputTokens || 0,
            output_tokens: day.outputTokens || 0,
            total_cost: modelCost,
          });
        }
      }
    }

    raw.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Use text summary for today if JSON doesn't have today's data yet
    if (todayCost > summary.today) summary.today = todayCost;
    // Use text summary for month if it's higher (more up-to-date)
    if (monthCost > summary.month) summary.month = monthCost;

    // Round everything
    summary.today = round2(summary.today);
    summary.week = round2(summary.week);
    summary.month = round2(summary.month);
    for (const k of Object.keys(summary.byProvider)) summary.byProvider[k] = round2(summary.byProvider[k]);
    for (const k of Object.keys(summary.byModel)) summary.byModel[k] = round2(summary.byModel[k]);

    return NextResponse.json({ summary, raw });
  } catch (error) {
    console.error('Costs API error:', error);
    return NextResponse.json({
      summary: { today: 0, week: 0, month: 0, byProvider: {}, byModel: {} },
      raw: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
