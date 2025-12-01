import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type { ArtistNode, AppleMusicAlbumInfo } from '@/types';

// Uses server-side proxy at /api/lastfm to avoid CORS issues

// Last.fm API response types
interface LastFmImage {
  '#text': string;
  size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega' | '';
}

interface LastFmArtist {
  name: string;
  mbid?: string;
  url: string;
  image?: LastFmImage[];
  bio?: {
    summary: string;
    content: string;
  };
}

interface LastFmAlbum {
  name: string;
  artist: {
    name: string;
    mbid?: string;
  };
  mbid?: string;
  url: string;
  image?: LastFmImage[];
  playcount?: number;
}

interface LastFmArtistInfoResponse {
  artist: LastFmArtist;
}

interface LastFmTopAlbumsResponse {
  topalbums: {
    album: LastFmAlbum[];
    '@attr': {
      artist: string;
      total: string;
    };
  };
}

// Get the best available image URL from Last.fm images array
function getBestImageUrl(images?: LastFmImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;

  // Prefer larger sizes
  const sizeOrder = ['mega', 'extralarge', 'large', 'medium', 'small'];

  for (const size of sizeOrder) {
    const image = images.find(img => img.size === size && img['#text']);
    if (image?.['#text']) {
      return image['#text'];
    }
  }

  // Fallback to any image with a URL
  const anyImage = images.find(img => img['#text']);
  return anyImage?.['#text'];
}

/**
 * Get artist info from Last.fm
 * Uses server-side proxy to avoid CORS issues
 */
export async function getLastFmArtistInfo(artistName: string): Promise<{
  imageUrl?: string;
  url?: string;
} | null> {
  const cacheKey = `lastfm-artist-${artistName.toLowerCase()}`;
  const cached = cacheGet<{ imageUrl?: string; url?: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      method: 'artist.getinfo',
      artist: artistName,
    });

    const response = await fetch(`/api/lastfm?${params}`);

    if (!response.ok) {
      return null;
    }

    const data: LastFmArtistInfoResponse = await response.json();

    if (!data.artist) {
      return null;
    }

    const result = {
      imageUrl: getBestImageUrl(data.artist.image),
      url: data.artist.url,
    };

    cacheSet(cacheKey, result, CacheTTL.LONG);
    return result;
  } catch (error) {
    console.error('Error fetching Last.fm artist info:', error);
    return null;
  }
}

/**
 * Get top albums for an artist from Last.fm
 * Uses server-side proxy to avoid CORS issues
 */
export async function getLastFmTopAlbums(
  artistName: string,
  limit: number = 6
): Promise<AppleMusicAlbumInfo[]> {
  const cacheKey = `lastfm-albums-${artistName.toLowerCase()}`;
  const cached = cacheGet<AppleMusicAlbumInfo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      method: 'artist.gettopalbums',
      artist: artistName,
      limit: String(limit),
    });

    const response = await fetch(`/api/lastfm?${params}`);

    if (!response.ok) {
      return [];
    }

    const data: LastFmTopAlbumsResponse = await response.json();

    if (!data.topalbums?.album) {
      return [];
    }

    const albums: AppleMusicAlbumInfo[] = data.topalbums.album
      .filter(album => album.name && album.name !== '(null)')
      .map(album => ({
        id: album.mbid || `lastfm-${album.name}`,
        name: album.name,
        artistName: album.artist.name,
        artworkUrl: getBestImageUrl(album.image),
      }));

    cacheSet(cacheKey, albums, CacheTTL.LONG);
    return albums;
  } catch (error) {
    console.error('Error fetching Last.fm top albums:', error);
    return [];
  }
}

/**
 * Enrich an artist with Last.fm data (image, albums)
 */
export async function enrichArtistWithLastFm(
  artist: ArtistNode
): Promise<ArtistNode> {
  const cacheKey = `lastfm-enriched-${artist.id}`;
  const cached = cacheGet<Partial<ArtistNode>>(cacheKey);
  if (cached) {
    return { ...artist, ...cached };
  }

  try {
    // Fetch artist info and albums in parallel
    const [artistInfo, albums] = await Promise.all([
      getLastFmArtistInfo(artist.name),
      getLastFmTopAlbums(artist.name, 6),
    ]);

    const enrichmentData: Partial<ArtistNode> = {};

    if (artistInfo?.imageUrl) {
      enrichmentData.imageUrl = artistInfo.imageUrl;
    }

    if (albums.length > 0) {
      enrichmentData.albums = albums;
    }

    // Update external IDs
    if (artistInfo?.url) {
      enrichmentData.externalIds = {
        ...artist.externalIds,
        lastfm: artistInfo.url,
      };
    }

    cacheSet(cacheKey, enrichmentData, CacheTTL.LONG);
    return { ...artist, ...enrichmentData };
  } catch (error) {
    console.error('Error enriching artist with Last.fm:', error);
    return artist;
  }
}
