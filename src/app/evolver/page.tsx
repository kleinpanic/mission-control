"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Dna,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Lightbulb,
  Archive,
  Activity,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Gene {
  id: string;
  category: string;
  signals_match: string[];
  preconditions: string[];
  strategy: string[];
  enabled?: boolean;
}

interface Capsule {
  id: string;
  description: string;
  learned_from?: string;
  timestamp?: string;
}

interface EvolutionEvent {
  id: string;
  timestamp: string;
  gene_id: string;
  mutation: {
    description: string;
    files_changed: string[];
    blast_radius: string;
  };
  outcome: "success" | "failure" | "pending";
}

interface PendingEvolution {
  id: string;
  timestamp: string;
  gene_id: string;
  title: string;
  description: string;
  proposed_changes: any;
  status: "pending" | "approved" | "rejected";
}

interface EvolverStats {
  totalGenes: number;
  enabledGenes: number;
  totalCapsules: number;
  totalEvents: number;
  successfulEvolutions: number;
  failedEvolutions: number;
  pendingEvolutions: number;
}

export default function EvolverPage() {
  const [genes, setGenes] = useState<Gene[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [events, setEvents] = useState<EvolutionEvent[]>([]);
  const [pending, setPending] = useState<PendingEvolution[]>([]);
  const [stats, setStats] = useState<EvolverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evolver?type=all");
      if (!res.ok) {
        throw new Error("Failed to fetch evolver data");
      }

      const data = await res.json();
      setGenes(data.genes || []);
      setCapsules(data.capsules || []);
      setEvents(data.events || []);
      setPending(data.pending || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error("Failed to fetch evolver data:", error);
      toast.error("Failed to load evolver data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleGene = async (geneId: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/evolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-gene", id: geneId, enabled }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle gene");
      }

      toast.success(`Gene ${enabled ? "enabled" : "disabled"}`);
      fetchData();
    } catch (error) {
      console.error("Failed to toggle gene:", error);
      toast.error("Failed to toggle gene");
    }
  };

  const handleApproveEvolution = async (id: string) => {
    try {
      const res = await fetch("/api/evolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id }),
      });

      if (!res.ok) {
        throw new Error("Failed to approve evolution");
      }

      toast.success("Evolution approved and applied!");
      fetchData();
    } catch (error) {
      console.error("Failed to approve evolution:", error);
      toast.error("Failed to approve evolution");
    }
  };

  const handleRejectEvolution = async (id: string) => {
    try {
      const res = await fetch("/api/evolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", id }),
      });

      if (!res.ok) {
        throw new Error("Failed to reject evolution");
      }

      toast.success("Evolution rejected");
      fetchData();
    } catch (error) {
      console.error("Failed to reject evolution:", error);
      toast.error("Failed to reject evolution");
    }
  };

  const handleRunReview = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/evolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-review" }),
      });

      if (!res.ok) {
        throw new Error("Failed to run evolution review");
      }

      const result = await res.json();
      if (result.success) {
        toast.success("Evolution review completed!");
      } else {
        toast.error(`Evolution review failed: ${result.error}`);
      }

      fetchData();
    } catch (error) {
      console.error("Failed to run evolution review:", error);
      toast.error("Failed to run evolution review");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Capability Evolver</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Dna className="w-7 h-7" />
            Capability Evolver
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Self-improvement engine • Manage evolution capabilities and proposals
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            className="bg-zinc-800 hover:bg-zinc-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleRunReview}
            disabled={processing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Play className={cn("w-4 h-4 mr-2", processing && "animate-spin")} />
            Run Evolution Review
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Active Genes</p>
                  <p className="text-2xl font-bold text-emerald-500">
                    {stats.enabledGenes}/{stats.totalGenes}
                  </p>
                </div>
                <Dna className="w-8 h-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Success Rate</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {stats.totalEvents > 0
                      ? Math.round((stats.successfulEvolutions / stats.totalEvents) * 100)
                      : 0}
                    %
                  </p>
                </div>
                <Activity className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {stats.pendingEvolutions}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Capsules</p>
                  <p className="text-2xl font-bold text-violet-500">{stats.totalCapsules}</p>
                </div>
                <Archive className="w-8 h-8 text-violet-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="genes" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-zinc-800">
          <TabsTrigger value="genes">
            Genes {stats && `(${stats.totalGenes})`}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending {stats && stats.pendingEvolutions > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                {stats.pendingEvolutions}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">
            History {stats && `(${stats.totalEvents})`}
          </TabsTrigger>
          <TabsTrigger value="capsules">
            Capsules {stats && `(${stats.totalCapsules})`}
          </TabsTrigger>
        </TabsList>

        {/* Genes Tab */}
        <TabsContent value="genes" className="mt-6 space-y-4">
          {genes.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-zinc-400">No genes found</p>
              </CardContent>
            </Card>
          ) : (
            genes.map((gene) => (
              <Card key={gene.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn(
                          "text-[10px]",
                          gene.category === "repair" && "bg-red-500/20 text-red-400 border-red-500/50",
                          gene.category === "optimize" && "bg-blue-500/20 text-blue-400 border-blue-500/50"
                        )}>
                          {gene.category.toUpperCase()}
                        </Badge>
                        <Badge className={cn(
                          "text-[10px]",
                          gene.enabled !== false
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                            : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
                        )}>
                          {gene.enabled !== false ? "ENABLED" : "DISABLED"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base text-zinc-100 font-mono">
                        {gene.id}
                      </CardTitle>
                    </div>
                    <Button
                      size="sm"
                      variant={gene.enabled !== false ? "destructive" : "default"}
                      onClick={() => handleToggleGene(gene.id, gene.enabled === false)}
                    >
                      {gene.enabled !== false ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-300 mb-1">Signals Match:</p>
                    <div className="flex flex-wrap gap-1">
                      {gene.signals_match.map((signal, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px]">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-300 mb-1">Strategy:</p>
                    <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
                      {gene.strategy.slice(0, 3).map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                      {gene.strategy.length > 3 && (
                        <li className="text-zinc-500">
                          ...and {gene.strategy.length - 3} more steps
                        </li>
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Pending Evolutions Tab */}
        <TabsContent value="pending" className="mt-6 space-y-4">
          {pending.filter(p => p.status === "pending").length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-zinc-400">No pending evolutions</p>
              </CardContent>
            </Card>
          ) : (
            pending
              .filter(p => p.status === "pending")
              .map((evo) => (
                <Card key={evo.id} className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-zinc-100">{evo.title}</CardTitle>
                    <CardDescription className="text-zinc-400">{evo.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Clock className="w-4 h-4" />
                      {new Date(evo.timestamp).toLocaleString()}
                    </div>
                    {evo.proposed_changes && (
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                        <pre className="text-xs text-zinc-400 overflow-auto max-h-40">
                          {JSON.stringify(evo.proposed_changes, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveEvolution(evo.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve & Apply
                      </Button>
                      <Button
                        onClick={() => handleRejectEvolution(evo.id)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-6 space-y-4">
          {events.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-zinc-400">No evolution events yet</p>
              </CardContent>
            </Card>
          ) : (
            events.slice().reverse().map((event) => (
              <Card key={event.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn(
                          "text-[10px]",
                          event.outcome === "success" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
                          event.outcome === "failure" && "bg-red-500/20 text-red-400 border-red-500/50",
                          event.outcome === "pending" && "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                        )}>
                          {event.outcome === "success" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {event.outcome === "failure" && <XCircle className="w-3 h-3 mr-1" />}
                          {event.outcome === "pending" && <Clock className="w-3 h-3 mr-1" />}
                          {event.outcome.toUpperCase()}
                        </Badge>
                      </div>
                      <CardTitle className="text-base text-zinc-100">
                        {event.mutation.description}
                      </CardTitle>
                      <CardDescription className="text-zinc-400 text-xs mt-1">
                        {new Date(event.timestamp).toLocaleString()} • {event.gene_id}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="text-zinc-400">Files changed:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.mutation.files_changed.map((file, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] font-mono">
                            {file}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Blast radius: {event.mutation.blast_radius}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Capsules Tab */}
        <TabsContent value="capsules" className="mt-6 space-y-4">
          {capsules.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-zinc-400">No capsules learned yet</p>
              </CardContent>
            </Card>
          ) : (
            capsules.map((capsule) => (
              <Card key={capsule.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    {capsule.id}
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    {capsule.description}
                  </CardDescription>
                </CardHeader>
                {(capsule.learned_from || capsule.timestamp) && (
                  <CardContent className="text-xs text-zinc-500">
                    {capsule.learned_from && <p>Learned from: {capsule.learned_from}</p>}
                    {capsule.timestamp && <p>Created: {new Date(capsule.timestamp).toLocaleString()}</p>}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
