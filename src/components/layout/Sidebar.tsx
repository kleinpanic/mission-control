"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Kanban,
  DollarSign,
  Clock,
  MessageSquare,
  Settings,
  ClipboardCheck,
  Dna,
  TrendingUp,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Kanban", href: "/kanban", icon: Kanban },
  { name: "Velocity", href: "/velocity", icon: TrendingUp },
  { name: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { name: "Evolver", href: "/evolver", icon: Dna },
  { name: "Costs", href: "/costs", icon: DollarSign },
  { name: "Cron", href: "/cron", icon: Clock },
  { name: "Sessions", href: "/sessions", icon: MessageSquare },
  { name: "Issues", href: "/issues", icon: AlertCircle },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex w-64 flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-zinc-800">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">🦞</span>
        </div>
        <span className="font-semibold text-lg">Mission Control</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </div>
    </div>
  );
}
