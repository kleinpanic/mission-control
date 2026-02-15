"use client";

import { useState, useEffect } from "react";
import { Task, TaskPriority, TaskType, TaskStatus, TaskComplexity, TaskDanger } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  task?: Task | null;
  agents?: { id: string; name: string }[];
}

const COMMON_MODELS = [
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-5",
  "google-gemini-cli/gemini-3-flash-preview",
  "google-gemini-cli/gemini-3-pro-exp",
  "openai/gpt-5.2",
];

export function TaskModal({ open, onClose, onSubmit, task, agents = [] }: TaskModalProps) {
  // Basic fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [type, setType] = useState<TaskType>("manual");
  const [status, setStatus] = useState<TaskStatus>("intake");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [tags, setTags] = useState("");
  
  // Extended fields
  const [complexity, setComplexity] = useState<TaskComplexity>("simple");
  const [danger, setDanger] = useState<TaskDanger>("safe");
  const [detailScore, setDetailScore] = useState<number | "">("");
  const [minDetailRequired, setMinDetailRequired] = useState<number | "">("");
  const [recommendedModel, setRecommendedModel] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | "">("");
  const [blockedBy, setBlockedBy] = useState<string>("");
  const [blockerDescription, setBlockerDescription] = useState<string>("");
  const [parentId, setParentId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setType(task.type);
      setStatus(task.status);
      setAssignedTo(task.assignedTo || "");
      setTags(task.tags.join(", "));
      setComplexity(task.complexity || "simple");
      setDanger(task.danger || "safe");
      setDetailScore(task.detailScore ?? "");
      setMinDetailRequired(task.minDetailRequired ?? "");
      setRecommendedModel(task.recommendedModel || "");
      setDueDate(task.dueDate || "");
      setEstimatedMinutes(task.estimatedMinutes ?? "");
      setBlockedBy(task.blockedBy?.join(", ") || "");
      setBlockerDescription(task.blockerDescription || "");
      setParentId(task.parentId || "");
      setProjectId(task.projectId || "");
    } else {
      // Reset to defaults
      setTitle("");
      setDescription("");
      setPriority("medium");
      setType("manual");
      setStatus("intake");
      setAssignedTo("");
      setTags("");
      setComplexity("simple");
      setDanger("safe");
      setDetailScore("");
      setMinDetailRequired("");
      setRecommendedModel("");
      setDueDate("");
      setEstimatedMinutes("");
      setBlockedBy("");
      setBlockerDescription("");
      setParentId("");
      setProjectId("");
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
      title,
      description: description || undefined,
      status: task?.status || status,
      priority,
      complexity,
      danger,
      type,
      assignedTo: assignedTo || null,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      detailScore: detailScore !== "" ? Number(detailScore) : undefined,
      minDetailRequired: minDetailRequired !== "" ? Number(minDetailRequired) : undefined,
      recommendedModel: recommendedModel || undefined,
      dueDate: dueDate || undefined,
      estimatedMinutes: estimatedMinutes !== "" ? Number(estimatedMinutes) : undefined,
      blockedBy: blockedBy ? blockedBy.split(",").map((b) => b.trim()).filter(Boolean) : undefined,
      blockerDescription: blockerDescription || undefined,
      parentId: parentId || undefined,
      projectId: projectId || undefined,
      statusChangedAt: task?.statusChangedAt,
      completedAt: task?.completedAt,
      source: task?.source,
    };
    
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="blocking">Blocking</TabsTrigger>
              <TabsTrigger value="meta">Meta</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title*</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  className="bg-zinc-800 border-zinc-700"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional task description"
                  className="bg-zinc-800 border-zinc-700 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                  >
                    <option value="intake">Intake</option>
                    <option value="ready">Ready</option>
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="paused">Paused</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign to Agent</Label>
                <select
                  id="assignedTo"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., urgent, frontend, bug"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="complexity">Complexity</Label>
                  <select
                    id="complexity"
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value as TaskComplexity)}
                    className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                  >
                    <option value="trivial">Trivial</option>
                    <option value="simple">Simple</option>
                    <option value="moderate">Moderate</option>
                    <option value="complex">Complex</option>
                    <option value="epic">Epic</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="danger">Danger Level</Label>
                  <select
                    id="danger"
                    value={danger}
                    onChange={(e) => setDanger(e.target.value as TaskDanger)}
                    className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                  >
                    <option value="safe">Safe</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value as TaskType)}
                    className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                  >
                    <option value="manual">Manual</option>
                    <option value="auto">Auto</option>
                    <option value="sync">Sync</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="detailScore">Detail Score</Label>
                  <Input
                    id="detailScore"
                    type="number"
                    value={detailScore}
                    onChange={(e) => setDetailScore(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0-100"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minDetailRequired">Min Detail Required</Label>
                  <Input
                    id="minDetailRequired"
                    type="number"
                    value={minDetailRequired}
                    onChange={(e) => setMinDetailRequired(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0-100"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recommendedModel">Recommended Model</Label>
                <div className="flex gap-2">
                  <select
                    id="recommendedModel"
                    value={recommendedModel}
                    onChange={(e) => setRecommendedModel(e.target.value)}
                    className="flex-1 h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
                  >
                    <option value="">None</option>
                    {COMMON_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRecommendedModel("")}
                    className="bg-zinc-800 border-zinc-700"
                  >
                    Clear
                  </Button>
                </div>
                <Input
                  placeholder="Or enter custom model"
                  value={recommendedModel}
                  onChange={(e) => setRecommendedModel(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedMinutes">Estimated Minutes</Label>
                  <Input
                    id="estimatedMinutes"
                    type="number"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g., 30"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Blocking Tab */}
            <TabsContent value="blocking" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="blockedBy">Blocked By (comma-separated task IDs)</Label>
                <Input
                  id="blockedBy"
                  value={blockedBy}
                  onChange={(e) => setBlockedBy(e.target.value)}
                  placeholder="e.g., task-123, task-456"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockerDescription">Blocker Description</Label>
                <Textarea
                  id="blockerDescription"
                  value={blockerDescription}
                  onChange={(e) => setBlockerDescription(e.target.value)}
                  placeholder="Describe why this task is blocked"
                  className="bg-zinc-800 border-zinc-700 min-h-[80px]"
                />
              </div>
            </TabsContent>

            {/* Meta Tab */}
            <TabsContent value="meta" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="parentId">Parent Task ID</Label>
                <Input
                  id="parentId"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  placeholder="Optional parent task"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectId">Project ID</Label>
                <Input
                  id="projectId"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Optional project identifier"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {task ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
