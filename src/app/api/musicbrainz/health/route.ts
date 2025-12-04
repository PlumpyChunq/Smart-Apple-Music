/**
 * MusicBrainz Data Source Health Check API Route
 *
 * GET /api/musicbrainz/health
 *   Returns the current health status of data sources
 *
 * POST /api/musicbrainz/health
 *   Forces a fresh health check (resets cache and re-tests connection)
 *   Used by the "retry" button in the UI
 *
 * Returns:
 * - Local PostgreSQL database availability
 * - API availability (always true, with rate limits)
 */

import { NextResponse } from 'next/server';
import { getHealthStatus, resetDbAvailabilityCache } from '@/lib/musicbrainz/data-source';

async function buildHealthResponse() {
  const health = await getHealthStatus();

  return {
    status: health.localDb.available ? 'healthy' : 'degraded',
    isLocal: health.localDb.available,
    sources: {
      localDb: {
        available: health.localDb.available,
        lastChecked: new Date(health.localDb.lastChecked).toISOString(),
      },
      api: {
        available: health.api.available,
        rateLimited: true, // MusicBrainz API is always rate-limited
      },
    },
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const response = await buildHealthResponse();
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        isLocal: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Force a fresh health check
 * Resets the DB availability cache and re-tests connection
 */
export async function POST() {
  try {
    // Reset the cache to force a fresh connection test
    resetDbAvailabilityCache();

    // Now get fresh health status
    const response = await buildHealthResponse();

    console.log(`[API] Forced health check: ${response.isLocal ? 'Local DB available' : 'Using fallback API'}`);

    return NextResponse.json({
      ...response,
      action: 'recovery_check',
      recovered: response.isLocal,
    });
  } catch (error) {
    console.error('[API] Forced health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        isLocal: false,
        action: 'recovery_check',
        recovered: false,
        error: 'Recovery check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
