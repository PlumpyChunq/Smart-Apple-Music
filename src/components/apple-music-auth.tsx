'use client';

import { useEffect, useState } from 'react';
import { Music, Loader2, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppleMusicAuth } from '@/lib/apple-music';
import { importManager } from '@/lib/apple-music/import-manager';

interface AppleMusicAuthProps {
  onImportComplete?: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AppleMusicAuth({ onImportComplete }: AppleMusicAuthProps) {
  const { isAuthorized, isLoading, isCheckingAuth, error, connect, disconnect } = useAppleMusicAuth();
  const [importStatus, setImportStatus] = useState(importManager.getStatus());

  // Subscribe to import manager status updates
  useEffect(() => {
    const unsubscribe = importManager.subscribe((status) => {
      setImportStatus(status);
      // Notify parent when import completes
      if (!status.isImporting && status.message?.includes('Added')) {
        onImportComplete?.();
      }
    });
    return unsubscribe;
  }, [onImportComplete]);

  // Trigger import after authorization (uses singleton, survives unmount)
  useEffect(() => {
    if (isAuthorized) {
      if (!importManager.isImportComplete() && !importManager.isImporting()) {
        // First time import - full sync
        importManager.startImport();
      } else if (importManager.shouldBackgroundCheck()) {
        // Already imported - do background diff check for new artists
        importManager.backgroundSync();
      }
    }
  }, [isAuthorized]);

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
    importManager.reset();
  };

  const handleReimport = () => {
    importManager.reset();
    importManager.startImport();
  };

  // Show loading only during user-initiated actions (connect/disconnect)
  // Background auth check (isCheckingAuth) doesn't block the UI
  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (isAuthorized) {
    const lastImport = importManager.getLastImportInfo();

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-950"
          >
            <Check className="size-4" />
            Apple Music Connected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReimport}
            disabled={importStatus.isImporting}
            title="Re-import top artists from Apple Music"
            className="h-9"
          >
            <RefreshCw className={`size-4 ${importStatus.isImporting ? 'animate-spin' : ''}`} />
            Re-import
          </Button>
        </div>
        {importStatus.isImporting || importStatus.message ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {importStatus.isImporting && <Loader2 className="size-3 animate-spin" />}
            <span>
              {importStatus.message}
              {importStatus.progress && (
                <span className="ml-1 text-xs">
                  ({importStatus.progress.current}/{importStatus.progress.total})
                </span>
              )}
            </span>
          </div>
        ) : lastImport ? (
          <p className="text-xs text-muted-foreground">
            Synced {formatRelativeTime(lastImport.date)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={handleConnect}
        disabled={isCheckingAuth}
      >
        {isCheckingAuth ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Music className="size-4" />
        )}
        {isCheckingAuth ? 'Checking...' : 'Connect Apple Music'}
      </Button>
      {error && (
        <div className="text-sm text-destructive space-y-1">
          <p>{error.message}</p>
          {error.message.includes('timed out') && (
            <p className="text-xs text-muted-foreground">
              Try disabling ad blockers or privacy extensions that may block Apple&apos;s MusicKit.
            </p>
          )}
          {error.message.toLowerCase().includes('popup') && (
            <p className="text-xs text-muted-foreground">
              Click the blocked popup icon in your browser&apos;s address bar to allow popups from this site.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
