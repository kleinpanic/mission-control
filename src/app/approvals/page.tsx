"use client";

import { useEffect, useState, useCallback } from "react";
import { ApprovalCard, ApprovalRequest } from "@/components/approvals/ApprovalCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const [approvalsRes, statsRes] = await Promise.all([
        fetch("/api/approvals?status=all"),
        fetch("/api/approvals?stats=true"),
      ]);

      if (!approvalsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch approvals");
      }

      const approvalsData = await approvalsRes.json();
      const statsData = await statsRes.json();

      setApprovals(approvalsData.approvals || []);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleApprove = async (id: string, notes?: string) => {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve", notes }),
      });

      if (!res.ok) {
        throw new Error("Failed to approve");
      }

      toast.success("Approval request approved!");
      fetchApprovals();
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (id: string, notes?: string) => {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "reject", notes }),
      });

      if (!res.ok) {
        throw new Error("Failed to reject");
      }

      toast.success("Approval request rejected");
      fetchApprovals();
    } catch (error) {
      console.error("Failed to reject:", error);
      toast.error("Failed to reject request");
    }
  };

  const filteredApprovals = approvals.filter((approval) => {
    if (activeTab === "all") return true;
    return approval.status === activeTab;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Autonomy Approvals</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 bg-zinc-800" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 bg-zinc-800" />
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
          <h1 className="text-2xl font-bold text-zinc-100">Autonomy Approvals</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review and approve pending autonomous agent actions
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchApprovals}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Total</p>
                  <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-zinc-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Approved</p>
                  <p className="text-2xl font-bold text-emerald-500">{stats.approved}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Rejected</p>
                  <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Queue */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-zinc-800">
          <TabsTrigger value="pending">
            Pending {stats && stats.pending > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {filteredApprovals.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-8 pb-8">
                {stats?.total === 0 ? (
                  <div className="max-w-md mx-auto text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-100 mb-1">No Approval Requests Yet</h3>
                      <p className="text-sm text-zinc-400">
                        Agents submit approval requests when performing high-impact actions like deployments,
                        config changes, or expensive operations during autonomous mode.
                      </p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 text-left space-y-2">
                      <h4 className="text-xs font-medium text-zinc-300 uppercase">How Approvals Work</h4>
                      <ul className="text-xs text-zinc-400 space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">1.</span>
                          <span>An agent encounters a high-impact action during autonomous work</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">2.</span>
                          <span>It submits an approval request with context and risk assessment</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">3.</span>
                          <span>You review, approve, or reject from this dashboard</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">4.</span>
                          <span>The agent proceeds (or halts) based on your decision</span>
                        </li>
                      </ul>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Configure approval requirements in each agent&apos;s AGENTS.md file under the autonomous mode section.
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-center">
                    {activeTab === "pending"
                      ? "No pending approvals — all caught up!"
                      : `No ${activeTab} approvals`}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
