import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type { ArtistNode, AppleMusicAlbumInfo } from '@/types';

// Uses server-side proxy at /api/discogs to avoid CORS issues

// Discogs API response types
interface DiscogsImage {
  type: 'primary' | 'secondary';
  uri: string;
  uri150: string;
  width: number;
  height: number;
}

interface DiscogsArtist {
  id: number;
  name: string;
  resource_url: string;
  uri: string;
  images?: DiscogsImage[];
  profile?: string;
}

interface DiscogsSearchResult {
  id: number;
  type: string;
  title: string;
  thumb: string;
  cover_image: string;
  resource_url: string;
}

interface DiscogsSearchResponse {
  results: DiscogsSearchResult[];
  pagination: {
    items: number;
    page: number;
    pages: number;
  };
}

interface DiscogsRelease {
  id: number;
  title: string;
  type: string;
  year?: number;
  thumb: string;
  resource_url: string;
  artist: string;
  role: string;
  main_release?: number;
}

interface DiscogsReleasesResponse {
  releases: DiscogsRelease[];
  pagination: {
    items: number;
    page: number;
    pages: number;
  };
}

/**
 * Search for an artist on Discogs
 * Uses server-side proxy to avoid CORS issues
 */
export async function searchDiscogsArtist(artistName: string): Promise<{
  id: number;
  imageUrl?: string;
} | null> {
  const cacheKey = `discogs-search-${artistName.toLowerCase()}`;
  const cached = cacheGet<{ id: number; imageUrl?: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      action: 'search',
      q: artistName,
      type: 'artist',
    });

    const response = await fetch(`/api/discogs?${params}`);

    if (!response.ok) {
      return null;
    }

    const data: DiscogsSearchResponse = await response.json();

    if (!data?.results?.length) {
      return null;
    }

    // Find best match (exact name match preferred)
    const exactMatch = data.results.find(
      r => r.title.toLowerCase() === artistName.toLowerCase()
    );
    const result = exactMatch || data.results[0];

    const searchResult = {
      id: result.id,
      imageUrl: result.cover_image || result.thumb || undefined,
    };

    cacheSet(cacheKey, searchResult, CacheTTL.LONG);
    return searchResult;
  } catch (error) {
    console.error('Error searching Discogs:', error);
    return null;
  }
}

/**
 * Get artist details from Discogs (includes higher quality images)
 * Uses server-side proxy to avoid CORS issues
 */
export async function getDiscogsArtist(artistId: number): Promise<{
  imageUrl?: string;
  url?: string;
} | null> {
  const cacheKey = `discogs-artist-${artistId}`;
  const cached = cacheGet<{ imageUrl?: string; url?: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      action: 'artist',
      id: String(artistId),
    });

    const response = await fetch(`/api/discogs?${params}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.notFound || data.error) {
      return null;
    }

    const artistData = data as DiscogsArtist;

    // Get primary image or first available
    const primaryImage = artistData.images?.find(img => img.type === 'primary');
    const anyImage = artistData.images?.[0];
    const imageUrl = primaryImage?.uri || anyImage?.uri;

    const result = {
      imageUrl,
      url: artistData.uri,
    };

    cacheSet(cacheKey, result, CacheTTL.LONG);
    return result;
  } catch (error) {
    console.error('Error fetching Discogs artist:', error);
    return null;
  }
}

/**
 * Get artist's releases from Discogs
 * Uses server-side proxy to avoid CORS issues
 */
export async function getDiscogsReleases(
  artistId: number,
  limit: number = 6
): Promise<AppleMusicAlbumInfo[]> {
  const cacheKey = `discogs-releases-${artistId}`;
  const cached = cacheGet<AppleMusicAlbumInfo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      action: 'releases',
      id: String(artistId),
      per_page: String(limit * 2), // Fetch extra to filter
    });

    const response = await fetch(`/api/discogs?${params}`);

    if (!response.ok) {
      return [];
    }

    const data: DiscogsReleasesResponse = await response.json();

    if (!data?.releases?.length) {
      return [];
    }

    // Filter to main releases (albums), not appearances or compilations
    const albums = data.releases
      .filter(r => r.role === 'Main' && r.type === 'master')
      .slice(0, limit)
      .map(release => ({
        id: `discogs-${release.id}`,
        name: release.title,
        artistName: release.artist,
        artworkUrl: release.thumb || undefined,
        releaseDate: release.year ? `${release.year}` : undefined,
      }));

    cacheSet(cacheKey, albums, CacheTTL.LONG);
    return albums;
  } catch (error) {
    console.error('Error fetching Discogs releases:', error);
    return [];
  }
}

/**
 * Enrich an artist with Discogs data (image, albums)
 */
export async function enrichArtistWithDiscogs(
  artist: ArtistNode
): Promise<ArtistNode> {
  const cacheKey = `discogs-enriched-${artist.id}`;
  const cached = cacheGet<Partial<ArtistNode>>(cacheKey);
  if (cached && (cached.imageUrl || cached.albums?.length)) {
    return { ...artist, ...cached };
  }

  try {
    // First search for the artist
    const searchResult = await searchDiscogsArtist(artist.name);

    if (!searchResult) {
      return artist;
    }

    // Fetch detailed artist info and releases in parallel
    const [artistDetails, releases] = await Promise.all([
      getDiscogsArtist(searchResult.id),
      getDiscogsReleases(searchResult.id, 6),
    ]);

    const enrichmentData: Partial<ArtistNode> = {};

    // Prefer detailed image over search thumbnail
    if (artistDetails?.imageUrl) {
      enrichmentData.imageUrl = artistDetails.imageUrl;
    } else if (searchResult.imageUrl) {
      enrichmentData.imageUrl = searchResult.imageUrl;
    }

    if (releases.length > 0) {
      enrichmentData.albums = releases;
    }

    if (artistDetails?.url) {
      enrichmentData.externalIds = {
        ...artist.externalIds,
        discogs: artistDetails.url,
      };
    }

    cacheSet(cacheKey, enrichmentData, CacheTTL.LONG);
    return { ...artist, ...enrichmentData };
  } catch (error) {
    console.error('Error enriching artist with Discogs:', error);
    return artist;
  }
}
