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

  const response = await music.api.music<LibraryArtistsResponse>(
    '/v1/me/library/artists',
    {
      parameters: {
        limit,
        offset,
      },
    }
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
    const response = await music.api.music<CatalogSearchResponse>(
      `/v1/catalog/${storefront}/search`,
      {
        parameters: {
          term: artistName,
          types: 'artists',
          limit: 5,
        },
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
    const response = await music.api.music<{ data: AppleMusicArtist[] }>(
      `/v1/catalog/${storefront}/artists/${artistId}`,
      {
        parameters: {
          include: 'albums',
        },
      }
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
    const response = await music.api.music<{ data: AppleMusicAlbum[] }>(
      `/v1/catalog/${storefront}/artists/${artistId}/albums`,
      {
        parameters: {
          limit,
        },
      }
    );

    const albums = response.data.data || [];
    cacheSet(cacheKey, albums, CacheTTL.LONG);

    return albums;
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    return [];
  }
}
