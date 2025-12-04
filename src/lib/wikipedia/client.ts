/**
 * Wikipedia API Client
 * Fetches short summaries/bios for artists from Wikipedia
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';

export interface WikipediaSummary {
  title: string;
  extract: string;
  description?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: { page: string };
    mobile: { page: string };
  };
}

/**
 * Fetch a summary from Wikipedia for a given title
 * Returns null if not found
 */
export async function getWikipediaSummary(title: string): Promise<WikipediaSummary | null> {
  try {
    // Clean up the title for Wikipedia URL format
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));

    const response = await fetch(`${WIKIPEDIA_API}/page/summary/${encodedTitle}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.warn(`Wikipedia API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Skip disambiguation pages
    if (data.type === 'disambiguation') {
      return null;
    }

    return {
      title: data.title,
      extract: data.extract || '',
      description: data.description,
      thumbnail: data.thumbnail,
      content_urls: data.content_urls,
    };
  } catch (error) {
    console.warn('Failed to fetch Wikipedia summary:', error);
    return null;
  }
}

/**
 * Check if a Wikipedia summary appears to be about music
 */
function isMusicRelated(summary: WikipediaSummary): boolean {
  const description = summary.description?.toLowerCase() || '';
  const extract = summary.extract?.toLowerCase() || '';

  const musicKeywords = [
    'musician', 'singer', 'band', 'artist', 'songwriter', 'rapper', 'composer',
    'album', 'song', 'record', 'music', 'guitar', 'vocal', 'rock', 'pop', 'hip hop',
    'jazz', 'blues', 'funk', 'soul', 'r&b', 'disco', 'electronic', 'producer'
  ];

  return musicKeywords.some(keyword =>
    description.includes(keyword) || extract.slice(0, 500).includes(keyword)
  );
}

/**
 * Search Wikipedia and get the best matching article summary
 * Prioritizes music-related results for artist searches
 */
export async function searchWikipedia(query: string): Promise<WikipediaSummary | null> {
  try {
    // For music app: try musician/band-specific pages FIRST
    // This prevents "Prince" from returning the royalty article

    // Try with "(musician)" suffix
    const musicianResult = await getWikipediaSummary(`${query} (musician)`);
    if (musicianResult) {
      return musicianResult;
    }

    // Try with "(band)" suffix
    const bandResult = await getWikipediaSummary(`${query} (band)`);
    if (bandResult) {
      return bandResult;
    }

    // Try with "(singer)" suffix
    const singerResult = await getWikipediaSummary(`${query} (singer)`);
    if (singerResult) {
      return singerResult;
    }

    // Fall back to exact match, but validate it's music-related
    const directResult = await getWikipediaSummary(query);
    if (directResult && isMusicRelated(directResult)) {
      return directResult;
    }

    // If direct result exists but isn't music-related, return null
    // This prevents showing "Prince (royalty)" for the musician
    if (directResult) {
      console.warn(`Wikipedia result for "${query}" doesn't appear music-related, skipping`);
      return null;
    }

    return null;
  } catch (error) {
    console.warn('Failed to search Wikipedia:', error);
    return null;
  }
}
