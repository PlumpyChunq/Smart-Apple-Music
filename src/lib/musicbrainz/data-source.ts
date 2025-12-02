/**
 * MusicBrainz Unified Data Source with Fallback
 *
 * Provides a unified interface that:
 * 1. Tries local PostgreSQL database first (fast, no rate limit)
 * 2. Falls back to MusicBrainz API if DB unavailable (rate limited)
 * 3. Returns source indicator for UI display
 *
 * Cloud-friendly design:
 * - Configurable timeouts via environment variables
 * - Graceful degradation on failure
 * - Source tracking for observability
 */

import type { ArtistNode, ArtistRelationship } from '@/types';

// Import database client (server-only)
import {
  testConnection,
  searchArtistsFromDB,
  getArtistFromDB,
  getArtistRelationshipsFromDB,
  getArtistLifeSpanFromDB,
} from './db-client';

// Import API client (fallback)
import {
  searchArtists as searchArtistsFromAPI,
  getArtist as getArtistFromAPI,
  getArtistRelationships as getArtistRelationshipsFromAPI,
  getArtistLifeSpan as getArtistLifeSpanFromAPI,
} from './client';

// ============================================================================
// Types
// ============================================================================

export type DataSource = 'local' | 'api';

export interface DataSourceResult<T> {
  data: T;
  source: DataSource;
  latencyMs: number;
}

// ============================================================================
// Connection State
// ============================================================================

// Cache the DB availability status to avoid repeated connection tests
let dbAvailable: boolean | null = null;
let lastDbCheck = 0;
const DB_CHECK_INTERVAL_MS = 30000; // Re-check DB availability every 30s

/**
 * Check if the local database is available
 * Caches result for DB_CHECK_INTERVAL_MS to avoid connection storms
 */
async function isDbAvailable(): Promise<boolean> {
  const now = Date.now();

  // Use cached result if recent
  if (dbAvailable !== null && now - lastDbCheck < DB_CHECK_INTERVAL_MS) {
    return dbAvailable;
  }

  // Test connection
  dbAvailable = await testConnection();
  lastDbCheck = now;

  if (!dbAvailable) {
    console.warn('[DataSource] Local DB unavailable, will use API fallback');
  }

  return dbAvailable;
}

/**
 * Reset DB availability cache (useful for testing or manual refresh)
 */
export function resetDbAvailabilityCache(): void {
  dbAvailable = null;
  lastDbCheck = 0;
}

// ============================================================================
// Unified Data Access Functions
// ============================================================================

/**
 * Search for artists with automatic fallback
 */
export async function searchArtists(
  query: string,
  limit: number = 10,
  offset: number = 0
): Promise<DataSourceResult<ArtistNode[]>> {
  const startTime = Date.now();

  // Try local DB first
  if (await isDbAvailable()) {
    try {
      const data = await searchArtistsFromDB(query, limit, offset);
      return {
        data,
        source: 'local',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DataSource] DB search failed, falling back to API:', (error as Error).message);
      // Mark DB as unavailable and fall through to API
      dbAvailable = false;
    }
  }

  // Fallback to API
  const data = await searchArtistsFromAPI(query, limit, offset);
  return {
    data,
    source: 'api',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Get artist by MBID with automatic fallback
 */
export async function getArtist(mbid: string): Promise<DataSourceResult<ArtistNode | null>> {
  const startTime = Date.now();

  // Try local DB first
  if (await isDbAvailable()) {
    try {
      const data = await getArtistFromDB(mbid);
      return {
        data,
        source: 'local',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DataSource] DB getArtist failed, falling back to API:', (error as Error).message);
      dbAvailable = false;
    }
  }

  // Fallback to API
  const data = await getArtistFromAPI(mbid);
  return {
    data,
    source: 'api',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Get artist relationships with automatic fallback
 */
export async function getArtistRelationships(mbid: string): Promise<
  DataSourceResult<{
    artist: ArtistNode;
    relationships: ArtistRelationship[];
    relatedArtists: ArtistNode[];
  }>
> {
  const startTime = Date.now();

  // Try local DB first
  if (await isDbAvailable()) {
    try {
      const data = await getArtistRelationshipsFromDB(mbid);
      return {
        data,
        source: 'local',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DataSource] DB getArtistRelationships failed, falling back to API:', (error as Error).message);
      dbAvailable = false;
    }
  }

  // Fallback to API
  const data = await getArtistRelationshipsFromAPI(mbid);
  return {
    data,
    source: 'api',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Get artist life span with automatic fallback
 */
export async function getArtistLifeSpan(
  mbid: string
): Promise<DataSourceResult<{ begin?: string; end?: string | null } | undefined>> {
  const startTime = Date.now();

  // Try local DB first
  if (await isDbAvailable()) {
    try {
      const data = await getArtistLifeSpanFromDB(mbid);
      return {
        data,
        source: 'local',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DataSource] DB getArtistLifeSpan failed, falling back to API:', (error as Error).message);
      dbAvailable = false;
    }
  }

  // Fallback to API
  const data = await getArtistLifeSpanFromAPI(mbid);
  return {
    data,
    source: 'api',
    latencyMs: Date.now() - startTime,
  };
}

// ============================================================================
// Health Check (for API routes)
// ============================================================================

export interface HealthStatus {
  localDb: {
    available: boolean;
    lastChecked: number;
  };
  api: {
    available: boolean; // API is always available (with rate limits)
  };
}

/**
 * Get current data source health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const available = await isDbAvailable();

  return {
    localDb: {
      available,
      lastChecked: lastDbCheck,
    },
    api: {
      available: true, // MusicBrainz API is assumed always available
    },
  };
}
