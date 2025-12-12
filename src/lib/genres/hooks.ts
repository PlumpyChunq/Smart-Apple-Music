'use client';

import { useState, useCallback } from 'react';
import {
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
} from '@/lib/storage';

// Default genre category order
export const DEFAULT_GENRE_ORDER = [
  'Rock',
  'Punk/Hardcore',
  'Metal',
  'Indie/Alternative',
  'Grunge',
  'New Wave',
  'Pop',
  'Jazz',
  'Electronic',
  'Hip-Hop',
  'R&B/Soul',
  'Folk/Country',
  'Blues',
  'Classical',
  'World',
  'Experimental',
  'Other',
];

// Color schemes for each genre
export interface GenreColorScheme {
  header: string;
  content: string;
  border: string;
  text: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
}

export const GENRE_COLORS: Record<string, GenreColorScheme> = {
  'Rock': { header: 'bg-red-50 dark:bg-red-950', content: 'bg-red-50/30 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', buttonBg: 'bg-red-50 dark:bg-red-900', buttonBorder: 'border-red-300 dark:border-red-700', buttonText: 'text-red-700 dark:text-red-200' },
  'Punk/Hardcore': { header: 'bg-rose-50 dark:bg-rose-950', content: 'bg-rose-50/30 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', buttonBg: 'bg-rose-50 dark:bg-rose-900', buttonBorder: 'border-rose-300 dark:border-rose-700', buttonText: 'text-rose-700 dark:text-rose-200' },
  'Metal': { header: 'bg-zinc-100 dark:bg-zinc-900', content: 'bg-zinc-100/30 dark:bg-zinc-900/30', border: 'border-zinc-300 dark:border-zinc-700', text: 'text-zinc-700 dark:text-zinc-300', buttonBg: 'bg-zinc-100 dark:bg-zinc-800', buttonBorder: 'border-zinc-400 dark:border-zinc-600', buttonText: 'text-zinc-700 dark:text-zinc-200' },
  'Indie/Alternative': { header: 'bg-indigo-50 dark:bg-indigo-950', content: 'bg-indigo-50/30 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', buttonBg: 'bg-indigo-50 dark:bg-indigo-900', buttonBorder: 'border-indigo-300 dark:border-indigo-700', buttonText: 'text-indigo-700 dark:text-indigo-200' },
  'Grunge': { header: 'bg-stone-100 dark:bg-stone-900', content: 'bg-stone-100/30 dark:bg-stone-900/30', border: 'border-stone-300 dark:border-stone-700', text: 'text-stone-700 dark:text-stone-300', buttonBg: 'bg-stone-100 dark:bg-stone-800', buttonBorder: 'border-stone-400 dark:border-stone-600', buttonText: 'text-stone-700 dark:text-stone-200' },
  'New Wave': { header: 'bg-sky-50 dark:bg-sky-950', content: 'bg-sky-50/30 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-300', buttonBg: 'bg-sky-50 dark:bg-sky-900', buttonBorder: 'border-sky-300 dark:border-sky-700', buttonText: 'text-sky-700 dark:text-sky-200' },
  'Pop': { header: 'bg-pink-50 dark:bg-pink-950', content: 'bg-pink-50/30 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-700 dark:text-pink-300', buttonBg: 'bg-pink-50 dark:bg-pink-900', buttonBorder: 'border-pink-300 dark:border-pink-700', buttonText: 'text-pink-700 dark:text-pink-200' },
  'Jazz': { header: 'bg-purple-50 dark:bg-purple-950', content: 'bg-purple-50/30 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', buttonBg: 'bg-purple-50 dark:bg-purple-900', buttonBorder: 'border-purple-300 dark:border-purple-700', buttonText: 'text-purple-700 dark:text-purple-200' },
  'Electronic': { header: 'bg-cyan-50 dark:bg-cyan-950', content: 'bg-cyan-50/30 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', buttonBg: 'bg-cyan-50 dark:bg-cyan-900', buttonBorder: 'border-cyan-300 dark:border-cyan-700', buttonText: 'text-cyan-700 dark:text-cyan-200' },
  'Hip-Hop': { header: 'bg-orange-50 dark:bg-orange-950', content: 'bg-orange-50/30 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', buttonBg: 'bg-orange-50 dark:bg-orange-900', buttonBorder: 'border-orange-300 dark:border-orange-700', buttonText: 'text-orange-700 dark:text-orange-200' },
  'R&B/Soul': { header: 'bg-violet-50 dark:bg-violet-950', content: 'bg-violet-50/30 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', buttonBg: 'bg-violet-50 dark:bg-violet-900', buttonBorder: 'border-violet-300 dark:border-violet-700', buttonText: 'text-violet-700 dark:text-violet-200' },
  'Folk/Country': { header: 'bg-amber-50 dark:bg-amber-950', content: 'bg-amber-50/30 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', buttonBg: 'bg-amber-50 dark:bg-amber-900', buttonBorder: 'border-amber-300 dark:border-amber-700', buttonText: 'text-amber-700 dark:text-amber-200' },
  'Blues': { header: 'bg-blue-50 dark:bg-blue-950', content: 'bg-blue-50/30 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', buttonBg: 'bg-blue-50 dark:bg-blue-900', buttonBorder: 'border-blue-300 dark:border-blue-700', buttonText: 'text-blue-700 dark:text-blue-200' },
  'Classical': { header: 'bg-slate-50 dark:bg-slate-900', content: 'bg-slate-50/30 dark:bg-slate-900/30', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', buttonBg: 'bg-slate-50 dark:bg-slate-800', buttonBorder: 'border-slate-300 dark:border-slate-600', buttonText: 'text-slate-700 dark:text-slate-200' },
  'World': { header: 'bg-teal-50 dark:bg-teal-950', content: 'bg-teal-50/30 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', buttonBg: 'bg-teal-50 dark:bg-teal-900', buttonBorder: 'border-teal-300 dark:border-teal-700', buttonText: 'text-teal-700 dark:text-teal-200' },
  'Experimental': { header: 'bg-fuchsia-50 dark:bg-fuchsia-950', content: 'bg-fuchsia-50/30 dark:bg-fuchsia-950/30', border: 'border-fuchsia-200 dark:border-fuchsia-800', text: 'text-fuchsia-700 dark:text-fuchsia-300', buttonBg: 'bg-fuchsia-50 dark:bg-fuchsia-900', buttonBorder: 'border-fuchsia-300 dark:border-fuchsia-700', buttonText: 'text-fuchsia-700 dark:text-fuchsia-200' },
  'Other': { header: 'bg-gray-50 dark:bg-gray-800', content: 'bg-gray-50/30 dark:bg-gray-800/30', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300', buttonBg: 'bg-gray-50 dark:bg-gray-700', buttonBorder: 'border-gray-300 dark:border-gray-600', buttonText: 'text-gray-700 dark:text-gray-200' },
};

// Default color for unknown genres
export const DEFAULT_COLORS: GenreColorScheme = {
  header: 'bg-gray-50 dark:bg-gray-800',
  content: 'bg-gray-50/30 dark:bg-gray-800/30',
  border: 'border-gray-200 dark:border-gray-700',
  text: 'text-gray-700 dark:text-gray-300',
  buttonBg: 'bg-gray-50 dark:bg-gray-700',
  buttonBorder: 'border-gray-300 dark:border-gray-600',
  buttonText: 'text-gray-700 dark:text-gray-200',
};

// Additional colors for custom genres
export const EXTRA_COLORS: GenreColorScheme[] = [
  { header: 'bg-lime-50 dark:bg-lime-950', content: 'bg-lime-50/30 dark:bg-lime-950/30', border: 'border-lime-200 dark:border-lime-800', text: 'text-lime-700 dark:text-lime-300', buttonBg: 'bg-lime-50 dark:bg-lime-900', buttonBorder: 'border-lime-300 dark:border-lime-700', buttonText: 'text-lime-700 dark:text-lime-200' },
  { header: 'bg-emerald-50 dark:bg-emerald-950', content: 'bg-emerald-50/30 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', buttonBg: 'bg-emerald-50 dark:bg-emerald-900', buttonBorder: 'border-emerald-300 dark:border-emerald-700', buttonText: 'text-emerald-700 dark:text-emerald-200' },
  { header: 'bg-sky-50 dark:bg-sky-950', content: 'bg-sky-50/30 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-300', buttonBg: 'bg-sky-50 dark:bg-sky-900', buttonBorder: 'border-sky-300 dark:border-sky-700', buttonText: 'text-sky-700 dark:text-sky-200' },
  { header: 'bg-indigo-50 dark:bg-indigo-950', content: 'bg-indigo-50/30 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', buttonBg: 'bg-indigo-50 dark:bg-indigo-900', buttonBorder: 'border-indigo-300 dark:border-indigo-700', buttonText: 'text-indigo-700 dark:text-indigo-200' },
  { header: 'bg-rose-50 dark:bg-rose-950', content: 'bg-rose-50/30 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', buttonBg: 'bg-rose-50 dark:bg-rose-900', buttonBorder: 'border-rose-300 dark:border-rose-700', buttonText: 'text-rose-700 dark:text-rose-200' },
  { header: 'bg-yellow-50 dark:bg-yellow-950', content: 'bg-yellow-50/30 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300', buttonBg: 'bg-yellow-50 dark:bg-yellow-900', buttonBorder: 'border-yellow-300 dark:border-yellow-700', buttonText: 'text-yellow-700 dark:text-yellow-200' },
  { header: 'bg-green-50 dark:bg-green-950', content: 'bg-green-50/30 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', buttonBg: 'bg-green-50 dark:bg-green-900', buttonBorder: 'border-green-300 dark:border-green-700', buttonText: 'text-green-700 dark:text-green-200' },
  { header: 'bg-stone-100 dark:bg-stone-900', content: 'bg-stone-100/30 dark:bg-stone-900/30', border: 'border-stone-300 dark:border-stone-700', text: 'text-stone-700 dark:text-stone-300', buttonBg: 'bg-stone-100 dark:bg-stone-800', buttonBorder: 'border-stone-300 dark:border-stone-600', buttonText: 'text-stone-700 dark:text-stone-200' },
];

interface UseGenrePreferencesResult {
  genreOrder: string[];
  emptyGenres: string[];
  customGenreColors: Record<string, number>;
  saveGenreOrder: (order: string[]) => void;
  saveEmptyGenres: (genres: string[]) => void;
  saveCustomGenreColors: (colors: Record<string, number>) => void;
  getGenreColors: (genre: string) => GenreColorScheme;
  getRandomColorIndex: () => number;
  addGenre: (genreName: string, existingGenres: Set<string>) => void;
  deleteEmptyGenre: (genreName: string) => void;
}

/**
 * Hook to manage genre preferences (order, empty genres, custom colors)
 */
export function useGenrePreferences(): UseGenrePreferencesResult {
  // Initialize state directly from localStorage (lazy initializers run once on mount)
  const [genreOrder, setGenreOrder] = useState<string[]>(
    () => getStorageItem<string[]>(STORAGE_KEYS.GENRE_ORDER, []) ?? []
  );
  const [emptyGenres, setEmptyGenres] = useState<string[]>(
    () => getStorageItem<string[]>(STORAGE_KEYS.EMPTY_GENRES, []) ?? []
  );
  const [customGenreColors, setCustomGenreColors] = useState<Record<string, number>>(
    () => getStorageItem<Record<string, number>>(STORAGE_KEYS.CUSTOM_GENRE_COLORS, {}) ?? {}
  );

  const saveGenreOrder = useCallback((order: string[]) => {
    setGenreOrder(order);
    setStorageItem(STORAGE_KEYS.GENRE_ORDER, order);
  }, []);

  const saveEmptyGenres = useCallback((genres: string[]) => {
    setEmptyGenres(genres);
    setStorageItem(STORAGE_KEYS.EMPTY_GENRES, genres);
  }, []);

  const saveCustomGenreColors = useCallback((colors: Record<string, number>) => {
    setCustomGenreColors(colors);
    setStorageItem(STORAGE_KEYS.CUSTOM_GENRE_COLORS, colors);
  }, []);

  const getGenreColors = useCallback((genre: string): GenreColorScheme => {
    if (GENRE_COLORS[genre]) {
      return GENRE_COLORS[genre];
    }
    if (customGenreColors[genre] !== undefined) {
      return EXTRA_COLORS[customGenreColors[genre]] || DEFAULT_COLORS;
    }
    return DEFAULT_COLORS;
  }, [customGenreColors]);

  const getRandomColorIndex = useCallback(() => {
    const usedIndices = new Set(Object.values(customGenreColors));
    const availableIndices = EXTRA_COLORS.map((_, i) => i).filter(i => !usedIndices.has(i));
    if (availableIndices.length === 0) {
      return Math.floor(Math.random() * EXTRA_COLORS.length);
    }
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }, [customGenreColors]);

  const addGenre = useCallback((genreName: string, existingGenres: Set<string>) => {
    const trimmedName = genreName.trim();
    if (!trimmedName || existingGenres.has(trimmedName)) return;

    const newEmptyGenres = [...emptyGenres, trimmedName];
    saveEmptyGenres(newEmptyGenres);

    if (!genreOrder.includes(trimmedName)) {
      const newOrder = [...genreOrder, trimmedName];
      saveGenreOrder(newOrder);
    }

    if (!GENRE_COLORS[trimmedName]) {
      const colorIndex = getRandomColorIndex();
      const newColors = { ...customGenreColors, [trimmedName]: colorIndex };
      saveCustomGenreColors(newColors);
    }
  }, [emptyGenres, genreOrder, customGenreColors, saveEmptyGenres, saveGenreOrder, saveCustomGenreColors, getRandomColorIndex]);

  const deleteEmptyGenre = useCallback((genreName: string) => {
    const newEmptyGenres = emptyGenres.filter(g => g !== genreName);
    saveEmptyGenres(newEmptyGenres);

    const newOrder = genreOrder.filter(g => g !== genreName);
    saveGenreOrder(newOrder);

    if (customGenreColors[genreName] !== undefined) {
      const newColors = { ...customGenreColors };
      delete newColors[genreName];
      saveCustomGenreColors(newColors);
    }
  }, [emptyGenres, genreOrder, customGenreColors, saveEmptyGenres, saveGenreOrder, saveCustomGenreColors]);

  return {
    genreOrder,
    emptyGenres,
    customGenreColors,
    saveGenreOrder,
    saveEmptyGenres,
    saveCustomGenreColors,
    getGenreColors,
    getRandomColorIndex,
    addGenre,
    deleteEmptyGenre,
  };
}
