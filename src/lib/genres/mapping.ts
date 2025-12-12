/**
 * Genre Mapping Utilities
 *
 * Maps MusicBrainz tags to broader genre categories for grouping favorites
 * and displaying genre information.
 *
 * Used by both API client (client.ts) and database client (db-client.ts)
 * to ensure consistent genre categorization.
 */

/**
 * Genre categories with their associated MusicBrainz tags.
 * More specific categories are listed first to catch them before broader ones.
 * Order matters for matching - punk/hardcore before generic rock, etc.
 */
export const GENRE_CATEGORIES: Record<string, string[]> = {
  // More specific genres first (order matters for matching)
  'Punk/Hardcore': [
    'punk', 'hardcore', 'post-hardcore', 'hardcore punk', 'punk rock', 'emo',
    'screamo', 'melodic hardcore', 'straight edge', 'crust punk', 'anarcho-punk',
    'pop punk', 'skate punk', 'oi!', 'street punk', 'd-beat',
  ],
  'Metal': [
    'metal', 'heavy metal', 'thrash metal', 'death metal', 'black metal',
    'doom metal', 'power metal', 'progressive metal', 'metalcore', 'nu metal',
    'sludge metal', 'stoner metal', 'grindcore', 'deathcore', 'symphonic metal',
    'groove metal',
  ],
  'Indie/Alternative': [
    'indie', 'indie rock', 'alternative', 'alternative rock', 'post-punk',
    'shoegaze', 'lo-fi', 'math rock', 'noise rock', 'post-rock', 'dream pop',
    'slowcore', 'sadcore', 'jangle pop', 'college rock', 'c86', 'indie pop',
    'indie folk', 'noise pop',
  ],
  'Rock': [
    'rock', 'hard rock', 'progressive rock', 'classic rock', 'psychedelic rock',
    'art rock', 'glam rock', 'soft rock', 'garage rock', 'southern rock',
    'blues rock', 'roots rock', 'heartland rock', 'stoner rock',
  ],
  'Grunge': ['grunge', 'seattle sound'],
  'New Wave': [
    'new wave', 'synthpop', 'post-punk revival', 'dark wave', 'coldwave',
    'minimal wave', 'no wave',
  ],
  'Jazz': [
    'jazz', 'bebop', 'swing', 'fusion', 'smooth jazz', 'free jazz',
    'jazz fusion', 'big band', 'cool jazz', 'avant-garde jazz', 'modal jazz',
    'jazz funk', 'acid jazz', 'latin jazz',
  ],
  'Electronic': [
    'electronic', 'house', 'techno', 'ambient', 'edm', 'trance',
    'drum and bass', 'dubstep', 'idm', 'electro', 'synthwave', 'downtempo',
    'trip hop', 'breakbeat', 'uk garage', 'jungle',
  ],
  'Classical': [
    'classical', 'orchestra', 'orchestral', 'chamber', 'chamber music',
    'symphony', 'opera', 'baroque', 'romantic', 'contemporary classical',
    'minimalist', 'neo-classical', 'choral',
  ],
  'Hip-Hop': [
    'hip hop', 'rap', 'hip-hop', 'trap', 'gangsta rap', 'conscious hip hop',
    'alternative hip hop', 'east coast hip hop', 'west coast hip hop',
    'southern hip hop', 'boom bap', 'underground hip hop',
  ],
  'R&B/Soul': [
    'r&b', 'soul', 'funk', 'motown', 'rhythm and blues', 'neo-soul',
    'contemporary r&b', 'gospel', 'disco', 'quiet storm', 'new jack swing',
  ],
  'Folk/Country': [
    'folk', 'country', 'bluegrass', 'americana', 'singer-songwriter',
    'folk rock', 'country rock', 'alt-country', 'traditional folk', 'acoustic',
    'outlaw country', 'honky tonk', 'progressive country', 'western swing',
    'country pop', 'contemporary folk', 'indie folk', 'freak folk', 'anti-folk',
  ],
  'Pop': [
    'pop', 'synth-pop', 'dance-pop', 'electropop', 'art pop', 'pop rock',
    'teen pop', 'power pop', 'baroque pop', 'chamber pop', 'sunshine pop',
    'k-pop', 'j-pop', 'europop', 'bubblegum pop',
  ],
  'World': [
    'world', 'latin', 'reggae', 'afrobeat', 'bossa nova', 'salsa', 'ska',
    'dub', 'world music', 'african', 'celtic', 'flamenco', 'brazilian',
    'cumbia', 'tropicalia', 'highlife',
  ],
  'Blues': [
    'blues', 'delta blues', 'chicago blues', 'electric blues', 'country blues',
    'texas blues', 'jump blues',
  ],
  'Experimental': [
    'experimental', 'avant-garde', 'noise', 'industrial', 'krautrock',
    'musique concrète', 'drone', 'dark ambient', 'power electronics',
  ],
};

/**
 * All genre category names, in recommended display order.
 * Matches DEFAULT_GENRE_ORDER in hooks.ts for consistency.
 */
export const GENRE_CATEGORY_NAMES = Object.keys(GENRE_CATEGORIES);

/**
 * Tag input format from MusicBrainz
 */
export interface GenreTag {
  name: string;
  count: number;
}

/**
 * Map MusicBrainz tags to genre categories.
 * Returns top matching categories sorted by tag relevance (weighted by count).
 *
 * @param tags - Array of tags from MusicBrainz with name and count
 * @param maxCategories - Maximum number of categories to return (default: 3)
 * @returns Array of genre category names, or undefined if no matches
 */
export function mapTagsToGenres(
  tags: GenreTag[] | undefined,
  maxCategories: number = 3
): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;

  // Score each category based on matching tags
  const categoryScores: Record<string, number> = {};

  // Sort tags by count (most relevant first)
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  for (const tag of sortedTags) {
    const tagLower = tag.name.toLowerCase();

    for (const [category, categoryTags] of Object.entries(GENRE_CATEGORIES)) {
      if (categoryTags.some(ct => tagLower.includes(ct) || ct.includes(tagLower))) {
        // Weight by tag count
        categoryScores[category] = (categoryScores[category] || 0) + tag.count;
      }
    }
  }

  // Return top categories sorted by score
  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxCategories)
    .map(([category]) => category);

  return sortedCategories.length > 0 ? sortedCategories : undefined;
}

/**
 * Get the primary genre for an artist (first genre in their list).
 * Falls back to 'Other' if no genres are assigned.
 */
export function getPrimaryGenre(genres: string[] | undefined): string {
  return genres?.[0] ?? 'Other';
}
