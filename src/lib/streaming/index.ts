export {
  type StreamingService,
  type MusicService,
  type StreamingServiceInfo,
  STREAMING_SERVICES,
  getStreamingPreference,
  setStreamingPreference,
  getPreferredService,
  getAlbumStreamingUrl,
  getArtistStreamingUrl,
  getPrimaryMusicService,
  setPrimaryMusicService,
  getUseNativeApp,
  setUseNativeApp,
} from './preferences';

export { useStreamingPreference, useAlbumStreamingUrl } from './hooks';
