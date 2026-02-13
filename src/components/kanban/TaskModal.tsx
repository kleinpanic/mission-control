"use client";

import { useState, useEffect } from "react";
import { Task, TaskPriority, TaskType, TaskStatus } from "@/types";
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

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  task?: Task | null;
}

const DEFAULT_AGENTS = ["main", "dev", "ops", "school", "research", "meta", "taskmaster"];

export function TaskModal({ open, onClose, onSubmit, task }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [type, setType] = useState<TaskType>("manual");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setType(task.type);
      setAssignedTo(task.assignedTo || "");
      setTags(task.tags.join(", "));
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setType("manual");
      setAssignedTo("");
      setTags("");
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || undefined,
      status: task?.status || "intake",
      priority,
      type,
      assignedTo: assignedTo || null,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
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
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="bg-zinc-800 border-zinc-700"
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

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign to Agent</Label>
            <select
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
            >
              <option value="">Unassigned</option>
              {DEFAULT_AGENTS.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
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
