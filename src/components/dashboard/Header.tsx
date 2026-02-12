'use client';

import { useRealtimeStore } from '@/stores/realtime';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Header() {
  const { connectionStatus } = useRealtimeStore();

  const statusColors = {
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500',
  };

  const statusLabels = {
    connecting: 'Connecting',
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Mission Control</h2>
        <Badge variant="outline" className="gap-2">
          <div className={cn('w-2 h-2 rounded-full', statusColors[connectionStatus])} />
          {statusLabels[connectionStatus]}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleString()}
        </span>
      </div>
    </header>
  );
}
