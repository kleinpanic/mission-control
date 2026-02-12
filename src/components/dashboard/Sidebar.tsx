'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Users, 
  KanbanSquare, 
  DollarSign, 
  Clock, 
  MessageSquare,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

const routes = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Kanban', href: '/kanban', icon: KanbanSquare },
  { name: 'Costs', href: '/costs', icon: DollarSign },
  { name: 'Cron', href: '/cron', icon: Clock },
  { name: 'Sessions', href: '/sessions', icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Mission Control</h1>
            <p className="text-sm text-muted-foreground">OpenClaw Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {routes.map((route) => {
          const Icon = route.icon;
          const isActive = pathname === route.href;

          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{route.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          OpenClaw v2026.2
        </p>
      </div>
    </div>
  );
}
