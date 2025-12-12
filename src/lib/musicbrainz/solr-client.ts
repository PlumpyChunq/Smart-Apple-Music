/**
 * MusicBrainz Solr Search Client
 *
 * Direct access to Solr for fast autocomplete and search operations.
 * Solr is optimized for text search and provides much faster results
 * than PostgreSQL ILIKE queries for autocomplete use cases.
 *
 * Supported collections:
 * - artist: 2.7M artists (persons, groups, orchestras)
 * - recording: 35M recordings (songs, tracks)
 * - release: 3M+ releases (albums, EPs, singles)
 * - release-group: Album groupings (reissues grouped together)
 * - work: 1.5M+ compositions (songs as written works)
 * - label: Record labels
 * - place: Venues, studios, cities
 * - area: Countries, regions, cities
 * - event: Concerts, festivals
 */

import type {
  ArtistNode,
  RecordingNode,
  ReleaseNode,
  ReleaseGroupNode,
  WorkNode,
  LabelNode,
  PlaceNode,
  AreaNode,
  EventNode,
  SearchEntityType,
} from '@/types';

// Solr configuration
const SOLR_URL = process.env.SOLR_URL || 'http://localhost:8983/solr';
const SOLR_TIMEOUT_MS = 3000;

// ============================================================================
// XML Parsing Helpers
// ============================================================================

/**
 * Extract a simple text value from XML using regex
 * Handles both ns0: prefixed tags and unprefixed tags
 */
function extractXmlValue(xml: string, tagName: string): string | undefined {
  // Try with namespace prefix first
  const nsMatch = xml.match(new RegExp(`<ns0:${tagName}>([^<]*)</ns0:${tagName}>`));
  if (nsMatch) return nsMatch[1];

  // Try without namespace
  const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`));
  return match ? match[1] : undefined;
}

/**
 * Parse the _store XML field for releases
 */
function parseReleaseXml(xml: string, mbid: string): ReleaseNode {
  const title = extractXmlValue(xml, 'title') || '';

  // Get artist name from artist-credit > name-credit > name
  const artistCreditMatch = xml.match(/<ns0:artist-credit[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const artistCredit = artistCreditMatch ? artistCreditMatch[1] : undefined;

  // Get artist MBID from artist element
  const artistIdMatch = xml.match(/<ns0:artist id="([^"]+)"/);
  const artistId = artistIdMatch ? artistIdMatch[1] : undefined;

  // Get release type from release-group
  const typeMatch = xml.match(/<ns0:release-group[^>]*type="([^"]+)"/);
  const type = typeMatch ? typeMatch[1] : undefined;

  const date = extractXmlValue(xml, 'date');
  const country = extractXmlValue(xml, 'country');
  const barcode = extractXmlValue(xml, 'barcode');
  const comment = extractXmlValue(xml, 'comment');

  // Get label name
  const labelMatch = xml.match(/<ns0:label[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const labelName = labelMatch ? labelMatch[1] : undefined;

  return {
    id: mbid,
    name: title,
    artistCredit,
    artistId,
    type,
    date,
    country,
    labelName,
    barcode,
    disambiguation: comment,
  };
}

/**
 * Parse the _store XML field for recordings
 */
function parseRecordingXml(xml: string, mbid: string): RecordingNode {
  const title = extractXmlValue(xml, 'title') || '';

  // Get artist name from artist-credit
  const artistCreditMatch = xml.match(/<ns0:artist-credit[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const artistCredit = artistCreditMatch ? artistCreditMatch[1] : undefined;

  // Get artist MBID
  const artistIdMatch = xml.match(/<ns0:artist id="([^"]+)"/);
  const artistId = artistIdMatch ? artistIdMatch[1] : undefined;

  // Get duration (in ms)
  const lengthStr = extractXmlValue(xml, 'length');
  const duration = lengthStr ? parseInt(lengthStr, 10) : undefined;

  const comment = extractXmlValue(xml, 'comment');

  // Get release title from first release in list
  const releaseMatch = xml.match(/<ns0:release-list[^>]*>[\s\S]*?<ns0:title>([^<]*)<\/ns0:title>/);
  const releaseTitle = releaseMatch ? releaseMatch[1] : undefined;

  // Get release MBID
  const releaseIdMatch = xml.match(/<ns0:release id="([^"]+)"/);
  const releaseId = releaseIdMatch ? releaseIdMatch[1] : undefined;

  // Get ISRC
  const isrcMatch = xml.match(/<ns0:isrc id="([^"]+)"/);
  const isrc = isrcMatch ? isrcMatch[1] : undefined;

  return {
    id: mbid,
    name: title,
    artistCredit,
    artistId,
    duration,
    disambiguation: comment,
    releaseTitle,
    releaseId,
    isrc,
  };
}

/**
 * Parse the _store XML field for release groups
 */
function parseReleaseGroupXml(xml: string, mbid: string): ReleaseGroupNode {
  const title = extractXmlValue(xml, 'title') || '';

  const artistCreditMatch = xml.match(/<ns0:artist-credit[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const artistCredit = artistCreditMatch ? artistCreditMatch[1] : undefined;

  const artistIdMatch = xml.match(/<ns0:artist id="([^"]+)"/);
  const artistId = artistIdMatch ? artistIdMatch[1] : undefined;

  const type = extractXmlValue(xml, 'primary-type');
  const firstReleaseDate = extractXmlValue(xml, 'first-release-date');
  const comment = extractXmlValue(xml, 'comment');

  return {
    id: mbid,
    name: title,
    artistCredit,
    artistId,
    type,
    firstReleaseDate,
    disambiguation: comment,
  };
}

/**
 * Parse the _store XML field for works
 */
function parseWorkXml(xml: string, mbid: string): WorkNode {
  const title = extractXmlValue(xml, 'title') || '';
  const type = extractXmlValue(xml, 'type');
  const comment = extractXmlValue(xml, 'comment');

  // Get ISWC from iswc-list
  const iswcMatch = xml.match(/<ns0:iswc>([^<]*)<\/ns0:iswc>/);
  const iswc = iswcMatch ? iswcMatch[1] : undefined;

  // Get writer/composer from relation
  const artistMatch = xml.match(/<ns0:artist id="([^"]+)"[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const artistId = artistMatch ? artistMatch[1] : undefined;
  const artistCredit = artistMatch ? artistMatch[2] : undefined;

  return {
    id: mbid,
    name: title,
    type,
    iswc,
    disambiguation: comment,
    artistCredit,
    artistId,
  };
}

/**
 * Parse the _store XML field for labels
 */
function parseLabelXml(xml: string, mbid: string): LabelNode {
  const name = extractXmlValue(xml, 'name') || '';
  const type = extractXmlValue(xml, 'type');
  const country = extractXmlValue(xml, 'country');
  const comment = extractXmlValue(xml, 'comment');

  // Get founded year from life-span begin
  const beginMatch = xml.match(/<ns0:life-span>[\s\S]*?<ns0:begin>([^<]*)<\/ns0:begin>/);
  const foundedYear = beginMatch ? beginMatch[1] : undefined;

  return {
    id: mbid,
    name,
    type,
    country,
    foundedYear,
    disambiguation: comment,
  };
}

/**
 * Parse the _store XML field for places
 */
function parsePlaceXml(xml: string, mbid: string): PlaceNode {
  const name = extractXmlValue(xml, 'name') || '';
  const type = extractXmlValue(xml, 'type');
  const address = extractXmlValue(xml, 'address');
  const comment = extractXmlValue(xml, 'comment');

  // Get area name
  const areaMatch = xml.match(/<ns0:area[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const area = areaMatch ? areaMatch[1] : undefined;

  return {
    id: mbid,
    name,
    type,
    address,
    area,
    disambiguation: comment,
  };
}

/**
 * Parse the _store XML field for areas
 */
function parseAreaXml(xml: string, mbid: string): AreaNode {
  const name = extractXmlValue(xml, 'name') || '';
  const type = extractXmlValue(xml, 'type');
  const comment = extractXmlValue(xml, 'comment');

  return {
    id: mbid,
    name,
    type,
    disambiguation: comment,
  };
}

/**
 * Parse the _store XML field for events
 */
function parseEventXml(xml: string, mbid: string): EventNode {
  const name = extractXmlValue(xml, 'name') || '';
  const type = extractXmlValue(xml, 'type');
  const comment = extractXmlValue(xml, 'comment');

  // Get date from life-span begin
  const dateMatch = xml.match(/<ns0:life-span>[\s\S]*?<ns0:begin>([^<]*)<\/ns0:begin>/);
  const date = dateMatch ? dateMatch[1] : undefined;

  // Get place name
  const placeMatch = xml.match(/<ns0:place[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const place = placeMatch ? placeMatch[1] : undefined;

  // Get area name
  const areaMatch = xml.match(/<ns0:area[^>]*>[\s\S]*?<ns0:name>([^<]*)<\/ns0:name>/);
  const area = areaMatch ? areaMatch[1] : undefined;

  return {
    id: mbid,
    name,
    type,
    date,
    place,
    area,
    disambiguation: comment,
  };
}

// ============================================================================
// Solr Document Interfaces (for entity types with stored fields)
// ============================================================================

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

// Non-artist entity types only return mbid and _store (XML blob)
// We parse the XML to extract the actual data
interface SolrXmlDoc {
  mbid: string;
  _store: string;              // XML blob containing all entity data
}

type SolrDoc = SolrArtistDoc | SolrXmlDoc;

interface SolrResponse<T = SolrDoc> {
  response: {
    numFound: number;
    start: number;
    docs: T[];
  };
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map Solr document to ArtistNode
 */
function mapSolrArtistDoc(doc: SolrArtistDoc): ArtistNode {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special Solr query characters
 */
function escapeSolrQuery(query: string): string {
  // Escape special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
  return query.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');
}

/**
 * Get the primary name field for each entity type
 */
function getNameField(entityType: SearchEntityType): string {
  switch (entityType) {
    case 'artist':
      return 'name';
    case 'recording':
      return 'recording';
    case 'release':
      return 'release';
    case 'release-group':
      return 'releasegroup';
    case 'work':
      return 'work';
    case 'label':
      return 'label';
    case 'place':
      return 'place';
    case 'area':
      return 'area';
    case 'event':
      return 'event';
    default:
      return 'name';
  }
}

/**
 * Get the Solr collection name for each entity type
 */
function getCollectionName(entityType: SearchEntityType): string {
  // Collection names match entity types
  return entityType;
}

/**
 * Get the fields to return for each entity type
 * Note: Only artist collection has stored fields, all others use _store XML blob
 */
function getReturnFields(entityType: SearchEntityType): string {
  if (entityType === 'artist') {
    // Artist collection has indexed stored fields
    return 'mbid,name,sortname,type,area,begin,end,ended,comment';
  }
  // All other collections store data as XML in _store field
  return 'mbid,_store';
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

    const data: SolrResponse<SolrArtistDoc> = await response.json();
    return data.response.docs.map(mapSolrArtistDoc);
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

    const data: SolrResponse<SolrArtistDoc> = await response.json();
    return {
      artists: data.response.docs.map(mapSolrArtistDoc),
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

// ============================================================================
// Generic Multi-Entity Search Functions
// ============================================================================

/**
 * Result type for generic entity search
 */
export type SearchResult<T extends SearchEntityType> = T extends 'artist'
  ? ArtistNode
  : T extends 'recording'
    ? RecordingNode
    : T extends 'release'
      ? ReleaseNode
      : T extends 'release-group'
        ? ReleaseGroupNode
        : T extends 'work'
          ? WorkNode
          : T extends 'label'
            ? LabelNode
            : T extends 'place'
              ? PlaceNode
              : T extends 'area'
                ? AreaNode
                : T extends 'event'
                  ? EventNode
                  : never;

/**
 * Map a Solr document to the appropriate node type
 * Artist collection has indexed stored fields, other collections use XML in _store
 */
function mapSolrDocToEntity<T extends SearchEntityType>(
  entityType: T,
  doc: SolrDoc
): SearchResult<T> {
  // Artist collection has stored fields, use direct mapping
  if (entityType === 'artist') {
    return mapSolrArtistDoc(doc as SolrArtistDoc) as SearchResult<T>;
  }

  // All other collections store data as XML in _store field
  const xmlDoc = doc as SolrXmlDoc;
  const xml = xmlDoc._store || '';
  const mbid = xmlDoc.mbid;

  switch (entityType) {
    case 'recording':
      return parseRecordingXml(xml, mbid) as SearchResult<T>;
    case 'release':
      return parseReleaseXml(xml, mbid) as SearchResult<T>;
    case 'release-group':
      return parseReleaseGroupXml(xml, mbid) as SearchResult<T>;
    case 'work':
      return parseWorkXml(xml, mbid) as SearchResult<T>;
    case 'label':
      return parseLabelXml(xml, mbid) as SearchResult<T>;
    case 'place':
      return parsePlaceXml(xml, mbid) as SearchResult<T>;
    case 'area':
      return parseAreaXml(xml, mbid) as SearchResult<T>;
    case 'event':
      return parseEventXml(xml, mbid) as SearchResult<T>;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Generic autocomplete search for any entity type
 *
 * @param entityType - The type of entity to search for
 * @param query - Search query (partial name)
 * @param limit - Maximum results to return (default: 10)
 * @returns Array of matching entities
 */
export async function autocompleteEntities<T extends SearchEntityType>(
  entityType: T,
  query: string,
  limit: number = 10
): Promise<SearchResult<T>[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const escapedQuery = escapeSolrQuery(query);
  const nameField = getNameField(entityType);
  const collection = getCollectionName(entityType);
  const fields = getReturnFields(entityType);

  // Build Solr query with boosted matching
  const solrQuery = [
    `${nameField}:"${escapedQuery}"^100`, // Exact match
    `${nameField}:${escapedQuery}*^50`, // Prefix match
    `${nameField}:*${escapedQuery}*^10`, // Contains match
  ].join(' OR ');

  // Note: Only artist collection has sortable name field
  // Other collections use text fields that can't be sorted directly
  // So we just sort by score (relevance) for non-artist searches
  const sortClause = entityType === 'artist' ? 'score desc,name asc' : 'score desc';

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    fl: fields,
    sort: sortClause,
  });

  const url = `${SOLR_URL}/${collection}/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse = await response.json();
    return data.response.docs.map((doc) => mapSolrDocToEntity(entityType, doc));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Solr] Autocomplete ${entityType} request timed out`);
    } else {
      console.error(`[Solr] Autocomplete ${entityType} error:`, error);
    }
    throw error;
  }
}

/**
 * Generic full-text search for any entity type
 *
 * @param entityType - The type of entity to search for
 * @param query - Search query
 * @param limit - Maximum results (default: 25)
 * @param offset - Pagination offset (default: 0)
 * @returns Array of matching entities and total count
 */
export async function searchEntities<T extends SearchEntityType>(
  entityType: T,
  query: string,
  limit: number = 25,
  offset: number = 0
): Promise<{ results: SearchResult<T>[]; total: number }> {
  if (!query || query.length < 2) {
    return { results: [], total: 0 };
  }

  const escapedQuery = escapeSolrQuery(query);
  const nameField = getNameField(entityType);
  const collection = getCollectionName(entityType);
  const fields = getReturnFields(entityType);

  // Full search with fuzzy matching
  const solrQuery = [
    `${nameField}:"${escapedQuery}"^100`, // Exact match
    `${nameField}:${escapedQuery}*^50`, // Prefix match
    `${nameField}:${escapedQuery}~^20`, // Fuzzy match
    `${nameField}:*${escapedQuery}*^10`, // Contains match
  ].join(' OR ');

  // Note: Only artist collection has sortable name field
  const sortClause = entityType === 'artist' ? 'score desc,name asc' : 'score desc';

  const params = new URLSearchParams({
    q: solrQuery,
    wt: 'json',
    rows: String(limit),
    start: String(offset),
    fl: fields,
    sort: sortClause,
  });

  const url = `${SOLR_URL}/${collection}/select?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLR_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Solr error: ${response.status} ${response.statusText}`);
    }

    const data: SolrResponse = await response.json();
    return {
      results: data.response.docs.map((doc) => mapSolrDocToEntity(entityType, doc)),
      total: data.response.numFound,
    };
  } catch (error) {
    console.error(`[Solr] Search ${entityType} error:`, error);
    throw error;
  }
}

// ============================================================================
// Convenience Functions for Each Entity Type
// ============================================================================

export const autocompleteRecordings = (query: string, limit?: number) =>
  autocompleteEntities('recording', query, limit);

export const autocompleteReleases = (query: string, limit?: number) =>
  autocompleteEntities('release', query, limit);

export const autocompleteReleaseGroups = (query: string, limit?: number) =>
  autocompleteEntities('release-group', query, limit);

export const autocompleteWorks = (query: string, limit?: number) =>
  autocompleteEntities('work', query, limit);

export const autocompleteLabels = (query: string, limit?: number) =>
  autocompleteEntities('label', query, limit);

export const autocompletePlaces = (query: string, limit?: number) =>
  autocompleteEntities('place', query, limit);

export const autocompleteAreas = (query: string, limit?: number) =>
  autocompleteEntities('area', query, limit);

export const autocompleteEvents = (query: string, limit?: number) =>
  autocompleteEntities('event', query, limit);
