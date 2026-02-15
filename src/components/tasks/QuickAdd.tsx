"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface QuickAddProps {
  onTaskCreated?: () => void;
}

export function QuickAdd({ onTaskCreated }: QuickAddProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      return;
    }

    setLoading(true);
    try {
      // Parse natural language
      const parseRes = await fetch("/api/tasks/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!parseRes.ok) {
        const error = await parseRes.json();
        throw new Error(error.error || "Failed to parse task");
      }

      const { task: parsedTask } = await parseRes.json();

      // Create task
      const createRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedTask),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create task");
      }

      const { task } = await createRes.json();

      toast.success("Task created!", {
        description: `"${task.title}" added to Intake`,
      });

      setText("");
      onTaskCreated?.();
    } catch (error) {
      console.error("Quick add error:", error);
      toast.error("Failed to create task", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="remind me to review PR tomorrow at 3pm..."
          disabled={loading}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 pr-8"
        />
        <Sparkles className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none" />
      </div>
      <Button
        type="submit"
        disabled={loading || !text.trim()}
        className="bg-orange-600 hover:bg-orange-700 text-white"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </>
        )}
      </Button>
    </form>
  );
}
