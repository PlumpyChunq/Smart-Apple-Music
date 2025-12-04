import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import { searchCatalogArtist, getCatalogArtistAlbums, formatArtworkUrl } from './client';
import { getMusicKitInstance } from './config';
import { enrichArtistWithFanart } from '@/lib/fanart';
import { enrichArtistWithLastFm } from '@/lib/lastfm';
import { enrichArtistWithDiscogs } from '@/lib/discogs';
import { getArtistReleaseGroups } from '@/lib/musicbrainz';
import type { ArtistNode, AppleMusicAlbumInfo } from '@/types';

const ENRICHMENT_CACHE_PREFIX = 'enriched-';

/**
 * Merge albums with MusicBrainz release dates
 * Last.fm/Discogs albums have images but no dates; MusicBrainz has dates but no images
 */
function mergeAlbumsWithReleaseDates(
  albums: AppleMusicAlbumInfo[],
  mbReleaseGroups: Array<{ title: string; 'first-release-date'?: string; 'primary-type'?: string }>
): AppleMusicAlbumInfo[] {
  if (!mbReleaseGroups?.length) return albums;

  // Create a map of MB release dates by normalized title
  const dateMap = new Map<string, string>();
  for (const rg of mbReleaseGroups) {
    if (rg['first-release-date'] && rg['primary-type'] === 'Album') {
      const normalizedTitle = rg.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      dateMap.set(normalizedTitle, rg['first-release-date']);
    }
  }

  // Merge dates into albums
  return albums.map((album) => {
    const normalizedTitle = album.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mbDate = dateMap.get(normalizedTitle);
    return {
      ...album,
      releaseDate: mbDate || album.releaseDate,
    };
  });
}

/**
 * Enrich an artist using fallback sources
 * Priority: Fanart.tv (best images, uses MBID) → Last.fm → Discogs
 * Also fetches MusicBrainz release groups for accurate release dates
 */
async function enrichWithFallbackSources(artist: ArtistNode): Promise<ArtistNode> {
  // Fetch MusicBrainz release groups in parallel for release dates
  const mbReleaseGroupsPromise = getArtistReleaseGroups(artist.id).catch(() => null);

  // Try fanart.tv first for high-quality images (uses MBID directly)
  let enriched = await enrichArtistWithFanart(artist);

  // Try Last.fm for images (if fanart.tv didn't have any) and albums
  const lastfmEnriched = await enrichArtistWithLastFm(artist);

  // Merge fanart.tv + Last.fm
  enriched = {
    ...enriched,
    imageUrl: enriched.imageUrl || lastfmEnriched.imageUrl,
    albums: lastfmEnriched.albums,
    externalIds: {
      ...enriched.externalIds,
      ...lastfmEnriched.externalIds,
    },
  };

  // If no albums yet, try Discogs as fallback
  if (!enriched.albums?.length) {
    const discogsEnriched = await enrichArtistWithDiscogs(artist);
    enriched = {
      ...enriched,
      imageUrl: enriched.imageUrl || discogsEnriched.imageUrl,
      albums: discogsEnriched.albums,
      externalIds: {
        ...enriched.externalIds,
        ...discogsEnriched.externalIds,
      },
    };
  }

  // Merge MusicBrainz release dates into albums
  const mbReleaseGroups = await mbReleaseGroupsPromise;
  if (enriched.albums?.length && mbReleaseGroups) {
    enriched.albums = mergeAlbumsWithReleaseDates(enriched.albums, mbReleaseGroups);
  }

  return enriched;
}

/**
 * Enrich an ArtistNode with Apple Music data (image, albums)
 * Falls back to Last.fm/Discogs if Apple Music is not available
 * Returns a new ArtistNode with enrichment fields populated
 */
export async function enrichArtistWithAppleMusic(
  artist: ArtistNode
): Promise<ArtistNode> {
  // Check if we already have enriched data cached
  const cacheKey = `${ENRICHMENT_CACHE_PREFIX}${artist.id}`;
  const cached = cacheGet<Partial<ArtistNode>>(cacheKey);
  if (cached && (cached.imageUrl || cached.albums?.length)) {
    return { ...artist, ...cached };
  }

  // Check if MusicKit is available and initialized
  const musicKit = getMusicKitInstance();
  if (!musicKit) {
    // MusicKit not initialized, use fallback sources
    return enrichWithFallbackSources(artist);
  }

  try {
    // Search for artist in Apple Music catalog
    const catalogArtist = await searchCatalogArtist(artist.name);

    if (!catalogArtist) {
      // Artist not found in catalog, cache empty result to avoid repeated lookups
      cacheSet(cacheKey, {}, CacheTTL.LONG);
      return artist;
    }

    // Get artist's albums
    const catalogAlbums = await getCatalogArtistAlbums(catalogArtist.id, 'us', 50);

    // Format artwork URL
    const imageUrl = formatArtworkUrl(catalogArtist.attributes.artwork, 500);

    // Convert albums to simplified format
    const albums: AppleMusicAlbumInfo[] = catalogAlbums.map((album) => ({
      id: album.id,
      name: album.attributes.name,
      artistName: album.attributes.artistName,
      artworkUrl: formatArtworkUrl(album.attributes.artwork, 200),
      releaseDate: album.attributes.releaseDate,
      trackCount: album.attributes.trackCount,
    }));

    // Create enrichment data
    const enrichmentData: Partial<ArtistNode> = {
      imageUrl,
      albums,
      externalIds: {
        ...artist.externalIds,
        appleMusic: catalogArtist.id,
      },
    };

    // Cache the enrichment data
    cacheSet(cacheKey, enrichmentData, CacheTTL.LONG);

    return { ...artist, ...enrichmentData };
  } catch (error) {
    console.error('Error enriching artist with Apple Music:', error);
    // Fall back to Last.fm/Discogs on Apple Music error
    return enrichWithFallbackSources(artist);
  }
}

/**
 * Enrich multiple artists with Apple Music data
 * Processes in parallel but with rate limiting
 */
export async function enrichArtistsWithAppleMusic(
  artists: ArtistNode[]
): Promise<ArtistNode[]> {
  // Process in batches of 5 to avoid overwhelming the API
  const batchSize = 5;
  const enrichedArtists: ArtistNode[] = [];

  for (let i = 0; i < artists.length; i += batchSize) {
    const batch = artists.slice(i, i + batchSize);
    const enrichedBatch = await Promise.all(
      batch.map((artist) => enrichArtistWithAppleMusic(artist))
    );
    enrichedArtists.push(...enrichedBatch);
  }

  return enrichedArtists;
}

/**
 * Check if an artist has been enriched with Apple Music data
 */
export function isArtistEnriched(artist: ArtistNode): boolean {
  return !!(artist.imageUrl || artist.albums?.length || artist.externalIds?.appleMusic);
}

/**
 * Clear enrichment cache for an artist
 */
export function clearEnrichmentCache(artistId: string): void {
  const cacheKey = `${ENRICHMENT_CACHE_PREFIX}${artistId}`;
  // Remove from localStorage
  try {
    localStorage.removeItem(cacheKey);
  } catch {
    // Ignore storage errors
  }
}
