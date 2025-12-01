'use client';

import { useState, useEffect } from 'react';
import { getArtistEvents, Concert, RECENT_THRESHOLD_MS } from './client';

interface UseArtistConcertsResult {
  concerts: Concert[];
  isLoading: boolean;
  error: string | null;
  upcomingCount: number;
}

export interface ConcertWithArtist extends Concert {
  artistName: string;
}

interface UseMultipleArtistsConcertsResult {
  concerts: ConcertWithArtist[];
  isLoading: boolean;
  loadingCount: number;
  totalArtists: number;
}

/**
 * Hook to fetch concerts for multiple artists
 */
export function useMultipleArtistsConcerts(artistNames: string[]): UseMultipleArtistsConcertsResult {
  const [concerts, setConcerts] = useState<ConcertWithArtist[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);

  useEffect(() => {
    if (artistNames.length === 0) {
      setConcerts([]);
      return;
    }

    let cancelled = false;
    setLoadingCount(artistNames.length);
    setConcerts([]);

    // Fetch concerts for each artist
    artistNames.forEach((artistName) => {
      getArtistEvents(artistName)
        .then((events) => {
          if (!cancelled) {
            // Add artist name to each concert
            const concertsWithArtist: ConcertWithArtist[] = events.map((c) => ({
              ...c,
              artistName,
            }));
            setConcerts((prev) => [...prev, ...concertsWithArtist]);
          }
        })
        .catch(() => {
          // Silently ignore errors for individual artists
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingCount((prev) => Math.max(0, prev - 1));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [artistNames.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort concerts by date (most recent first)
  const sortedConcerts = [...concerts].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    concerts: sortedConcerts,
    isLoading: loadingCount > 0,
    loadingCount,
    totalArtists: artistNames.length,
  };
}

/**
 * Hook to fetch concerts for an artist
 */
export function useArtistConcerts(artistName: string | null): UseArtistConcertsResult {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artistName) {
      setConcerts([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getArtistEvents(artistName)
      .then((events) => {
        if (!cancelled) {
          setConcerts(events);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch concerts');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistName]);

  // Count recent shows (within threshold period - past 90 days)
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - RECENT_THRESHOLD_MS);
  const recentCount = concerts.filter(
    (c) => c.date <= now && c.date >= thresholdDate
  ).length;

  return {
    concerts,
    isLoading,
    error,
    upcomingCount: recentCount, // Keep name for compatibility
  };
}
