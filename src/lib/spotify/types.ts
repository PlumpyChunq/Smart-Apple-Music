// Spotify API response types

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  type: 'artist';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
  followers?: {
    total: number;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  type: 'album';
  album_type: 'album' | 'single' | 'compilation';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  images: SpotifyImage[];
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  total_tracks: number;
  artists: SpotifyArtist[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  type: 'track';
  uri: string;
  href: string;
  external_urls: {
    spotify: string;
  };
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  duration_ms: number;
  popularity: number;
  track_number: number;
}

export interface SpotifySavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifySavedAlbum {
  added_at: string;
  album: SpotifyAlbum;
}

export interface SpotifyPagingObject<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyFollowedArtistsResponse {
  artists: {
    href: string;
    items: SpotifyArtist[];
    limit: number;
    next: string | null;
    cursors: {
      after: string | null;
    };
    total: number;
  };
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyTokenData {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface SpotifyError {
  error: {
    status: number;
    message: string;
  };
}

// Imported artist data (normalized for favorites)
export interface SpotifyImportedArtist {
  spotifyId: string;
  name: string;
  imageUrl?: string;
  genres?: string[];
  source: 'top' | 'followed' | 'saved_track' | 'saved_album';
}
