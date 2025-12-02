'use client';

/**
 * Data Source Indicator Component
 *
 * Displays which data source is currently being used:
 * - Local DB (fast, no rate limit)
 * - MusicBrainz API (rate limited)
 *
 * Helps users understand performance characteristics and debug issues.
 */

import { cn } from '@/lib/utils';

export type DataSource = 'local' | 'api';

interface DataSourceIndicatorProps {
  source: DataSource;
  latencyMs?: number;
  className?: string;
  showLatency?: boolean;
}

export function DataSourceIndicator({
  source,
  latencyMs,
  className,
  showLatency = false,
}: DataSourceIndicatorProps) {
  const isLocal = source === 'local';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isLocal
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        className
      )}
      title={
        isLocal
          ? 'Using local database (fast, no rate limit)'
          : 'Using MusicBrainz API (1 req/sec rate limit)'
      }
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isLocal ? 'bg-green-500' : 'bg-yellow-500'
        )}
      />
      <span>{isLocal ? 'Local DB' : 'API'}</span>
      {showLatency && latencyMs !== undefined && (
        <span className="text-[10px] opacity-70">{latencyMs}ms</span>
      )}
    </div>
  );
}

/**
 * Compact version for tight spaces
 */
export function DataSourceDot({
  source,
  className,
}: {
  source: DataSource;
  className?: string;
}) {
  const isLocal = source === 'local';

  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        isLocal ? 'bg-green-500' : 'bg-yellow-500',
        className
      )}
      title={
        isLocal
          ? 'Using local database'
          : 'Using MusicBrainz API (rate limited)'
      }
    />
  );
}
