"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function getModelColor(model: string | null | undefined): string {
  if (!model) return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (m.includes("gemini") || m.includes("google")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (m.includes("grok") || m.includes("xai")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-purple-500/20 text-purple-400 border-purple-500/30";
}

function getModelDot(model: string | null | undefined): string {
  if (!model) return "bg-zinc-500";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "bg-red-400";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex")) return "bg-emerald-400";
  if (m.includes("gemini") || m.includes("google")) return "bg-blue-400";
  if (m.includes("grok") || m.includes("xai")) return "bg-yellow-400";
  return "bg-purple-400";
}

interface HeartbeatDetail {
  agentId: string;
  enabled: boolean;
  intervalMs: number;
  intervalHuman: string;
  model: string | null;
  agentName: string;
  sessionCount: number;
  prompt: string | null;
  lastUpdatedAt: number | null;
  lastActiveAge: string | null;
  workspaceDir: string | null;
}

export default function HeartbeatDetailPage() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agentId");
  const [data, setData] = useState<HeartbeatDetail | null>(null);
  const [allHeartbeats, setAllHeartbeats] = useState<HeartbeatDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (agentId) {
          const resp = await fetch(`/api/heartbeat?agentId=${agentId}`);
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            setError(err.error || `HTTP ${resp.status}`);
          } else {
            setData(await resp.json());
          }
        } else {
          const resp = await fetch("/api/heartbeat");
          if (resp.ok) {
            const result = await resp.json();
            setAllHeartbeats(result.heartbeats || []);
          }
        }
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <Card className="bg-red-950/30 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-400">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Single agent detail
  if (agentId && data) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-xl text-zinc-100 flex items-center gap-3">
              <Activity className="w-6 h-6" />
              <span>{data.agentName}</span>
              <Badge className={cn("text-xs", getModelColor(data.model))}>
                {data.model || "default model"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Agent ID" value={data.agentId} />
              <DetailRow label="Status" value={data.enabled ? "Enabled" : "Disabled"} />
              <DetailRow label="Interval" value={data.intervalHuman} />
              <DetailRow label="Interval (ms)" value={data.intervalMs.toLocaleString()} />
              <DetailRow label="Sessions" value={String(data.sessionCount)} />
              <DetailRow label="Last Active" value={data.lastActiveAge || "Unknown"} />
              {data.lastUpdatedAt && (
                <DetailRow label="Last Updated" value={new Date(data.lastUpdatedAt).toLocaleString()} />
              )}
              {data.workspaceDir && (
                <DetailRow label="Workspace" value={data.workspaceDir} mono />
              )}
            </div>

            {data.prompt && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Heartbeat Prompt</h4>
                <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{data.prompt}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // All heartbeats list
  return (
    <div className="space-y-6">
      <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
        <Activity className="w-6 h-6" /> All Heartbeats
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allHeartbeats.map((hb) => (
          <Link key={hb.agentId} href={`/heartbeat?agentId=${hb.agentId}`}>
            <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full", getModelDot(hb.model))} />
                    <span className="font-semibold text-zinc-100">{hb.agentName}</span>
                  </div>
                  <Badge className={cn("text-[10px]", getModelColor(hb.model))}>
                    {hb.model || "default"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Interval:</span>
                  <span className="text-zinc-300">{hb.intervalHuman}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Sessions:</span>
                  <span className="text-zinc-300">{hb.sessionCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Last Active:</span>
                  <span className="text-zinc-300">{hb.lastActiveAge || "—"}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className={cn("text-sm text-zinc-200", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
