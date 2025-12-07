'use client';

import { useQuery } from '@tanstack/react-query';
import { buildArtistGraph } from './client';
import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type { ArtistNode, ArtistRelationship, ArtistGraph } from '@/types';

/**
 * Search artists via API route with short-term caching
 */
async function searchArtistsCached(query: string, limit: number = 10): Promise<ArtistNode[]> {
  const cacheKey = `artist-search-${query.toLowerCase()}-${limit}`;

  // Check cache (short TTL for searches - 5 minutes)
  const cached = cacheGet<ArtistNode[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `/api/musicbrainz/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();
  const artists = data.artists || [];

  // Cache for 5 minutes (searches are more dynamic)
  cacheSet(cacheKey, artists, CacheTTL.SHORT);

  return artists;
}

interface RelationshipsData {
  artist: ArtistNode;
  relationships: ArtistRelationship[];
  relatedArtists: ArtistNode[];
}

/**
 * Fetch relationships via API route with localStorage caching
 */
async function fetchRelationshipsCached(mbid: string): Promise<RelationshipsData> {
  const cacheKey = `artist-relationships-${mbid}`;

  // Check localStorage cache first (instant)
  const cached = cacheGet<RelationshipsData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch via API route (uses local DB when available)
  const response = await fetch(`/api/musicbrainz/artist/${mbid}?include=relationships`);

  if (!response.ok) {
    throw new Error(`Failed to fetch relationships: ${response.status}`);
  }

  const data = await response.json();

  const result: RelationshipsData = {
    artist: data.artist,
    relationships: data.relationships,
    relatedArtists: data.relatedArtists,
  };

  // Cache for 1 week
  cacheSet(cacheKey, result, CacheTTL.LONG);

  return result;
}

/**
 * Hook to search for artists (uses local DB via API route)
 */
export function useArtistSearch(query: string, enabled: boolean = true) {
  return useQuery<ArtistNode[], Error>({
    queryKey: ['artistSearch', query],
    queryFn: () => searchArtistsCached(query, 10),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get artist relationships with localStorage caching
 * Uses API route which leverages local DB when available
 */
export function useArtistRelationships(mbid: string | null) {
  return useQuery({
    queryKey: ['artistRelationships', mbid],
    queryFn: () => fetchRelationshipsCached(mbid!),
    enabled: !!mbid,
    staleTime: Infinity, // Don't refetch - localStorage cache handles freshness
    gcTime: Infinity, // Keep in memory forever (localStorage is source of truth)
  });
}

/**
 * Hook to build artist graph
 */
export function useArtistGraph(mbid: string | null) {
  return useQuery<ArtistGraph, Error>({
    queryKey: ['artistGraph', mbid],
    queryFn: () => buildArtistGraph(mbid!),
    enabled: !!mbid,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
