// MusicKit JS type declarations

export interface MusicKitInstance {
  authorize(): Promise<string | undefined>;
  unauthorize(): Promise<void>;
  isAuthorized: boolean;
  api: {
    // MusicKit v3: query params are passed directly as the second argument
    music<T = unknown>(
      path: string,
      queryParameters?: Record<string, string | number | string[]>
    ): Promise<{ data: T }>;
  };
}

export interface MusicKitConfig {
  developerToken: string;
  app: {
    name: string;
    build: string;
  };
}

// Apple Music API response types
export interface AppleMusicArtist {
  id: string;
  type: 'artists' | 'library-artists';
  href: string;
  attributes: {
    name: string;
    genreNames?: string[];
    url?: string;
    artwork?: AppleMusicArtwork;
  };
  relationships?: {
    albums?: {
      data: AppleMusicAlbum[];
    };
  };
}

export interface AppleMusicAlbum {
  id: string;
  type: 'albums' | 'library-albums';
  href: string;
  attributes: {
    name: string;
    artistName: string;
    artwork?: AppleMusicArtwork;
    releaseDate?: string;
    trackCount?: number;
    genreNames?: string[];
    dateAdded?: string;
  };
}

export interface AppleMusicArtwork {
  width: number;
  height: number;
  url: string; // Contains {w} and {h} placeholders
}

export interface LibraryArtistsResponse {
  data: AppleMusicArtist[];
  next?: string;
  meta?: {
    total?: number;
  };
}

export interface LibraryAlbumsResponse {
  data: AppleMusicAlbum[];
  next?: string;
}

export interface CatalogSearchResponse {
  results: {
    artists?: {
      data: AppleMusicArtist[];
    };
  };
}

// Helper to format artwork URL
export function formatArtworkUrl(
  artwork: AppleMusicArtwork | undefined,
  size: number = 300
): string | undefined {
  if (!artwork?.url) return undefined;
  return artwork.url.replace('{w}', String(size)).replace('{h}', String(size));
}

// Declare global MusicKit
declare global {
  interface Window {
    MusicKit?: {
      getInstance(): MusicKitInstance;
      configure(config: MusicKitConfig): Promise<MusicKitInstance>;
    };
  }
}
