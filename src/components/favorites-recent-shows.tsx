'use client';

import { useMemo } from 'react';
import { useMultipleArtistsConcerts, ConcertWithArtist, RECENT_THRESHOLD_MS } from '@/lib/concerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FavoritesRecentShowsProps {
  artistNames: string[];
  maxDisplay?: number;
}

export function FavoritesRecentShows({ artistNames, maxDisplay = 8 }: FavoritesRecentShowsProps) {
  const { concerts, isLoading, loadingCount, totalArtists } = useMultipleArtistsConcerts(artistNames);

  // Show most recent concerts first (already sorted by date)
  const recentConcerts = useMemo(() => {
    return concerts.slice(0, maxDisplay);
  }, [concerts, maxDisplay]);

  // Count shows in last 90 days
  const recentCount = useMemo(() => {
    const now = new Date();
    const threshold = new Date(now.getTime() - RECENT_THRESHOLD_MS);
    return concerts.filter((c) => c.date <= now && c.date >= threshold).length;
  }, [concerts]);

  if (artistNames.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TicketIcon className="w-4 h-4" />
          Recent Shows from Favorites
          {isLoading && (
            <span className="ml-auto text-xs font-normal text-gray-400">
              Loading ({totalArtists - loadingCount}/{totalArtists})...
            </span>
          )}
          {!isLoading && recentCount > 0 && (
            <span className="ml-auto text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {recentCount} in last 90 days
            </span>
          )}
        </CardTitle>
        {artistNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {artistNames.slice(0, 5).map((name) => (
              <a
                key={name}
                href={`https://www.songkick.com/search?query=${encodeURIComponent(name)}&type=artists`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:text-green-800 hover:underline"
              >
                {name} tour dates →
              </a>
            ))}
            {artistNames.length > 5 && (
              <span className="text-xs text-gray-400">+{artistNames.length - 5} more</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && recentConcerts.length === 0 ? (
          <div className="space-y-3">
            <ConcertSkeleton />
            <ConcertSkeleton />
            <ConcertSkeleton />
          </div>
        ) : recentConcerts.length === 0 ? (
          <p className="text-sm text-gray-500">No recent shows from your favorites</p>
        ) : (
          <div className="space-y-3">
            {recentConcerts.map((concert) => (
              <ConcertItem key={`${concert.artistName}-${concert.id}`} concert={concert} />
            ))}
            {concerts.length > maxDisplay && (
              <p className="text-xs text-gray-500 text-center pt-2">
                +{concerts.length - maxDisplay} more shows
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConcertItem({ concert }: { concert: ConcertWithArtist }) {
  const now = new Date();
  const threshold = new Date(now.getTime() - RECENT_THRESHOLD_MS);
  const isRecent = concert.date >= threshold;

  return (
    <div className="flex items-start gap-3 group">
      <div className={`flex-shrink-0 w-12 text-center ${isRecent ? 'text-blue-600' : 'text-gray-500'}`}>
        <div className="text-xs uppercase font-medium">
          {concert.date.toLocaleDateString('en-US', { month: 'short' })}
        </div>
        <div className="text-lg font-bold leading-tight">
          {concert.date.getDate()}
        </div>
        <div className="text-xs text-gray-400">
          {concert.date.getFullYear()}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-amber-700">
          {concert.artistName}
        </p>
        <p className="text-sm truncate">
          {concert.venue}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {concert.city}
          {concert.region && `, ${concert.region}`}
          {concert.country && concert.country !== 'United States' && ` - ${concert.country}`}
        </p>
      </div>
      {concert.ticketUrl && (
        <a
          href={concert.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Setlist
        </a>
      )}
    </div>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
      />
    </svg>
  );
}

function ConcertSkeleton() {
  return (
    <div className="flex items-start gap-3 animate-pulse">
      <div className="flex-shrink-0 w-12 text-center">
        <div className="h-3 w-8 mx-auto bg-gray-200 rounded mb-1" />
        <div className="h-5 w-6 mx-auto bg-gray-200 rounded" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
        <div className="h-4 w-3/4 bg-gray-200 rounded mb-1" />
        <div className="h-3 w-1/2 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
