/**
 * MusicBrainz Data Source Health Check API Route
 *
 * GET /api/musicbrainz/health
 *
 * Returns the health status of data sources:
 * - Local PostgreSQL database availability
 * - API availability (always true, with rate limits)
 *
 * Useful for monitoring and debugging data source issues.
 */

import { NextResponse } from 'next/server';
import { getHealthStatus } from '@/lib/musicbrainz/data-source';

export async function GET() {
  try {
    const health = await getHealthStatus();

    return NextResponse.json({
      status: health.localDb.available ? 'healthy' : 'degraded',
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
    });
  } catch (error) {
    console.error('[API] Health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
