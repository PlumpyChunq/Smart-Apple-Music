'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotifyAuth, useSpotifyCallback, getCuratedTopArtists, getFollowedArtists } from '@/lib/spotify';
import { useFavorites } from '@/lib/favorites/hooks';
import { searchArtists } from '@/lib/musicbrainz/client';
import { SPOTIFY_CONFIG } from '@/lib/spotify/config';

interface SpotifyAuthProps {
  onImportComplete?: () => void;
}

export function SpotifyAuth({ onImportComplete }: SpotifyAuthProps) {
  const { isConnected, isLoading, connect, disconnect } = useSpotifyAuth();
  const { error: callbackError, isProcessing, clearError } = useSpotifyCallback();
  const { addFavorite, favorites } = useFavorites();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [hasImported, setHasImported] = useState(false);

  // Check if client ID is configured
  const isConfigured = !!SPOTIFY_CONFIG.clientId;

  // Check if we've already imported for this session
  useEffect(() => {
    const imported = sessionStorage.getItem('spotify-imported');
    if (imported === 'true') {
      setHasImported(true);
    }
  }, []);

  // Import artists from Spotify
  const importArtists = useCallback(async () => {
    if (hasImported || isImporting) return;

    setIsImporting(true);
    setImportStatus('Fetching your top artists...');

    try {
      // Get curated list: Top 5 all-time + Top 5 last 6 months + Top 5 last 4 weeks
      let spotifyArtists = await getCuratedTopArtists(5);

      // If top artists is empty (not enough listening history), fall back to followed artists
      if (spotifyArtists.length === 0) {
        setImportStatus('No top artists found. Fetching followed artists...');
        const followed = await getFollowedArtists();
        // Take first 15 followed artists to keep it manageable
        spotifyArtists = followed.slice(0, 15);
      }

      if (spotifyArtists.length === 0) {
        setImportStatus('No artists found in your Spotify library.');
        setHasImported(true);
        sessionStorage.setItem('spotify-imported', 'true');
        return;
      }

      setImportStatus(`Found ${spotifyArtists.length} artists. Matching with MusicBrainz...`);

      let imported = 0;
      let processed = 0;

      for (const spotifyArtist of spotifyArtists) {
        processed++;
        setImportStatus(`Matching "${spotifyArtist.name}" (${processed}/${spotifyArtists.length})...`);

        try {
          const mbResults = await searchArtists(spotifyArtist.name, 1);

          if (mbResults.length > 0) {
            const mbArtist = mbResults[0];

            // Check if already a favorite
            const alreadyFavorite = favorites.some((f) => f.id === mbArtist.id);
            if (!alreadyFavorite) {
              addFavorite(mbArtist);
              imported++;
            }
          }

          // Small delay to respect MusicBrainz rate limit (1 req/sec)
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch {
          // Skip this artist on error
          console.warn(`Failed to match artist: ${spotifyArtist.name}`);
        }
      }

      const message = imported > 0
        ? `Added ${imported} new artist${imported !== 1 ? 's' : ''} to favorites!`
        : 'All artists already in favorites';

      setImportStatus(message);
      setHasImported(true);
      sessionStorage.setItem('spotify-imported', 'true');

      // Clear status after a few seconds
      setTimeout(() => {
        setImportStatus(null);
        onImportComplete?.();
      }, 3000);
    } catch (err) {
      console.error('Error importing Spotify artists:', err);
      setImportStatus('Failed to import artists. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [hasImported, isImporting, favorites, addFavorite, onImportComplete]);

  // Trigger import after connection
  useEffect(() => {
    if (isConnected && !hasImported && !isImporting) {
      importArtists();
    }
  }, [isConnected, hasImported, isImporting, importArtists]);

  const handleConnect = async () => {
    clearError();
    await connect();
  };

  const handleDisconnect = () => {
    disconnect();
    setHasImported(false);
    setImportStatus(null);
    sessionStorage.removeItem('spotify-imported');
  };

  // Not configured - show setup message
  if (!isConfigured) {
    return (
      <Button variant="outline" disabled title="Spotify Client ID not configured">
        <Music2 className="size-4" />
        Connect Spotify (Not configured)
      </Button>
    );
  }

  // Loading state
  if (isLoading || isProcessing) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin size-4" />
        {isProcessing ? 'Connecting...' : 'Loading...'}
      </Button>
    );
  }

  // Connected state
  if (isConnected) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-950"
          >
            <Check className="size-4" />
            Spotify Connected
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

  // Disconnected state
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={handleConnect}
        className="hover:bg-green-50 hover:border-green-500 hover:text-green-700 dark:hover:bg-green-950 dark:hover:border-green-400 dark:hover:text-green-300"
      >
        <Music2 className="size-4" />
        Connect Spotify
      </Button>
      {callbackError && (
        <p className="text-sm text-destructive">{callbackError}</p>
      )}
    </div>
  );
}
