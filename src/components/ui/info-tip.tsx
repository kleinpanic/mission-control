"use client";

import { Info, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  iconSize?: number;
  variant?: "info" | "help";
}

export function InfoTip({ content, side = "top", className, iconSize = 14, variant = "info" }: InfoTipProps) {
  const Icon = variant === "help" ? HelpCircle : Info;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon className={cn("text-zinc-500 hover:text-zinc-300 cursor-help transition-colors inline-block", className)} style={{ width: iconSize, height: iconSize }} />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
