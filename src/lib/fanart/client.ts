import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import type { ArtistNode } from '@/types';

// Fanart.tv API response types
interface FanartImage {
  id: string;
  url: string;
  likes: string;
}

interface FanartArtistResponse {
  name: string;
  mbid_id: string;
  artistthumb?: FanartImage[];
  artistbackground?: FanartImage[];
  hdmusiclogo?: FanartImage[];
  musiclogo?: FanartImage[];
  musicbanner?: FanartImage[];
}

/**
 * Get artist images from fanart.tv using MusicBrainz ID
 * Returns high-quality artist thumbnails and backgrounds
 * Uses server-side proxy to avoid CORS issues
 */
export async function getFanartImages(mbid: string): Promise<{
  thumbUrl?: string;
  backgroundUrl?: string;
  logoUrl?: string;
} | null> {
  const cacheKey = `fanart-${mbid}`;
  const cached = cacheGet<{ thumbUrl?: string; backgroundUrl?: string; logoUrl?: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`/api/fanart?mbid=${encodeURIComponent(mbid)}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.notFound || data.error) {
      // Artist not in fanart.tv database - cache empty result
      cacheSet(cacheKey, {}, CacheTTL.LONG);
      return null;
    }

    const fanartData = data as FanartArtistResponse;

    // Get best images (sorted by likes)
    const sortByLikes = (images?: FanartImage[]) =>
      images?.sort((a, b) => parseInt(b.likes) - parseInt(a.likes));

    const thumbs = sortByLikes(fanartData.artistthumb);
    const backgrounds = sortByLikes(fanartData.artistbackground);
    const logos = sortByLikes(fanartData.hdmusiclogo) || sortByLikes(fanartData.musiclogo);

    const result = {
      thumbUrl: thumbs?.[0]?.url,
      backgroundUrl: backgrounds?.[0]?.url,
      logoUrl: logos?.[0]?.url,
    };

    cacheSet(cacheKey, result, CacheTTL.LONG);
    return result;
  } catch (error) {
    console.error('Error fetching fanart.tv images:', error);
    return null;
  }
}

/**
 * Enrich an artist with fanart.tv images
 * Uses MusicBrainz ID directly (no search needed)
 */
export async function enrichArtistWithFanart(
  artist: ArtistNode
): Promise<ArtistNode> {
  const cacheKey = `fanart-enriched-${artist.id}`;
  const cached = cacheGet<Partial<ArtistNode>>(cacheKey);
  if (cached?.imageUrl) {
    return { ...artist, ...cached };
  }

  try {
    const images = await getFanartImages(artist.id);

    if (!images) {
      return artist;
    }

    // Prefer thumb for profile image, but background is also good
    const imageUrl = images.thumbUrl || images.backgroundUrl;

    if (!imageUrl) {
      return artist;
    }

    const enrichmentData: Partial<ArtistNode> = {
      imageUrl,
    };

    cacheSet(cacheKey, enrichmentData, CacheTTL.LONG);
    return { ...artist, ...enrichmentData };
  } catch (error) {
    console.error('Error enriching artist with fanart.tv:', error);
    return artist;
  }
}
