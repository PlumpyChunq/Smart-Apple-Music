'use client';

import { useState, useEffect, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future Apple Music mutations
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- MusicKitInstance kept for future use
import type { AppleMusicArtist, AppleMusicAlbum, MusicKitInstance } from './types';
import type { ArtistNode } from '@/types';

const AUTH_STORAGE_KEY = 'apple-music-authorized';

/**
 * Hook to manage Apple Music authorization state
 */
export function useAppleMusicAuth() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  // Start with isLoading: false - show "Connect" button immediately
  // Only show loading during active user interactions
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Pre-initialize MusicKit and check authorization status on mount
  // This ensures MusicKit is ready when user clicks "Connect" (avoids popup blocker)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let mounted = true;

    async function initAndCheckAuth() {
      try {
        // Add timeout to prevent infinite waiting if MusicKit fails
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('MusicKit initialization timed out'));
          }, 8000); // 8 seconds - faster feedback
        });

        // Always try to initialize MusicKit (needed for authorize() to work)
        const music = await Promise.race([
          initializeMusicKit(),
          timeoutPromise,
        ]);

        clearTimeout(timeoutId);

        if (mounted) {
          // Check if we were previously authorized
          const wasAuthorized = localStorage.getItem(AUTH_STORAGE_KEY) === 'true';

          if (wasAuthorized && music.isAuthorized) {
            setIsAuthorized(true);
          } else if (wasAuthorized && !music.isAuthorized) {
            // Authorization expired - clear stored state
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Error initializing MusicKit:', err);
        // Clear stored auth state if MusicKit failed to load
        localStorage.removeItem(AUTH_STORAGE_KEY);
        // Don't set error for background init - only for user-initiated actions
      } finally {
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    initAndCheckAuth();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);

    try {
      // Get the pre-initialized MusicKit instance (should be ready from useEffect)
      const music = getMusicKitInstance();

      if (!music) {
        // MusicKit not ready - try to initialize (this may cause popup blocker issues)
        setIsLoading(true);
        const freshMusic = await initializeMusicKit();
        const userToken = await freshMusic.authorize();
        setIsLoading(false);

        if (userToken) {
          setIsAuthorized(true);
          localStorage.setItem(AUTH_STORAGE_KEY, 'true');
          return true;
        }
        return false;
      }

      // MusicKit is pre-initialized - authorize() should work without popup blocker
      // Note: Don't set isLoading here as the popup handles its own UI
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';

      // Check for common popup blocker error
      if (errorMessage.includes('popup') || errorMessage.includes('blocked')) {
        setError(new Error('Popup was blocked. Please allow popups for this site and try again.'));
      } else {
        setError(err instanceof Error ? err : new Error('Failed to connect'));
      }
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
    isCheckingAuth,
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
