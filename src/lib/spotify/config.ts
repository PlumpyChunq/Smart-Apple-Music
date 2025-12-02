// Spotify OAuth configuration

export const SPOTIFY_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
  redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/api/spotify/callback',
  authEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
  apiBaseUrl: 'https://api.spotify.com/v1',
  scopes: [
    'user-top-read',      // Access top artists and tracks
    'user-follow-read',   // Access followed artists
    'user-library-read',  // Access saved tracks and albums
  ],
} as const;

// Storage keys for localStorage
export const SPOTIFY_STORAGE_KEYS = {
  token: 'spotify_token_data',
  codeVerifier: 'spotify_code_verifier',
  state: 'spotify_auth_state',
} as const;

// API rate limiting - Spotify has generous limits but we'll be conservative
export const SPOTIFY_RATE_LIMIT = {
  requestsPerSecond: 10,
  maxRetries: 3,
  retryDelayMs: 1000,
} as const;
