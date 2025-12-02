'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useSyncExternalStore } from 'react';
import {
  isAuthenticated,
  buildAuthUrl,
  exchangeCodeForToken,
  disconnectSpotify,
  validateState,
} from './auth';
import { getAllUserArtists, getPrimaryArtists } from './client';
import type { SpotifyImportedArtist } from './types';

// Query keys
export const spotifyKeys = {
  all: ['spotify'] as const,
  auth: () => [...spotifyKeys.all, 'auth'] as const,
  artists: () => [...spotifyKeys.all, 'artists'] as const,
  primaryArtists: () => [...spotifyKeys.all, 'primaryArtists'] as const,
};

// Store for auth state with subscribers
const authListeners: Set<() => void> = new Set();
function subscribeToAuth(callback: () => void) {
  authListeners.add(callback);
  return () => authListeners.delete(callback);
}
function notifyAuthListeners() {
  authListeners.forEach(listener => listener());
}
function getAuthSnapshot() {
  return isAuthenticated();
}
function getServerAuthSnapshot() {
  return false; // Always false on server
}

/**
 * Hook to manage Spotify authentication state
 */
export function useSpotifyAuth() {
  const queryClient = useQueryClient();

  // Use useSyncExternalStore for auth state to avoid setState in effects
  const isConnected = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getServerAuthSnapshot
  );

  // Handle OAuth callback
  const handleCallback = useCallback(async (code: string, state: string) => {
    if (!validateState(state)) {
      throw new Error('Invalid state parameter. Please try again.');
    }

    await exchangeCodeForToken(code);
    notifyAuthListeners();
    queryClient.invalidateQueries({ queryKey: spotifyKeys.all });
  }, [queryClient]);

  // Start auth flow
  const connect = useCallback(async () => {
    const url = await buildAuthUrl();
    window.location.href = url;
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    disconnectSpotify();
    notifyAuthListeners();
    queryClient.removeQueries({ queryKey: spotifyKeys.all });
  }, [queryClient]);

  return {
    isConnected,
    isLoading: false, // No longer needed with useSyncExternalStore
    connect,
    disconnect,
    handleCallback,
  };
}

// Module-level flag to track if callback was processed (persists across renders)
let callbackProcessed = false;

/**
 * Hook to handle Spotify OAuth callback from URL params
 */
export function useSpotifyCallback() {
  const { handleCallback } = useSpotifyAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lazy initialization pattern - only runs once and checks module-level flag
  const [initialized] = useState(() => {
    if (typeof window === 'undefined' || callbackProcessed) return true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('spotify_code');
    const state = params.get('spotify_state');
    const spotifyError = params.get('spotify_error');

    if (!code && !spotifyError) return true;

    callbackProcessed = true;

    // Clean URL params
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('spotify_code');
      url.searchParams.delete('spotify_state');
      url.searchParams.delete('spotify_error');
      window.history.replaceState({}, '', url.toString());
    };

    if (spotifyError) {
      queueMicrotask(() => {
        setError(spotifyError === 'access_denied'
          ? 'You denied access to Spotify. Click Connect to try again.'
          : `Spotify error: ${spotifyError}`);
      });
      cleanUrl();
    } else if (code && state) {
      queueMicrotask(() => setIsProcessing(true));
      handleCallback(code, state)
        .then(() => cleanUrl())
        .catch((err) => {
          setError(err.message);
          cleanUrl();
        })
        .finally(() => setIsProcessing(false));
    }

    return true;
  });

  // Suppress unused variable warning
  void initialized;

  return { error, isProcessing, clearError: () => setError(null) };
}

/**
 * Hook to fetch all user's artists from Spotify
 */
export function useSpotifyArtists(enabled: boolean = true) {
  const { isConnected } = useSpotifyAuth();

  return useQuery({
    queryKey: spotifyKeys.artists(),
    queryFn: getAllUserArtists,
    enabled: enabled && isConnected,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch primary artists (top + followed) - faster than all artists
 */
export function useSpotifyPrimaryArtists(enabled: boolean = true) {
  const { isConnected } = useSpotifyAuth();

  return useQuery({
    queryKey: spotifyKeys.primaryArtists(),
    queryFn: getPrimaryArtists,
    enabled: enabled && isConnected,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to import Spotify artists (mutation with progress tracking)
 */
export function useSpotifyImport() {
  const [progress, setProgress] = useState<{
    stage: 'idle' | 'fetching' | 'matching' | 'complete' | 'error';
    current?: number;
    total?: number;
    message?: string;
  }>({ stage: 'idle' });

  const mutation = useMutation({
    mutationFn: async (options: {
      includeFollowed: boolean;
      includeTop: boolean;
      includeSaved: boolean;
      onProgress?: (current: number, total: number) => void;
    }): Promise<SpotifyImportedArtist[]> => {
      setProgress({ stage: 'fetching', message: 'Fetching artists from Spotify...' });

      let artists: SpotifyImportedArtist[];

      if (options.includeSaved) {
        artists = await getAllUserArtists();
      } else {
        artists = await getPrimaryArtists();
      }

      // Filter based on options
      const filtered = artists.filter(artist => {
        if (artist.source === 'top' && !options.includeTop) return false;
        if (artist.source === 'followed' && !options.includeFollowed) return false;
        if ((artist.source === 'saved_track' || artist.source === 'saved_album') && !options.includeSaved) return false;
        return true;
      });

      setProgress({
        stage: 'complete',
        total: filtered.length,
        message: `Found ${filtered.length} artists`,
      });

      return filtered;
    },
    onError: (error: Error) => {
      setProgress({ stage: 'error', message: error.message });
    },
  });

  const reset = useCallback(() => {
    setProgress({ stage: 'idle' });
    mutation.reset();
  }, [mutation]);

  return {
    ...mutation,
    progress,
    reset,
  };
}
