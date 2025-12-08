/**
 * MusicBrainz Solr Search Client
 *
 * Direct access to Solr for fast autocomplete and search operations.
 * Solr is optimized for text search and provides much faster results
 * than PostgreSQL ILIKE queries for autocomplete use cases.
 *
 * Schema fields (MusicBrainz artist collection):
 * - name: Artist name
 * - sortname: Sort name
 * - type: person/group/orchestra/choir/character/other
 * - area: Country/area name
 * - mbid: MusicBrainz ID (UUID)
 * - begin: Start year
 * - end: End year (if ended)
 */

import type { ArtistNode } from '@/types';

// Solr configuration
const SOLR_URL = process.env.SOLR_URL || 'http://localhost:8983/solr';
const SOLR_TIMEOUT_MS = 3000;

interface SolrArtistDoc {
  mbid: string;
  name: string;
  sortname?: string;
  type?: string;
  area?: string;
  begin?: string;
  end?: string;
  ended?: boolean;
  comment?: string;
}

interface SolrResponse {
  response: {
    numFound: number;
    start: number;
    docs: SolrArtistDoc[];
  };
}

/**
 * Map Solr document to ArtistNode
 */
function mapSolrDocToNode(doc: SolrArtistDoc): ArtistNode {
  return {
    id: doc.mbid,
    name: doc.name,
    type: doc.type === 'Person' ? 'person' : 'group',
    disambiguation: doc.comment || undefined,
    country: doc.area || undefined,
    activeYears: doc.begin
      ? {
          begin: doc.begin,
          end: doc.ended ? doc.end : null,
        }
      : undefined,
    loaded: false,
  };
}

/**
 * Escape special Solr query characters
 */
function escapeSolrQuery(query: string): string {
  // Escape special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
  return query.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');
}

/**
 * Search artists using Solr for autocomplete
 *
 * Uses prefix matching on the name field for fast autocomplete.
 * Falls back to phrase matching for multi-word queries.
 *
 * @param query - Search query (partial artist name)
 * @param limit - Maximum results to return (default: 10)
 * @returns Array of matching artists
 */
export async function autocompleteArtists(
  query: string,
  limit: number = 10
): Promise<ArtistNode[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const escapedQuery = escapeSolrQuery(query);

  // Build Solr query:
  // 1. Exact name match (boosted heavily)
  // 2. Name starts with query (prefix match)
  // 3. Name contains query words
  const solrQuery = [
    `name:"${escapedQuery}"^100`,       // Exact match, highest boost
    `name:${escapedQuery}*^50`,          // Prefix match
    `name:*${escapedQuery}*^10`,         // Contains match
    `sortname:${escapedQuery}*^5`,       // Sort name prefix
  ].join(' OR ');

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    fl: 'mbid,name,sortname,type,area,begin,end,ended,comment',
    // Sort by score (relevance) then alphabetically
    sort: 'score desc,name asc',
  });

  const url = `${SOLR_URL}/artist/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse = await response.json();
    return data.response.docs.map(mapSolrDocToNode);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Solr] Autocomplete request timed out');
    } else {
      console.error('[Solr] Autocomplete error:', error);
    }
    throw error;
  }
}

/**
 * Full-text search artists using Solr
 *
 * More comprehensive search than autocomplete, includes fuzzy matching.
 *
 * @param query - Search query
 * @param limit - Maximum results (default: 25)
 * @param offset - Pagination offset (default: 0)
 * @returns Array of matching artists
 */
export async function searchArtistsSolr(
  query: string,
  limit: number = 25,
  offset: number = 0
): Promise<{ artists: ArtistNode[]; total: number }> {
  if (!query || query.length < 2) {
    return { artists: [], total: 0 };
  }

  const escapedQuery = escapeSolrQuery(query);

  // Full search with fuzzy matching
  const solrQuery = [
    `name:"${escapedQuery}"^100`,       // Exact match
    `name:${escapedQuery}*^50`,          // Prefix match
    `name:${escapedQuery}~^20`,          // Fuzzy match
    `name:*${escapedQuery}*^10`,         // Contains
    `sortname:${escapedQuery}*^5`,       // Sort name
  ].join(' OR ');

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    start: String(offset),
    fl: 'mbid,name,sortname,type,area,begin,end,ended,comment',
    sort: 'score desc,name asc',
  });

  const url = `${SOLR_URL}/artist/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse = await response.json();
    return {
      artists: data.response.docs.map(mapSolrDocToNode),
      total: data.response.numFound,
    };
  } catch (error) {
    console.error('[Solr] Search error:', error);
    throw error;
  }
}

/**
 * Test Solr connectivity
 */
export async function testSolrConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${SOLR_URL}/artist/admin/ping?wt=json`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
