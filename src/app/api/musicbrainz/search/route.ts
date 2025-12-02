/**
 * MusicBrainz Artist Search API Route
 *
 * GET /api/musicbrainz/search?q=artist_name&limit=10&offset=0
 *
 * Uses local PostgreSQL database when available, falls back to MusicBrainz API.
 * Returns source indicator for UI display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchArtists } from '@/lib/musicbrainz/data-source';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required and must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const result = await searchArtists(query, limit, offset);

    return NextResponse.json({
      artists: result.data,
      source: result.source,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[API] Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search artists' },
      { status: 500 }
    );
  }
}
