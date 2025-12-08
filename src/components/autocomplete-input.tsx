'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Search, User, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAutocomplete } from '@/lib/musicbrainz/use-autocomplete';
import type { ArtistNode } from '@/types';

interface AutocompleteInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Called when user selects an artist from dropdown */
  onSelect: (artist: ArtistNode) => void;
  /** Called when user presses Enter or clicks Search (full search) */
  onSearch?: (query: string) => void;
  /** Initial input value */
  initialValue?: string;
  /** Minimum characters to trigger autocomplete */
  minChars?: number;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function AutocompleteInput({
  placeholder = 'Search for an artist...',
  onSelect,
  onSearch,
  initialValue = '',
  minChars = 2,
  autoFocus = false,
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  // Track the input value when dropdown was closed, to know when to reopen
  const [closedAtValue, setClosedAtValue] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { suggestions, isLoading, source, latencyMs } = useAutocomplete(inputValue, {
    minChars,
    debounceMs: 250,
    limit: 8,
  });

  // Derive isOpen from state - dropdown shows when:
  // 1. Input has focus
  // 2. We have suggestions
  // 3. Input meets minimum chars
  // 4. Input has changed since we closed the dropdown (or never closed)
  const isOpen = useMemo(() => {
    const wasClosedForThisValue = closedAtValue === inputValue;
    return (
      isFocused &&
      !wasClosedForThisValue &&
      suggestions.length > 0 &&
      inputValue.length >= minChars
    );
  }, [isFocused, closedAtValue, inputValue, suggestions.length, minChars]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (artist: ArtistNode) => {
      setInputValue(artist.name);
      setClosedAtValue(artist.name);
      onSelect(artist);
    },
    [onSelect]
  );

  const handleSearch = useCallback(() => {
    if (inputValue.trim().length >= minChars) {
      setClosedAtValue(inputValue);
      onSearch?.(inputValue.trim());
    }
  }, [inputValue, minChars, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setClosedAtValue(inputValue);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setClosedAtValue(inputValue);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            // Clear the closed state so dropdown can reopen
            setClosedAtValue(null);
          }}
          onBlur={() => {
            // Delay blur to allow click on dropdown items
            setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pr-10"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Search
              className="size-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={handleSearch}
            />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
        >
          <ul className="py-1 max-h-[320px] overflow-y-auto">
            {suggestions.map((artist, index) => (
              <li key={artist.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                    index === highlightedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleSelect(artist)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {artist.type === 'person' ? (
                      <User className="size-4 text-emerald-600" />
                    ) : (
                      <Users className="size-4 text-blue-600" />
                    )}
                  </div>

                  {/* Artist info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{artist.name}</span>
                      {artist.disambiguation && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          ({artist.disambiguation})
                        </span>
                      )}
                    </div>
                    {artist.activeYears?.begin && (
                      <p className="text-xs text-muted-foreground">
                        {artist.activeYears.begin}
                        {artist.activeYears.end
                          ? `–${artist.activeYears.end}`
                          : '–present'}
                      </p>
                    )}
                  </div>

                  {/* Country badge */}
                  {artist.country && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                      {artist.country}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* Footer with source info */}
          <div className="px-3 py-1.5 bg-muted/50 border-t border-border text-xs text-muted-foreground flex justify-between">
            <span>
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </span>
            {latencyMs !== null && (
              <span>
                {source === 'solr' ? 'Solr' : source === 'postgres' ? 'DB' : 'API'}{' '}
                · {latencyMs}ms
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
