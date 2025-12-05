'use client';

import { useCallback, useEffect, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Icons for future Apple Music UI
import { Music, LogOut, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Apple Music hooks (future feature)
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

  // Import top artists from heavy rotation + recently played (like Spotify)
  const importTopArtists = useCallback(async () => {
    if (hasImported || isImporting) return;

    setIsImporting(true);
    setImportStatus('Fetching your most played music...');

    try {
      // Dynamically import to avoid SSR issues
      const { getCuratedTopArtists, getTopLibraryArtists } = await import('@/lib/apple-music/client');

      // Try to get artists from heavy rotation + recently played first
      let artistNames = await getCuratedTopArtists(30);

      // Fallback to library if heavy rotation is empty (new account or no play history)
      if (artistNames.length === 0) {
        setImportStatus('No play history found. Fetching library...');
        const libraryArtists = await getTopLibraryArtists(30);
        artistNames = libraryArtists.map(a => a.attributes.name);
      }

      if (artistNames.length === 0) {
        setImportStatus('No artists found in your Apple Music.');
        setHasImported(true);
        sessionStorage.setItem('apple-music-imported', 'true');
        return;
      }

      setImportStatus(`Found ${artistNames.length} top artists. Matching with MusicBrainz...`);

      let imported = 0;
      let processed = 0;

      for (const artistName of artistNames) {
        processed++;
        setImportStatus(`Matching "${artistName}" (${processed}/${artistNames.length})...`);

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

      const message = imported > 0
        ? `Added ${imported} new artist${imported !== 1 ? 's' : ''} to favorites!`
        : 'All artists already in favorites';

      setImportStatus(message);
      setHasImported(true);
      sessionStorage.setItem('apple-music-imported', 'true');

      // Clear status after a few seconds
      setTimeout(() => {
        setImportStatus(null);
        onImportComplete?.();
      }, 3000);
    } catch (err) {
      console.error('Error importing artists:', err);
      setImportStatus('Failed to import artists. Try again later.');
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
