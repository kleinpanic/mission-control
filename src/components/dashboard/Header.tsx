'use client';

import { useEffect, useState } from 'react';
import { useRealtimeStore } from '@/stores/realtime';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Header() {
  const { connectionStatus } = useRealtimeStore();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Update time only on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleString());
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
    <header className="h-14 md:h-16 border-b border-border bg-card px-3 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-4 ml-10 md:ml-0">
        <h2 className="text-base md:text-lg font-semibold hidden sm:block">Mission Control</h2>
        <Badge variant="outline" className="gap-1.5 md:gap-2 text-xs">
          <div className={cn('w-2 h-2 rounded-full', statusColors[connectionStatus])} />
          <span className="hidden xs:inline">{statusLabels[connectionStatus]}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {mounted && (
          <span className="text-xs md:text-sm text-muted-foreground hidden sm:block" suppressHydrationWarning>
            {currentTime}
          </span>
        )}
      </div>
    </header>
  );
}
