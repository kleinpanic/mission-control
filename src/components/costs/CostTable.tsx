"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CostTableProps {
  data: any[];
}

interface NormalizedEntry {
  date: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

function normalizeEntries(rawData: any[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = [];

  for (const item of rawData) {
    // codexbar daily format: { date, totalCost, inputTokens, outputTokens, modelBreakdowns: [{modelName, cost}] }
    if (item.date && item.modelBreakdowns) {
      for (const model of item.modelBreakdowns) {
        entries.push({
          date: item.date,
          provider: "", // Not in daily breakdown
          model: model.modelName || "unknown",
          inputTokens: model.inputTokens || 0,
          outputTokens: model.outputTokens || 0,
          totalCost: model.cost || 0,
        });
      }
      // If no model breakdowns but has total
      if (item.modelBreakdowns.length === 0 && item.totalCost > 0) {
        entries.push({
          date: item.date,
          provider: "",
          model: "unknown",
          inputTokens: item.inputTokens || 0,
          outputTokens: item.outputTokens || 0,
          totalCost: item.totalCost || 0,
        });
      }
    }
    // Pre-normalized format: { timestamp, provider, model, total_cost, ... }
    else if (item.timestamp || item.provider || item.model) {
      entries.push({
        date: item.timestamp || item.date || "",
        provider: item.provider || "",
        model: item.model || "",
        inputTokens: item.input_tokens || item.inputTokens || 0,
        outputTokens: item.output_tokens || item.outputTokens || 0,
        totalCost: item.total_cost || item.totalCost || item.cost || 0,
      });
    }
  }

  // Sort by date descending
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; // Return raw string if can't parse
  
  // If it's just a date (YYYY-MM-DD), show that
  if (dateStr.length === 10) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CostTable({ data }: CostTableProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Recent Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-zinc-500">
            No usage data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const entries = normalizeEntries(data).slice(0, 30);

  if (entries.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Recent Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-zinc-500">
            No usage data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">Recent Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Date</TableHead>
                {entries.some(e => e.provider) && (
                  <TableHead className="text-zinc-400">Provider</TableHead>
                )}
                <TableHead className="text-zinc-400">Model</TableHead>
                <TableHead className="text-zinc-400 text-right">Input</TableHead>
                <TableHead className="text-zinc-400 text-right">Output</TableHead>
                <TableHead className="text-zinc-400 text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow
                  key={`${entry.date}-${entry.model}-${index}`}
                  className="border-zinc-800"
                >
                  <TableCell className="text-zinc-300">
                    {formatDate(entry.date)}
                  </TableCell>
                  {entries.some(e => e.provider) && (
                    <TableCell className="text-zinc-300">{entry.provider || "—"}</TableCell>
                  )}
                  <TableCell className="text-zinc-400 text-sm">
                    {entry.model}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-right">
                    {entry.inputTokens > 0 ? entry.inputTokens.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-right">
                    {entry.outputTokens > 0 ? entry.outputTokens.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-100 text-right font-medium">
                    ${entry.totalCost.toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
