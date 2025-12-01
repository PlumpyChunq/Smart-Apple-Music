'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initializeMusicKit, getMusicKitInstance } from './config';
import {
  getTopLibraryArtists,
  getAllLibraryArtists,
  searchCatalogArtist,
  getCatalogArtist,
  getCatalogArtistAlbums,
} from './client';
import { enrichArtistWithAppleMusic } from './enrichment';
import type { AppleMusicArtist, AppleMusicAlbum, MusicKitInstance } from './types';
import type { ArtistNode } from '@/types';

const AUTH_STORAGE_KEY = 'apple-music-authorized';

/**
 * Hook to manage Apple Music authorization state
 */
export function useAppleMusicAuth() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check authorization status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        // Check if we previously authorized
        const wasAuthorized = localStorage.getItem(AUTH_STORAGE_KEY) === 'true';

        if (wasAuthorized) {
          const music = await initializeMusicKit();
          setIsAuthorized(music.isAuthorized);

          // Update storage if authorization expired
          if (!music.isAuthorized) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Error checking Apple Music auth:', err);
        setError(err instanceof Error ? err : new Error('Failed to check auth'));
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const music = await initializeMusicKit();
      const userToken = await music.authorize();

      if (userToken) {
        setIsAuthorized(true);
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        return true;
      } else {
        setIsAuthorized(false);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return false;
      }
    } catch (err) {
      console.error('Error connecting Apple Music:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setIsLoading(true);

    try {
      const music = getMusicKitInstance();
      if (music) {
        await music.unauthorize();
      }
      setIsAuthorized(false);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err) {
      console.error('Error disconnecting Apple Music:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isAuthorized,
    isLoading,
    error,
    connect,
    disconnect,
  };
}

/**
 * Hook to get top library artists
 */
export function useTopLibraryArtists(count: number = 10, enabled: boolean = true) {
  const { isAuthorized } = useAppleMusicAuth();

  return useQuery<AppleMusicArtist[], Error>({
    queryKey: ['appleMusicLibraryArtists', 'top', count],
    queryFn: () => getTopLibraryArtists(count),
    enabled: enabled && isAuthorized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get all library artists
 */
export function useAllLibraryArtists(enabled: boolean = true) {
  const { isAuthorized } = useAppleMusicAuth();

  return useQuery<AppleMusicArtist[], Error>({
    queryKey: ['appleMusicLibraryArtists', 'all'],
    queryFn: getAllLibraryArtists,
    enabled: enabled && isAuthorized,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to search for an artist in Apple Music catalog
 */
export function useAppleMusicArtistSearch(artistName: string | null) {
  return useQuery<AppleMusicArtist | null, Error>({
    queryKey: ['appleMusicCatalogSearch', artistName],
    queryFn: () => searchCatalogArtist(artistName!),
    enabled: !!artistName,
    staleTime: 30 * 60 * 1000, // 30 minutes (catalog doesn't change often)
  });
}

/**
 * Hook to get artist details from catalog
 */
export function useAppleMusicArtist(artistId: string | null) {
  return useQuery<AppleMusicArtist | null, Error>({
    queryKey: ['appleMusicCatalogArtist', artistId],
    queryFn: () => getCatalogArtist(artistId!),
    enabled: !!artistId,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to get artist's albums from catalog
 */
export function useAppleMusicArtistAlbums(artistId: string | null, limit: number = 10) {
  return useQuery<AppleMusicAlbum[], Error>({
    queryKey: ['appleMusicCatalogAlbums', artistId, limit],
    queryFn: () => getCatalogArtistAlbums(artistId!, 'us', limit),
    enabled: !!artistId,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to enrich an artist with Apple Music data
 * Automatically fetches image and albums when artist is provided
 */
export function useEnrichedArtist(artist: ArtistNode | null) {
  return useQuery<ArtistNode | null, Error>({
    queryKey: ['appleMusicEnriched', artist?.id],
    queryFn: async () => {
      if (!artist) return null;
      return enrichArtistWithAppleMusic(artist);
    },
    enabled: !!artist,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
