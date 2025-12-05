// eslint-disable-next-line @typescript-eslint/no-unused-vars -- getMusicKitInstance kept for future use
import { initializeMusicKit, getMusicKitInstance } from './config';
import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type {
  AppleMusicArtist,
  AppleMusicAlbum,
  LibraryArtistsResponse,
  LibraryAlbumsResponse,
  CatalogSearchResponse,
} from './types';

export { formatArtworkUrl } from './types';

// Ensure MusicKit is initialized and authorized before making API calls
async function ensureAuthorized() {
  const music = await initializeMusicKit();
  if (!music.isAuthorized) {
    throw new Error('Not authorized. Please connect Apple Music first.');
  }
  return music;
}

/**
 * Get all artists from user's library (paginated)
 */
export async function getLibraryArtists(
  limit: number = 100,
  offset: number = 0
): Promise<LibraryArtistsResponse> {
  const music = await ensureAuthorized();

  // MusicKit v3 expects query params directly, not nested under 'parameters'
  const response = await music.api.music<LibraryArtistsResponse>(
    '/v1/me/library/artists',
    { limit, offset }
  );

  return response.data;
}

/**
 * Get all library artists (handles pagination)
 */
export async function getAllLibraryArtists(): Promise<AppleMusicArtist[]> {
  const allArtists: AppleMusicArtist[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await getLibraryArtists(limit, offset);
    allArtists.push(...response.data);

    if (!response.next || response.data.length < limit) {
      break;
    }

    offset += limit;

    // Safety limit to prevent infinite loops
    if (offset > 10000) {
      break;
    }
  }

  return allArtists;
}

/**
 * Get top N artists from library (most recently added/played)
 */
export async function getTopLibraryArtists(count: number = 10): Promise<AppleMusicArtist[]> {
  const response = await getLibraryArtists(count, 0);
  return response.data;
}

/**
 * Get albums for a specific library artist
 */
export async function getLibraryArtistAlbums(
  artistId: string
): Promise<AppleMusicAlbum[]> {
  const music = await ensureAuthorized();

  const response = await music.api.music<LibraryAlbumsResponse>(
    `/v1/me/library/artists/${artistId}/albums`
  );

  return response.data.data;
}

/**
 * Search Apple Music catalog for an artist by name
 */
export async function searchCatalogArtist(
  artistName: string,
  storefront: string = 'us'
): Promise<AppleMusicArtist | null> {
  // Check cache first
  const cacheKey = `apple-music-search-${artistName.toLowerCase()}`;
  const cached = cacheGet<AppleMusicArtist | null>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const music = await initializeMusicKit();

  try {
    // MusicKit v3 expects query params directly
    const response = await music.api.music<CatalogSearchResponse>(
      `/v1/catalog/${storefront}/search`,
      {
        term: artistName,
        types: 'artists',
        limit: 5,
      }
    );

    const artists = response.data.results?.artists?.data || [];

    // Find best match (exact name match preferred)
    const exactMatch = artists.find(
      (a) => a.attributes.name.toLowerCase() === artistName.toLowerCase()
    );
    const result = exactMatch || artists[0] || null;

    // Cache the result
    cacheSet(cacheKey, result, CacheTTL.LONG);

    return result;
  } catch (error) {
    console.error('Error searching Apple Music catalog:', error);
    return null;
  }
}

/**
 * Get artist details from catalog (includes artwork, albums)
 */
export async function getCatalogArtist(
  artistId: string,
  storefront: string = 'us'
): Promise<AppleMusicArtist | null> {
  // Check cache first
  const cacheKey = `apple-music-artist-${artistId}`;
  const cached = cacheGet<AppleMusicArtist>(cacheKey);
  if (cached) {
    return cached;
  }

  const music = await initializeMusicKit();

  try {
    // MusicKit v3 expects query params directly
    const response = await music.api.music<{ data: AppleMusicArtist[] }>(
      `/v1/catalog/${storefront}/artists/${artistId}`,
      { include: 'albums' }
    );

    const artist = response.data.data[0] || null;

    if (artist) {
      cacheSet(cacheKey, artist, CacheTTL.LONG);
    }

    return artist;
  } catch (error) {
    console.error('Error fetching catalog artist:', error);
    return null;
  }
}

/**
 * Get artist's top albums from catalog
 */
export async function getCatalogArtistAlbums(
  artistId: string,
  storefront: string = 'us',
  limit: number = 10
): Promise<AppleMusicAlbum[]> {
  // Check cache first
  const cacheKey = `apple-music-albums-${artistId}`;
  const cached = cacheGet<AppleMusicAlbum[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const music = await initializeMusicKit();

  try {
    // MusicKit v3 expects query params directly
    const response = await music.api.music<{ data: AppleMusicAlbum[] }>(
      `/v1/catalog/${storefront}/artists/${artistId}/albums`,
      { limit }
    );

    const albums = response.data.data || [];
    cacheSet(cacheKey, albums, CacheTTL.LONG);

    return albums;
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    return [];
  }
}

// Types for heavy rotation and recently played responses
interface HeavyRotationItem {
  id: string;
  type: string;
  attributes: {
    name?: string;
    artistName?: string;
    artwork?: { url: string };
  };
}

interface RecentlyPlayedItem {
  id: string;
  type: string;
  attributes: {
    name?: string;
    artistName?: string;
  };
}

/**
 * Get user's heavy rotation (most frequently played)
 * This is the Apple Music equivalent of Spotify's "top artists"
 */
export async function getHeavyRotation(limit: number = 25): Promise<HeavyRotationItem[]> {
  const music = await ensureAuthorized();

  try {
    const response = await music.api.music<{ data: HeavyRotationItem[] }>(
      '/v1/me/history/heavy-rotation',
      { limit }
    );

    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching heavy rotation:', error);
    return [];
  }
}

/**
 * Get user's recently played items
 */
export async function getRecentlyPlayed(limit: number = 25): Promise<RecentlyPlayedItem[]> {
  const music = await ensureAuthorized();

  try {
    const response = await music.api.music<{ data: RecentlyPlayedItem[] }>(
      '/v1/me/recent/played',
      { limit }
    );

    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching recently played:', error);
    return [];
  }
}

/**
 * Extract unique artist names from heavy rotation and recently played
 * Returns artists in order of frequency/recency (best matches first)
 */
export async function getTopArtistNames(): Promise<string[]> {
  const [heavyRotation, recentlyPlayed] = await Promise.all([
    getHeavyRotation(50),
    getRecentlyPlayed(50),
  ]);

  // Track artist frequency
  const artistCounts = new Map<string, number>();

  // Heavy rotation items get more weight (x3)
  for (const item of heavyRotation) {
    const artistName = item.attributes.artistName;
    if (artistName) {
      artistCounts.set(artistName, (artistCounts.get(artistName) || 0) + 3);
    }
  }

  // Recently played items get normal weight
  for (const item of recentlyPlayed) {
    const artistName = item.attributes.artistName;
    if (artistName) {
      artistCounts.set(artistName, (artistCounts.get(artistName) || 0) + 1);
    }
  }

  // Sort by count (most frequent first) and return names
  const sortedArtists = Array.from(artistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return sortedArtists;
}

/**
 * Get curated top artists - combines heavy rotation + recently played
 * This is the main function for importing (similar to Spotify's getCuratedTopArtists)
 */
export async function getCuratedTopArtists(maxArtists: number = 30): Promise<string[]> {
  const artistNames = await getTopArtistNames();
  return artistNames.slice(0, maxArtists);
}
