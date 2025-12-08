/**
 * Artist Autocomplete Hook
 *
 * Provides debounced autocomplete functionality for artist search.
 * Queries the server-side API which uses Solr for fast results.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArtistNode } from '@/types';

interface AutocompleteResult {
  suggestions: ArtistNode[];
  isLoading: boolean;
  error: string | null;
  source: 'solr' | 'postgres' | 'api' | 'none';
  latencyMs: number | null;
}

interface UseAutocompleteOptions {
  /** Minimum characters before searching (default: 2) */
  minChars?: number;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Maximum suggestions to show (default: 8) */
  limit?: number;
  /** Callback when autocomplete starts */
  onSearchStart?: () => void;
  /** Callback when autocomplete completes */
  onSearchComplete?: (results: ArtistNode[]) => void;
}

/**
 * Hook for debounced artist autocomplete
 *
 * @param query - Current search input value
 * @param options - Configuration options
 * @returns Autocomplete state and suggestions
 *
 * @example
 * ```tsx
 * const [inputValue, setInputValue] = useState('');
 * const { suggestions, isLoading } = useAutocomplete(inputValue);
 *
 * return (
 *   <div>
 *     <input value={inputValue} onChange={e => setInputValue(e.target.value)} />
 *     {suggestions.map(artist => (
 *       <div key={artist.id}>{artist.name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useAutocomplete(
  query: string,
  options: UseAutocompleteOptions = {}
): AutocompleteResult {
  const {
    minChars = 2,
    debounceMs = 300,
    limit = 8,
    onSearchStart,
    onSearchComplete,
  } = options;

  const [suggestions, setSuggestions] = useState<ArtistNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'solr' | 'postgres' | 'api' | 'none'>('none');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Track the latest query to handle race conditions
  const latestQueryRef = useRef(query);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    latestQueryRef.current = query;

    // Clear suggestions if query is too short
    if (!query || query.length < minChars) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      setSource('none');
      setLatencyMs(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Start loading after debounce
    const timeoutId = setTimeout(async () => {
      // Double-check query hasn't changed during debounce
      if (query !== latestQueryRef.current) return;

      setIsLoading(true);
      setError(null);
      onSearchStart?.();

      abortControllerRef.current = new AbortController();

      try {
        const params = new URLSearchParams({
          q: query,
          limit: String(limit),
        });

        const response = await fetch(`/api/autocomplete/artists?${params}`, {
          signal: abortControllerRef.current.signal,
        });

        // Check if query changed while waiting
        if (query !== latestQueryRef.current) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Final check before updating state
        if (query !== latestQueryRef.current) return;

        setSuggestions(data.artists || []);
        setSource(data.source || 'none');
        setLatencyMs(data.latencyMs || null);
        setError(null);
        onSearchComplete?.(data.artists || []);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Only update error if query hasn't changed
        if (query === latestQueryRef.current) {
          setError(err instanceof Error ? err.message : 'Autocomplete failed');
          setSuggestions([]);
        }
      } finally {
        if (query === latestQueryRef.current) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, minChars, debounceMs, limit, onSearchStart, onSearchComplete]);

  // Clear suggestions manually (useful when selecting)
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSource('none');
    setLatencyMs(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    source,
    latencyMs,
    clearSuggestions,
  } as AutocompleteResult & { clearSuggestions: () => void };
}
