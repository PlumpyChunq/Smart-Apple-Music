// Spotify integration - public exports

export { SPOTIFY_CONFIG, SPOTIFY_STORAGE_KEYS } from './config';

export {
  buildAuthUrl,
  exchangeCodeForToken,
  getAccessToken,
  isAuthenticated,
  disconnectSpotify,
  refreshAccessToken,
} from './auth';

export {
  getTopArtists,
  getFollowedArtists,
  getArtistsFromSavedTracks,
  getArtistsFromSavedAlbums,
  getAllUserArtists,
  getPrimaryArtists,
  getCuratedTopArtists,
} from './client';

export {
  useSpotifyAuth,
  useSpotifyCallback,
  useSpotifyArtists,
  useSpotifyPrimaryArtists,
  useSpotifyImport,
  spotifyKeys,
} from './hooks';

export type {
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifySavedTrack,
  SpotifySavedAlbum,
  SpotifyTokenData,
  SpotifyImportedArtist,
} from './types';
