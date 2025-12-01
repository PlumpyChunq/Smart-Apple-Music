'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getArtistReleaseGroups } from '@/lib/musicbrainz';
import { getArtistEvents } from '@/lib/concerts';
import type {
  TimelineEvent,
  TimelineEventType,
  ArtistNode,
  ArtistRelationship,
  MusicBrainzReleaseGroup,
} from '@/types';

interface UseArtistTimelineParams {
  artist: ArtistNode | null;
  relationships?: ArtistRelationship[];
  relatedArtists?: Map<string, ArtistNode>;
}

interface UseArtistTimelineResult {
  events: TimelineEvent[];
  isLoading: boolean;
  error: Error | null;
  yearRange: { min: number; max: number } | null;
}

/**
 * Parse a partial date string (YYYY, YYYY-MM, or YYYY-MM-DD) into a Date object
 */
function parseMusicBrainzDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  // Handle year-only (YYYY)
  if (dateStr.length === 4) {
    return new Date(parseInt(dateStr), 0, 1);
  }

  // Handle year-month (YYYY-MM)
  if (dateStr.length === 7) {
    const [year, month] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  // Handle full date (YYYY-MM-DD)
  if (dateStr.length === 10) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

/**
 * Convert release groups to timeline events
 */
function releaseGroupsToEvents(
  releaseGroups: MusicBrainzReleaseGroup[],
  artistName: string
): TimelineEvent[] {
  return releaseGroups
    .filter((rg) => rg['first-release-date'])
    .map((rg): TimelineEvent => {
      const date = parseMusicBrainzDate(rg['first-release-date']);
      if (!date) {
        // Fallback - shouldn't happen due to filter
        return null as unknown as TimelineEvent;
      }

      return {
        id: `album-${rg.id}`,
        date,
        year: date.getFullYear(),
        type: 'album' as TimelineEventType,
        title: rg.title,
        subtitle: rg['primary-type'] || 'Album',
        externalUrl: `https://musicbrainz.org/release-group/${rg.id}`,
        artistName,
      };
    })
    .filter(Boolean);
}

/**
 * Extract formation/dissolution events from artist node
 */
function getLifecycleEvents(artist: ArtistNode): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (artist.activeYears?.begin) {
    const date = parseMusicBrainzDate(artist.activeYears.begin);
    if (date) {
      events.push({
        id: `formation-${artist.id}`,
        date,
        year: date.getFullYear(),
        type: artist.type === 'group' ? 'formation' : 'formation',
        title: artist.type === 'group' ? `${artist.name} Formed` : `${artist.name} Career Began`,
        subtitle: artist.country || undefined,
        externalUrl: `https://musicbrainz.org/artist/${artist.id}`,
        artistName: artist.name,
      });
    }
  }

  if (artist.activeYears?.end) {
    const date = parseMusicBrainzDate(artist.activeYears.end);
    if (date) {
      events.push({
        id: `disbanded-${artist.id}`,
        date,
        year: date.getFullYear(),
        type: 'disbanded',
        title: artist.type === 'group' ? `${artist.name} Disbanded` : `${artist.name} Career Ended`,
        externalUrl: `https://musicbrainz.org/artist/${artist.id}`,
        artistName: artist.name,
      });
    }
  }

  return events;
}

/**
 * Extract member join/leave events from relationships
 */
function getMemberEvents(
  relationships: ArtistRelationship[],
  relatedArtists: Map<string, ArtistNode>,
  centralArtist: ArtistNode
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const rel of relationships) {
    if (rel.type !== 'member_of') continue;

    const relatedArtist = relatedArtists.get(rel.source === centralArtist.id ? rel.target : rel.source);
    if (!relatedArtist) continue;

    // Member joined
    if (rel.period?.begin) {
      const date = parseMusicBrainzDate(rel.period.begin);
      if (date) {
        events.push({
          id: `member-join-${rel.id}`,
          date,
          year: date.getFullYear(),
          type: 'member_join',
          title: `${relatedArtist.name} Joined`,
          subtitle: centralArtist.type === 'group' ? centralArtist.name : undefined,
          externalUrl: `https://musicbrainz.org/artist/${relatedArtist.id}`,
          relatedArtistIds: [relatedArtist.id],
          artistName: centralArtist.name,
        });
      }
    }

    // Member left
    if (rel.period?.end) {
      const date = parseMusicBrainzDate(rel.period.end);
      if (date) {
        events.push({
          id: `member-leave-${rel.id}`,
          date,
          year: date.getFullYear(),
          type: 'member_leave',
          title: `${relatedArtist.name} Left`,
          subtitle: centralArtist.type === 'group' ? centralArtist.name : undefined,
          externalUrl: `https://musicbrainz.org/artist/${relatedArtist.id}`,
          relatedArtistIds: [relatedArtist.id],
          artistName: centralArtist.name,
        });
      }
    }
  }

  return events;
}

/**
 * Hook to build a complete timeline for an artist
 */
export function useArtistTimeline({
  artist,
  relationships = [],
  relatedArtists = new Map(),
}: UseArtistTimelineParams): UseArtistTimelineResult {
  // Fetch release groups (albums)
  const {
    data: releaseGroups,
    isLoading: isLoadingReleases,
    error: releasesError,
  } = useQuery({
    queryKey: ['artistReleaseGroups', artist?.id],
    queryFn: () => getArtistReleaseGroups(artist!.id),
    enabled: !!artist?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch concerts
  const {
    data: concerts,
    isLoading: isLoadingConcerts,
    error: concertsError,
  } = useQuery({
    queryKey: ['artistConcerts', artist?.name],
    queryFn: () => getArtistEvents(artist!.name),
    enabled: !!artist?.name,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Build combined timeline
  const events = useMemo(() => {
    if (!artist) return [];

    const allEvents: TimelineEvent[] = [];

    // Add album events
    if (releaseGroups) {
      allEvents.push(...releaseGroupsToEvents(releaseGroups, artist.name));
    }

    // Add concert events
    if (concerts) {
      const concertEvents: TimelineEvent[] = concerts.map((concert) => ({
        id: `concert-${concert.id}`,
        date: concert.date,
        year: concert.date.getFullYear(),
        type: 'concert' as TimelineEventType,
        title: concert.venue,
        subtitle: `${concert.city}${concert.region ? `, ${concert.region}` : ''}`,
        externalUrl: concert.ticketUrl || undefined,
        artistName: artist.name,
      }));
      allEvents.push(...concertEvents);
    }

    // Add lifecycle events (formation/disbanded)
    allEvents.push(...getLifecycleEvents(artist));

    // Add member events
    allEvents.push(...getMemberEvents(relationships, relatedArtists, artist));

    // Sort by date (oldest first)
    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [artist, releaseGroups, concerts, relationships, relatedArtists]);

  // Calculate year range
  const yearRange = useMemo(() => {
    if (events.length === 0) return null;

    const years = events.map((e) => e.year);
    return {
      min: Math.min(...years),
      max: Math.max(...years),
    };
  }, [events]);

  const isLoading = isLoadingReleases || isLoadingConcerts;
  const error = releasesError || concertsError || null;

  return {
    events,
    isLoading,
    error,
    yearRange,
  };
}
