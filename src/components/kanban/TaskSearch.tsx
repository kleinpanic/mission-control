"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter } from "lucide-react";
import { TaskPriority } from "@/types";

interface TaskSearchProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: TaskFilters) => void;
  activeFilters: TaskFilters;
}

export interface TaskFilters {
  priority?: TaskPriority;
  assignedTo?: string;
  tags?: string[];
}

export function TaskSearch({ onSearch, onFilterChange, activeFilters }: TaskSearchProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const clearSearch = () => {
    setQuery("");
    onSearch("");
  };

  const togglePriorityFilter = (priority: TaskPriority) => {
    onFilterChange({
      ...activeFilters,
      priority: activeFilters.priority === priority ? undefined : priority,
    });
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = activeFilters.priority || activeFilters.assignedTo || activeFilters.tags?.length;

  return (
    <div className="space-y-3 mb-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search tasks by title, description, or tags..."
            className="pl-9 pr-9 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters || hasActiveFilters ? "default" : "outline"}
          size="default"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? "bg-orange-600 hover:bg-orange-700" : ""}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2 bg-zinc-900 text-zinc-100">
              {Object.keys(activeFilters).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-zinc-100">Filters</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-zinc-400 hover:text-zinc-100"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Priority filter */}
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Priority</label>
            <div className="flex gap-2 flex-wrap">
              {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((priority) => (
                <Button
                  key={priority}
                  variant={activeFilters.priority === priority ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePriorityFilter(priority)}
                  className={`text-xs ${
                    activeFilters.priority === priority
                      ? priority === 'critical'
                        ? 'bg-red-600 hover:bg-red-700'
                        : priority === 'high'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : priority === 'medium'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-green-600 hover:bg-green-700'
                      : ''
                  }`}
                >
                  {priority}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
