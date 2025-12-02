// Spotify API client

import { SPOTIFY_CONFIG } from './config';
import { getAccessToken } from './auth';
import type {
  SpotifyArtist,
  SpotifyPagingObject,
  SpotifyFollowedArtistsResponse,
  SpotifySavedTrack,
  SpotifySavedAlbum,
  SpotifyImportedArtist,
} from './types';

// Helper to make authenticated requests
async function spotifyFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }

  const response = await fetch(`${SPOTIFY_CONFIG.apiBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Spotify session expired. Please reconnect.');
    }
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Spotify API error: ${response.status}`);
  }

  return response.json();
}

// Get best image URL from Spotify images array
function getBestImageUrl(images?: { url: string; width: number | null }[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  // Sort by width descending, prefer medium-sized images (300-640px)
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  const medium = sorted.find(img => img.width && img.width >= 300 && img.width <= 640);
  return medium?.url || sorted[0]?.url;
}

/**
 * Get user's top artists
 * @param limit Number of artists to fetch (max 50)
 * @param timeRange Time range: short_term (4 weeks), medium_term (6 months), long_term (years)
 */
export async function getTopArtists(
  limit: number = 50,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'
): Promise<SpotifyImportedArtist[]> {
  const data = await spotifyFetch<SpotifyPagingObject<SpotifyArtist>>(
    `/me/top/artists?limit=${limit}&time_range=${timeRange}`
  );

  return data.items.map(artist => ({
    spotifyId: artist.id,
    name: artist.name,
    imageUrl: getBestImageUrl(artist.images),
    genres: artist.genres,
    source: 'top' as const,
  }));
}

/**
 * Get all user's followed artists (handles pagination)
 */
export async function getFollowedArtists(): Promise<SpotifyImportedArtist[]> {
  const artists: SpotifyImportedArtist[] = [];
  let after: string | null = null;
  const limit = 50;

  do {
    const params = new URLSearchParams({ type: 'artist', limit: String(limit) });
    if (after) params.set('after', after);

    const data = await spotifyFetch<SpotifyFollowedArtistsResponse>(
      `/me/following?${params.toString()}`
    );

    for (const artist of data.artists.items) {
      artists.push({
        spotifyId: artist.id,
        name: artist.name,
        imageUrl: getBestImageUrl(artist.images),
        genres: artist.genres,
        source: 'followed',
      });
    }

    after = data.artists.cursors.after;
  } while (after);

  return artists;
}

/**
 * Get artists from user's saved tracks (handles pagination)
 * Returns unique artists only
 */
export async function getArtistsFromSavedTracks(maxTracks: number = 500): Promise<SpotifyImportedArtist[]> {
  const artistMap = new Map<string, SpotifyImportedArtist>();
  let offset = 0;
  const limit = 50;

  while (offset < maxTracks) {
    const data = await spotifyFetch<SpotifyPagingObject<SpotifySavedTrack>>(
      `/me/tracks?limit=${limit}&offset=${offset}`
    );

    if (data.items.length === 0) break;

    for (const item of data.items) {
      for (const artist of item.track.artists) {
        if (!artistMap.has(artist.id)) {
          artistMap.set(artist.id, {
            spotifyId: artist.id,
            name: artist.name,
            imageUrl: getBestImageUrl(artist.images),
            genres: undefined, // Track artist objects don't include genres
            source: 'saved_track',
          });
        }
      }
    }

    if (!data.next) break;
    offset += limit;
  }

  return Array.from(artistMap.values());
}

/**
 * Get artists from user's saved albums (handles pagination)
 * Returns unique artists only
 */
export async function getArtistsFromSavedAlbums(maxAlbums: number = 200): Promise<SpotifyImportedArtist[]> {
  const artistMap = new Map<string, SpotifyImportedArtist>();
  let offset = 0;
  const limit = 50;

  while (offset < maxAlbums) {
    const data = await spotifyFetch<SpotifyPagingObject<SpotifySavedAlbum>>(
      `/me/albums?limit=${limit}&offset=${offset}`
    );

    if (data.items.length === 0) break;

    for (const item of data.items) {
      for (const artist of item.album.artists) {
        if (!artistMap.has(artist.id)) {
          artistMap.set(artist.id, {
            spotifyId: artist.id,
            name: artist.name,
            imageUrl: getBestImageUrl(artist.images),
            genres: undefined,
            source: 'saved_album',
          });
        }
      }
    }

    if (!data.next) break;
    offset += limit;
  }

  return Array.from(artistMap.values());
}

/**
 * Fetch all artists from user's Spotify library
 * Combines top artists, followed artists, and artists from saved tracks/albums
 * Returns deduplicated list with priority: top > followed > saved
 */
export async function getAllUserArtists(): Promise<SpotifyImportedArtist[]> {
  const [topArtists, followedArtists, savedTrackArtists, savedAlbumArtists] = await Promise.all([
    getTopArtists(50, 'medium_term'),
    getFollowedArtists(),
    getArtistsFromSavedTracks(500),
    getArtistsFromSavedAlbums(200),
  ]);

  // Deduplicate, keeping first occurrence (priority order)
  const artistMap = new Map<string, SpotifyImportedArtist>();

  // Add in priority order
  for (const artist of topArtists) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  for (const artist of followedArtists) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  for (const artist of savedTrackArtists) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  for (const artist of savedAlbumArtists) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  return Array.from(artistMap.values());
}

/**
 * Get just the top and followed artists (faster import)
 */
export async function getPrimaryArtists(): Promise<SpotifyImportedArtist[]> {
  const [topArtists, followedArtists] = await Promise.all([
    getTopArtists(50, 'medium_term'),
    getFollowedArtists(),
  ]);

  const artistMap = new Map<string, SpotifyImportedArtist>();

  for (const artist of topArtists) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  for (const artist of followedArtists) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  return Array.from(artistMap.values());
}

/**
 * Get curated top artists from multiple time ranges
 * Returns deduplicated list: Top 5 all-time + Top 5 last 6 months + Top 5 last 4 weeks
 * Maximum ~15 artists (usually fewer due to overlap)
 */
export async function getCuratedTopArtists(limitPerRange: number = 5): Promise<SpotifyImportedArtist[]> {
  const [longTerm, mediumTerm, shortTerm] = await Promise.all([
    getTopArtists(limitPerRange, 'long_term'),
    getTopArtists(limitPerRange, 'medium_term'),
    getTopArtists(limitPerRange, 'short_term'),
  ]);

  // Deduplicate with priority: all-time > 6 months > 4 weeks
  const artistMap = new Map<string, SpotifyImportedArtist>();

  for (const artist of longTerm) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  for (const artist of mediumTerm) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  for (const artist of shortTerm) {
    if (!artistMap.has(artist.spotifyId)) {
      artistMap.set(artist.spotifyId, artist);
    }
  }

  return Array.from(artistMap.values());
}
