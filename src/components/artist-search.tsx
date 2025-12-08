'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useArtistSearch } from '@/lib/musicbrainz/hooks';
import { Button } from '@/components/ui/button';
import { AutocompleteInput } from '@/components/autocomplete-input';
import { FavoritesByGenre } from '@/components/favorites-by-genre';
import { FAVORITES_KEY, type StoredArtist } from '@/lib/favorites';
import type { ArtistNode } from '@/types';

// localStorage keys for this component
const RECENT_SEARCHES_KEY = 'interchord-recent-searches';
const MAX_RECENT_SEARCHES = 5;

interface ArtistSearchProps {
  onSelectArtist: (artist: ArtistNode) => void;
}

const INITIAL_RESULTS_DISPLAY = 5;

export function ArtistSearch({ onSelectArtist }: ArtistSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<StoredArtist[]>([]);
  const [favorites, setFavorites] = useState<StoredArtist[]>([]);
  const [showAllResults, setShowAllResults] = useState(false);

  const { data: results, error } = useArtistSearch(searchQuery);

  // Reset expansion when search query changes (ref-based to avoid effect)
  const prevSearchQueryRef = useRef(searchQuery);
  if (prevSearchQueryRef.current !== searchQuery) {
    prevSearchQueryRef.current = searchQuery;
    if (showAllResults) setShowAllResults(false);
  }

  // Load recent searches and favorites from localStorage on mount
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const storedRecent = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedRecent) {
          setRecentSearches(JSON.parse(storedRecent));
        }
        const storedFavorites = localStorage.getItem(FAVORITES_KEY);
        if (storedFavorites) {
          setFavorites(JSON.parse(storedFavorites));
        }
      } catch {
        // Ignore localStorage errors
      }
    };

    loadFromStorage();

    // Listen for storage events to update favorites reactively
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY && e.newValue) {
        try {
          setFavorites(JSON.parse(e.newValue));
        } catch {
          // Ignore
        }
      }
    };

    // Listen for custom event (same-tab updates from useFavorites hook)
    const handleFavoritesUpdated = () => {
      try {
        const storedFavorites = localStorage.getItem(FAVORITES_KEY);
        if (storedFavorites) {
          setFavorites(JSON.parse(storedFavorites));
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('favorites-updated', handleFavoritesUpdated);

    // Poll for changes as a backup during Spotify imports
    // (events can be missed when dropdown is closed during import)
    const pollInterval = setInterval(() => {
      try {
        const storedFavorites = localStorage.getItem(FAVORITES_KEY);
        if (storedFavorites) {
          const parsed = JSON.parse(storedFavorites);
          setFavorites((prev) => {
            // Only update if the data actually changed
            if (prev.length !== parsed.length) {
              return parsed;
            }
            // Check if IDs match (quick comparison)
            const prevIds = prev.map((f: StoredArtist) => f.id).sort().join(',');
            const newIds = parsed.map((f: StoredArtist) => f.id).sort().join(',');
            if (prevIds !== newIds) {
              return parsed;
            }
            return prev;
          });
        }
      } catch {
        // Ignore
      }
    }, 1500); // Poll every 1.5 seconds

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('favorites-updated', handleFavoritesUpdated);
      clearInterval(pollInterval);
    };
  }, []);

  // Save recent search when an artist is selected
  const saveRecentSearch = useCallback((artist: ArtistNode) => {
    const stored: StoredArtist = {
      id: artist.id,
      name: artist.name,
      type: artist.type,
      country: artist.country,
    };

    setRecentSearches((prev) => {
      // Remove if already exists, then add to front
      const filtered = prev.filter((a) => a.id !== stored.id);
      const updated = [stored, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  // Handle full search (when user presses Enter without selecting from dropdown)
  const handleSearch = useCallback((query: string) => {
    if (query.length >= 2) {
      setSearchQuery(query);
    }
  }, []);

  // Handle direct selection from autocomplete dropdown
  const handleAutocompleteSelect = useCallback(
    (artist: ArtistNode) => {
      saveRecentSearch(artist);
      setSearchQuery(''); // Clear search results when selecting from autocomplete
      onSelectArtist(artist);
    },
    [saveRecentSearch, onSelectArtist]
  );

  // Handle selection from search results list
  const handleSelectArtist = useCallback(
    (artist: ArtistNode) => {
      saveRecentSearch(artist);
      onSelectArtist(artist);
    },
    [saveRecentSearch, onSelectArtist]
  );

  const handleQuickSelect = useCallback(
    (stored: StoredArtist) => {
      // Convert StoredArtist to ArtistNode
      const artist: ArtistNode = {
        id: stored.id,
        name: stored.name,
        type: stored.type as 'person' | 'group',
        loaded: false,
        country: stored.country,
      };
      saveRecentSearch(artist);
      onSelectArtist(artist);
    },
    [saveRecentSearch, onSelectArtist]
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Update an artist's genre assignment (for drag-and-drop between sections)
  const updateArtistGenre = useCallback((artistId: string, genre: string) => {
    setFavorites((prev) => {
      const updated = prev.map((f) => {
        if (f.id === artistId) {
          return { ...f, overrideGenre: genre };
        }
        return f;
      });
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event('favorites-updated'));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Autocomplete Search Input */}
      <AutocompleteInput
        placeholder="Search for an artist (e.g., Butthole Surfers)"
        onSelect={handleAutocompleteSelect}
        onSearch={handleSearch}
        autoFocus
      />

      {/* Search Results - appear first when there's a search */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Error: {error.message}
        </div>
      )}

      {results && results.length === 0 && searchQuery && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
          No artists found for &quot;{searchQuery}&quot;
        </div>
      )}

      {results && results.length > 0 && (() => {
        const displayedResults = showAllResults
          ? results
          : results.slice(0, INITIAL_RESULTS_DISPLAY);
        const hiddenCount = results.length - INITIAL_RESULTS_DISPLAY;

        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Found {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </p>
            <div className="space-y-1">
              {displayedResults.map((artist) => (
                <div
                  key={artist.id}
                  className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleSelectArtist(artist)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{artist.name}</span>
                      {artist.disambiguation && (
                        <span className="text-xs text-gray-500 truncate hidden sm:inline">
                          ({artist.disambiguation})
                        </span>
                      )}
                    </div>
                    {artist.activeYears?.begin && (
                      <p className="text-xs text-gray-400">
                        {artist.activeYears.begin}
                        {artist.activeYears.end ? `–${artist.activeYears.end}` : '–present'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                      {artist.type}
                    </span>
                    {artist.country && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                        {artist.country}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hiddenCount > 0 && !showAllResults && (
              <button
                onClick={() => setShowAllResults(true)}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Show {hiddenCount} more result{hiddenCount !== 1 ? 's' : ''}
              </button>
            )}
            {showAllResults && results.length > INITIAL_RESULTS_DISPLAY && (
              <button
                onClick={() => setShowAllResults(false)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        );
      })()}

      {/* Favorites Section - Grouped by Genre */}
      {favorites.length > 0 && (
        <FavoritesByGenre
          favorites={favorites}
          onSelectArtist={handleQuickSelect}
          onUpdateArtistGenre={updateArtistGenre}
        />
      )}

      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Recent Searches</span>
            <button
              onClick={clearRecentSearches}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((artist) => (
              <Button
                key={artist.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(artist)}
                className="text-xs"
              >
                {artist.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export helper functions from lib/favorites for backwards compatibility
// New code should import directly from '@/lib/favorites'
export { addToFavorites, removeFromFavorites, isFavorite } from '@/lib/favorites';
