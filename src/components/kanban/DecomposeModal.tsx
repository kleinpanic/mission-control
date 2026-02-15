"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, GitBranch } from "lucide-react";
import { toast } from "sonner";

interface Subtask {
  title: string;
  description: string;
  priority: string;
  complexity: string;
  estimatedMinutes?: number;
}

interface DecomposeModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onDecomposed: () => void;
}

export function DecomposeModal({ open, onClose, taskId, taskTitle, onDecomposed }: DecomposeModalProps) {
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleDecompose = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!res.ok) {
        throw new Error("Decomposition failed");
      }

      const data = await res.json();
      setSubtasks(data.subtasks);
      setReasoning(data.reasoning);
      setShowPreview(true);
    } catch (error) {
      toast.error("Failed to decompose task");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      // Create subtasks in database
      for (const subtask of subtasks) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: subtask.title,
            description: subtask.description,
            status: "ready",
            priority: subtask.priority,
            complexity: subtask.complexity,
            type: "auto",
            parentId: taskId,
            estimatedMinutes: subtask.estimatedMinutes,
            tags: ["decomposed", "subtask"],
          }),
        });
      }

      toast.success(`Created ${subtasks.length} subtasks`);
      onDecomposed();
      handleClose();
    } catch (error) {
      toast.error("Failed to create subtasks");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubtasks([]);
    setReasoning("");
    setShowPreview(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Decompose Task
          </DialogTitle>
          <DialogDescription>
            Break down &ldquo;{taskTitle}&rdquo; into smaller, actionable subtasks
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              This will use an LLM to analyze the task and suggest a decomposition into 3-7 subtasks.
              You&apos;ll be able to preview and approve before creating them.
            </p>
            <Button
              onClick={handleDecompose}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? "Analyzing task..." : "Generate Subtasks"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reasoning */}
            <div className="p-4 bg-zinc-800 rounded-lg">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Decomposition Strategy:</h4>
              <p className="text-sm text-zinc-400">{reasoning}</p>
            </div>

            {/* Subtasks Preview */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-zinc-300">
                Proposed Subtasks ({subtasks.length}):
              </h4>
              {subtasks.map((subtask, index) => (
                <div key={index} className="p-4 bg-zinc-800 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <h5 className="font-medium text-zinc-100">{subtask.title}</h5>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {subtask.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {subtask.complexity}
                      </Badge>
                      {subtask.estimatedMinutes && (
                        <Badge variant="outline" className="text-xs">
                          {subtask.estimatedMinutes}m
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400">{subtask.description}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1"
                variant="default"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Check className="w-4 h-4 mr-2" />
                Approve & Create
              </Button>
              <Button
                onClick={() => setShowPreview(false)}
                disabled={loading}
                variant="outline"
              >
                <X className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
