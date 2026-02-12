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

interface CostEntry {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  timestamp: string;
}

interface CostTableProps {
  data: CostEntry[];
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CostTable({ data }: CostTableProps) {
  if (data.length === 0) {
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

  // Show last 20 entries
  const recentData = data.slice(0, 20);

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
                <TableHead className="text-zinc-400">Time</TableHead>
                <TableHead className="text-zinc-400">Provider</TableHead>
                <TableHead className="text-zinc-400">Model</TableHead>
                <TableHead className="text-zinc-400 text-right">Input</TableHead>
                <TableHead className="text-zinc-400 text-right">Output</TableHead>
                <TableHead className="text-zinc-400 text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentData.map((entry, index) => (
                <TableRow
                  key={`${entry.timestamp}-${index}`}
                  className="border-zinc-800"
                >
                  <TableCell className="text-zinc-300">
                    {formatDate(entry.timestamp)}
                  </TableCell>
                  <TableCell className="text-zinc-300">{entry.provider}</TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {entry.model}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-right">
                    {entry.input_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-right">
                    {entry.output_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-zinc-100 text-right font-medium">
                    ${(entry.total_cost ?? 0).toFixed(4)}
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
