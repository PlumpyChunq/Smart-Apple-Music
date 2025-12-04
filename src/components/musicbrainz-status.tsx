'use client';

import { useState, useEffect, useCallback } from 'react';
import { forceRecoveryCheck } from '@/lib/musicbrainz';

interface ServerHealthStatus {
  isLocal: boolean;
  status: 'healthy' | 'degraded' | 'error';
  lastChecked: string | null;
}

/**
 * Small, discrete indicator showing MusicBrainz server status
 * Fetches actual server-side status from the health API
 */
export function MusicBrainzStatus() {
  const [healthStatus, setHealthStatus] = useState<ServerHealthStatus>({
    isLocal: false,
    status: 'degraded',
    lastChecked: null,
  });
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/musicbrainz/health');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus({
          isLocal: data.isLocal ?? data.sources?.localDb?.available ?? false,
          status: data.status,
          lastChecked: data.sources?.localDb?.lastChecked ?? null,
        });
      }
    } catch (error) {
      console.error('[MusicBrainzStatus] Failed to fetch health:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch status on mount
    fetchHealthStatus();

    // Poll for updates every 10 seconds (don't need it super frequent)
    const interval = setInterval(fetchHealthStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchHealthStatus]);

  const handleRetryClick = async () => {
    if (isCheckingRecovery) return;
    setIsCheckingRecovery(true);

    try {
      const recovered = await forceRecoveryCheck();
      // Fetch fresh status from server regardless of result
      await fetchHealthStatus();

      if (recovered) {
        console.log('[MusicBrainzStatus] Recovery successful!');
      }
    } finally {
      setIsCheckingRecovery(false);
    }
  };

  const isLocal = healthStatus.isLocal;
  const inFallback = healthStatus.status === 'degraded';

  // Color based on status
  const dotColor = isLocal
    ? 'bg-green-500'
    : inFallback
      ? 'bg-yellow-500'
      : 'bg-blue-500';

  const statusLabel = isLoading
    ? '...'
    : isLocal
      ? 'Local'
      : inFallback
        ? 'Fallback'
        : 'Remote';

  // Build tooltip text
  const tooltipLines = [
    `MusicBrainz ${isLocal ? 'Local Database' : 'Public API'}`,
    '',
    isLocal ? '✓ Using local PostgreSQL database (fast, no rate limits)' : '',
    inFallback ? '⚠ Local DB unavailable - using public API (rate limited)' : '',
    !isLocal && !inFallback ? '⏱ Using public API (rate limited: 1 req/sec)' : '',
    healthStatus.lastChecked ? `Last checked: ${new Date(healthStatus.lastChecked).toLocaleTimeString()}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default select-none opacity-50 hover:opacity-100 transition-opacity"
      title={tooltipLines}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isCheckingRecovery || isLoading ? '' : 'animate-pulse'}`} />
      <span className="font-mono text-[10px]">{statusLabel}</span>
      {inFallback && (
        <button
          onClick={handleRetryClick}
          disabled={isCheckingRecovery}
          className="font-mono text-[10px] text-yellow-500 hover:text-yellow-400 underline cursor-pointer disabled:opacity-50"
          title="Click to check if local database is available"
        >
          {isCheckingRecovery ? '...' : 'retry'}
        </button>
      )}
    </div>
  );
}
