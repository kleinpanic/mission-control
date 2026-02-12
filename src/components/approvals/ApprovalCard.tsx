"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, User, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApprovalRequest {
  id: string;
  timestamp: string;
  agent: string;
  type: "task" | "action" | "evolution" | "deployment";
  title: string;
  description: string;
  details: any;
  status: "pending" | "approved" | "rejected";
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  notes?: string;
}

interface ApprovalCardProps {
  approval: ApprovalRequest;
  onApprove: (id: string, notes?: string) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
}

export function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(approval.id, notes || undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(approval.id, notes || undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "task": return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case "action": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
      case "evolution": return "bg-violet-500/20 text-violet-400 border-violet-500/50";
      case "deployment": return "bg-amber-500/20 text-amber-400 border-amber-500/50";
      default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "rejected": return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
      case "rejected": return "bg-red-500/20 text-red-400 border-red-500/50";
      case "pending": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/50";
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("text-[10px]", getTypeColor(approval.type))}>
                {approval.type.toUpperCase()}
              </Badge>
              <Badge className={cn("text-[10px]", getStatusColor(approval.status))}>
                {getStatusIcon(approval.status)}
                <span className="ml-1">{approval.status.toUpperCase()}</span>
              </Badge>
            </div>
            <CardTitle className="text-lg text-zinc-100">{approval.title}</CardTitle>
            <CardDescription className="text-zinc-400 mt-1">
              {approval.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <User className="w-4 h-4" />
            <span>Agent: <span className="text-zinc-200">{approval.agent}</span></span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4" />
            <span>{new Date(approval.timestamp).toLocaleString()}</span>
          </div>
        </div>

        {/* Details */}
        {approval.details && Object.keys(approval.details).length > 0 && (
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">Details</span>
            </div>
            <pre className="text-xs text-zinc-400 overflow-auto max-h-40">
              {JSON.stringify(approval.details, null, 2)}
            </pre>
          </div>
        )}

        {/* Notes (if approved/rejected) */}
        {approval.notes && (
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
            <p className="text-xs text-zinc-300">
              <span className="font-medium">Notes:</span> {approval.notes}
            </p>
            {approval.approvedBy && (
              <p className="text-xs text-zinc-400 mt-1">
                By {approval.approvedBy} at{" "}
                {new Date(approval.approvedAt || approval.rejectedAt || "").toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons (only for pending) */}
        {approval.status === "pending" && (
          <div className="space-y-3 pt-2">
            <textarea
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Add notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={handleReject}
                disabled={isProcessing}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
