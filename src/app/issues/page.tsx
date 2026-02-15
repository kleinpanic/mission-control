"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Bug, Shield, Zap, Code, RefreshCw } from "lucide-react";

interface Issue {
  id: string;
  projectId: string;
  severity: string;
  category: string;
  file: string;
  line: number;
  rule: string;
  message: string;
  agentOwner: string;
  status: string;
  discoveredAt: string;
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      
      const res = await fetch(`/api/issues?${params}`);
      const data = await res.json();
      setIssues(data.issues || []);
    } catch (error) {
      console.error("Failed to fetch issues:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [severityFilter, categoryFilter]);

  const severityColors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/50",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    info: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
  };

  const categoryIcons: Record<string, any> = {
    bug: Bug,
    security: Shield,
    performance: Zap,
    "code-smell": Code,
    style: Code,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-zinc-100">Issue Discovery</h1>
        <Button onClick={fetchIssues} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-48 bg-zinc-900 border-zinc-700">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 bg-zinc-900 border-zinc-700">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="code-smell">Code Smell</SelectItem>
            <SelectItem value="style">Style</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Issues List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : issues.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">No issues discovered yet.</p>
            <p className="text-sm text-zinc-600 mt-2">
              Run a scan to detect issues in your projects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const Icon = categoryIcons[issue.category] || Code;
            return (
              <Card key={issue.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Icon className="w-5 h-5 text-zinc-500 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={severityColors[issue.severity]}>
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {issue.category}
                        </Badge>
                        <span className="text-xs text-zinc-600">
                          {issue.projectId}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-zinc-200 mb-1">
                        {issue.message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span>{issue.file}:{issue.line}</span>
                        <span>Rule: {issue.rule}</span>
                        <span>Owner: {issue.agentOwner}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
