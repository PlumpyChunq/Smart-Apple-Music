'use client';

import { useCallback, useEffect, useState } from 'react';
import { Music, LogOut, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppleMusicAuth, useTopLibraryArtists } from '@/lib/apple-music';
import { useFavorites } from '@/lib/favorites/hooks';
import { searchArtists } from '@/lib/musicbrainz/client';

interface AppleMusicAuthProps {
  onImportComplete?: () => void;
}

export function AppleMusicAuth({ onImportComplete }: AppleMusicAuthProps) {
  const { isAuthorized, isLoading, error, connect, disconnect } = useAppleMusicAuth();
  const { addFavorite, favorites } = useFavorites();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [hasImported, setHasImported] = useState(false);

  // Check if we've already imported for this session
  useEffect(() => {
    const imported = sessionStorage.getItem('apple-music-imported');
    if (imported === 'true') {
      setHasImported(true);
    }
  }, []);

  // Auto-import top 10 artists when first connected
  const importTopArtists = useCallback(async () => {
    if (hasImported || isImporting) return;

    setIsImporting(true);
    setImportStatus('Fetching your library...');

    try {
      // Dynamically import to avoid SSR issues
      const { getTopLibraryArtists } = await import('@/lib/apple-music/client');
      const topArtists = await getTopLibraryArtists(10);

      setImportStatus(`Found ${topArtists.length} artists. Matching...`);

      let imported = 0;
      for (const appleMusicArtist of topArtists) {
        // Search MusicBrainz for this artist
        const artistName = appleMusicArtist.attributes.name;
        setImportStatus(`Matching "${artistName}"...`);

        try {
          const mbResults = await searchArtists(artistName, 1);

          if (mbResults.length > 0) {
            const mbArtist = mbResults[0];

            // Check if already a favorite
            const alreadyFavorite = favorites.some((f) => f.id === mbArtist.id);
            if (!alreadyFavorite) {
              addFavorite(mbArtist);
              imported++;
            }
          }

          // Small delay to respect MusicBrainz rate limit
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          // Skip this artist on error
          console.warn(`Failed to match artist: ${artistName}`);
        }
      }

      setImportStatus(imported > 0 ? `Added ${imported} artists to favorites!` : 'All artists already in favorites');
      setHasImported(true);
      sessionStorage.setItem('apple-music-imported', 'true');

      // Clear status after a few seconds
      setTimeout(() => {
        setImportStatus(null);
        onImportComplete?.();
      }, 3000);
    } catch (err) {
      console.error('Error importing artists:', err);
      setImportStatus('Failed to import artists');
    } finally {
      setIsImporting(false);
    }
  }, [hasImported, isImporting, favorites, addFavorite, onImportComplete]);

  // Trigger import after authorization
  useEffect(() => {
    if (isAuthorized && !hasImported && !isImporting) {
      importTopArtists();
    }
  }, [isAuthorized, hasImported, isImporting, importTopArtists]);

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
    setHasImported(false);
    sessionStorage.removeItem('apple-music-imported');
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin" />
        Loading...
      </Button>
    );
  }

  if (isAuthorized) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-950"
          >
            <Check className="size-4" />
            Apple Music Connected
          </Button>
        </div>
        {(isImporting || importStatus) && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isImporting && <Loader2 className="size-3 animate-spin" />}
            {importStatus}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={handleConnect}>
        <Music className="size-4" />
        Connect Apple Music
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  );
}
