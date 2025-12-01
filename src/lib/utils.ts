import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract year from a date string (YYYY or YYYY-MM-DD format).
 * Returns null if the string is null, undefined, or invalid.
 */
export function parseYear(dateString: string | null | undefined): number | null {
  if (!dateString || dateString.length < 4) return null;
  const year = parseInt(dateString.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}
