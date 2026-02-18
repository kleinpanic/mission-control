// Mission Control - Costs API
// Computes costs from codexbar (Claude/Codex) + session token data (Gemini/xAI/etc.)
// All costs are per-token / per-unit. No flat subscriptions.
import { NextRequest, NextResponse } from 'next/server';
import { getCostTextSummary, getCostJsonProviders } from '@/lib/costCache';
import { getOpenClawStatus } from '@/lib/statusCache';
import {
  calculateTokenCost,
  identifyProvider,
  getProviderColor,
  getAllProviders,
  findModelPricing,
  getModelPricingSummary,
  UNIT_PRICING,
} from '@/lib/providerCosts';

export async function GET(_request: NextRequest) {
  try {
    // Parallel fetch: codexbar data + status data (session tokens)
    const [textSummaries, providers, statusData] = await Promise.all([
      getCostTextSummary(),
      getCostJsonProviders(),
      getOpenClawStatus(),
    ]);

    const now = new Date();
    const localOffset = now.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(now.getTime() - localOffset);
    const todayStr = localDate.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // ──────────────────────────────────────────────
    // 1. Codexbar providers (Claude + Codex) — authoritative cost data
    // ──────────────────────────────────────────────
    const summary = {
      today: 0,
      week: 0,
      month: 0,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, { cost: number; inputTokens: number; outputTokens: number; sessions?: number; pricing?: string }>,
      byAgent: {} as Record<string, { cost: number; tokens: number; sessions: number; models: string[] }>,
    };

    const raw: any[] = [];

    // Process codexbar JSON data (Claude + Codex have real cost tracking)
    for (const provider of providers) {
      const pName = provider.provider || 'unknown';

      for (const day of provider.daily || []) {
        const dayDate = day.date;
        const dayCost = day.totalCost ??
          (day.modelBreakdowns || []).reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

        if (dayDate === todayStr) summary.today += dayCost;
        if (dayDate >= weekAgoStr) summary.week += dayCost;
        if (dayDate >= monthStart) summary.month += dayCost;

        if (!summary.byProvider[pName]) summary.byProvider[pName] = 0;
        if (dayDate >= monthStart) summary.byProvider[pName] += dayCost;

        for (const model of day.modelBreakdowns || []) {
          const modelCost = typeof model.cost === 'number' ? model.cost : 0;
          const modelName = model.modelName || 'unknown';

          if (!summary.byModel[modelName]) {
            summary.byModel[modelName] = {
              cost: 0,
              inputTokens: 0,
              outputTokens: 0,
              pricing: getModelPricingSummary(modelName),
            };
          }
          if (dayDate >= monthStart) {
            summary.byModel[modelName].cost += modelCost;
            summary.byModel[modelName].inputTokens += day.inputTokens || 0;
            summary.byModel[modelName].outputTokens += day.outputTokens || 0;
          }

          raw.push({
            timestamp: `${dayDate}T00:00:00Z`,
            provider: pName,
            model: modelName,
            input_tokens: day.inputTokens || 0,
            output_tokens: day.outputTokens || 0,
            cache_read_tokens: day.cacheReadTokens || 0,
            cache_creation_tokens: day.cacheCreationTokens || 0,
            total_cost: modelCost,
            source: "codexbar",
          });
        }
      }
    }

    // Use text summary for today if JSON is behind (text is more real-time)
    let textToday = 0;
    let textMonth = 0;
    for (const p of textSummaries) {
      textToday += p.today;
      textMonth += p.month;
    }
    if (textToday > summary.today) summary.today = textToday;
    if (textMonth > summary.month) summary.month = textMonth;

    // ──────────────────────────────────────────────
    // 2. Session-based token cost estimation (Gemini, xAI, etc.)
    //    Uses real per-model token pricing from providerCosts.ts
    // ──────────────────────────────────────────────
    const byAgent = statusData?.sessions?.byAgent || [];
    const sessionProviderCosts: Record<string, { input: number; output: number; cost: number; sessions: number }> = {};
    const sessionModelCosts: Record<string, { input: number; output: number; cost: number; sessions: number }> = {};

    for (const ba of byAgent) {
      const agentId = ba.agentId || "unknown";

      for (const s of ba.recent || []) {
        const model = s.model || "";
        const providerId = identifyProvider(model);

        // Skip providers tracked by codexbar (Claude, Codex) — they have authoritative data
        if (providerId === "claude" || providerId === "codex") {
          // Still track per-agent attribution
          if (!summary.byAgent[agentId]) {
            summary.byAgent[agentId] = { cost: 0, tokens: 0, sessions: 0, models: [] };
          }
          summary.byAgent[agentId].sessions++;
          summary.byAgent[agentId].tokens += s.totalTokens || 0;
          if (model && !summary.byAgent[agentId].models.includes(model)) {
            summary.byAgent[agentId].models.push(model);
          }
          continue;
        }

        // For non-codexbar providers: estimate cost from token counts
        const inputTokens = s.inputTokens || 0;
        const outputTokens = s.outputTokens || 0;
        const totalTokens = s.totalTokens || 0;

        // If we don't have input/output breakdown, estimate from totalTokens
        // Typical split: ~85% input, ~15% output
        const estInput = inputTokens > 0 ? inputTokens : Math.round(totalTokens * 0.85);
        const estOutput = outputTokens > 0 ? outputTokens : Math.round(totalTokens * 0.15);

        const { cost, provider: resolvedProvider } = calculateTokenCost(model, estInput, estOutput);

        // Aggregate by provider
        if (!sessionProviderCosts[resolvedProvider]) {
          sessionProviderCosts[resolvedProvider] = { input: 0, output: 0, cost: 0, sessions: 0 };
        }
        sessionProviderCosts[resolvedProvider].input += estInput;
        sessionProviderCosts[resolvedProvider].output += estOutput;
        sessionProviderCosts[resolvedProvider].cost += cost;
        sessionProviderCosts[resolvedProvider].sessions++;

        // Aggregate by model
        const modelKey = model || "unknown";
        if (!sessionModelCosts[modelKey]) {
          sessionModelCosts[modelKey] = { input: 0, output: 0, cost: 0, sessions: 0 };
        }
        sessionModelCosts[modelKey].input += estInput;
        sessionModelCosts[modelKey].output += estOutput;
        sessionModelCosts[modelKey].cost += cost;
        sessionModelCosts[modelKey].sessions++;

        // Per-agent attribution
        if (!summary.byAgent[agentId]) {
          summary.byAgent[agentId] = { cost: 0, tokens: 0, sessions: 0, models: [] };
        }
        summary.byAgent[agentId].cost += cost;
        summary.byAgent[agentId].tokens += totalTokens;
        summary.byAgent[agentId].sessions++;
        if (model && !summary.byAgent[agentId].models.includes(model)) {
          summary.byAgent[agentId].models.push(model);
        }
      }
    }

    // Merge session-based costs into summary
    for (const [pid, data] of Object.entries(sessionProviderCosts)) {
      if (!summary.byProvider[pid]) summary.byProvider[pid] = 0;
      summary.byProvider[pid] += data.cost;
      summary.month += data.cost;
      // Session data is "current" so add to today and week as well
      summary.today += data.cost;
      summary.week += data.cost;
    }

    for (const [modelName, data] of Object.entries(sessionModelCosts)) {
      if (!summary.byModel[modelName]) {
        summary.byModel[modelName] = {
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          sessions: 0,
          pricing: getModelPricingSummary(modelName),
        };
      }
      summary.byModel[modelName].cost += data.cost;
      summary.byModel[modelName].inputTokens += data.input;
      summary.byModel[modelName].outputTokens += data.output;
      summary.byModel[modelName].sessions = data.sessions;
    }

    // ──────────────────────────────────────────────
    // 3. Round everything and build response
    // ──────────────────────────────────────────────
    summary.today = round2(summary.today);
    summary.week = round2(summary.week);
    summary.month = round2(summary.month);
    for (const k of Object.keys(summary.byProvider)) {
      summary.byProvider[k] = round2(summary.byProvider[k]);
    }
    for (const k of Object.keys(summary.byModel)) {
      summary.byModel[k].cost = round2(summary.byModel[k].cost);
    }
    for (const k of Object.keys(summary.byAgent)) {
      summary.byAgent[k].cost = round2(summary.byAgent[k].cost);
    }

    raw.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Provider detail cards with color and unit pricing info
    const providerDetails = getAllProviders().map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      unitType: p.unitType,
      trackingMethod: p.trackingMethod,
      description: p.description,
      monthlyCost: round2(summary.byProvider[p.id] || 0),
      unitPricing: UNIT_PRICING.filter(u => u.provider === p.id).map(u => ({
        service: u.service,
        cost: u.costPerUnit,
        unitLabel: u.unitLabel,
        unitScale: u.unitScale,
        notes: u.notes,
      })),
    })).filter(p => p.monthlyCost > 0 || p.trackingMethod === "codexbar" || p.trackingMethod === "session-tokens");

    return NextResponse.json({
      summary,
      raw,
      providers: providerDetails,
      sessionEstimates: Object.entries(sessionProviderCosts).map(([pid, data]) => ({
        provider: pid,
        color: getProviderColor(pid),
        inputTokens: data.input,
        outputTokens: data.output,
        estimatedCost: round2(data.cost),
        sessions: data.sessions,
        note: "Estimated from session token counts using per-model API pricing",
      })),
      pricingNote: "All costs computed from actual usage. Token-based providers use per-model API pricing. Non-token providers (Brave, ElevenLabs, Twilio) tracked when API logs are available.",
    });
  } catch (error) {
    console.error('Costs API error:', error);
    return NextResponse.json({
      summary: { today: 0, week: 0, month: 0, byProvider: {}, byModel: {}, byAgent: {} },
      raw: [],
      providers: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
