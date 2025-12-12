'use client';

import { useEffect, useRef } from 'react';
import type { TimelineEvent, TimelineEventType } from '@/types';
import { getAlbumStreamingUrl, getPreferredService, getUseNativeApp } from '@/lib/streaming';

interface TimelineEventPopupProps {
  event: TimelineEvent;
  position: { x: number; y: number };
  onClose: () => void;
}

const EVENT_LABELS: Record<TimelineEventType, string> = {
  album: 'Album Release',
  concert: 'Concert',
  birth: 'Born',
  formation: 'Formation',
  disbanded: 'Disbanded',
  member_join: 'Member Joined',
  member_leave: 'Member Left',
  member_death: 'Passed Away',
};

const EVENT_COLORS: Record<TimelineEventType, string> = {
  album: 'text-purple-600',
  concert: 'text-blue-600',
  birth: 'text-pink-600',
  formation: 'text-green-600',
  disbanded: 'text-red-600',
  member_join: 'text-emerald-600',
  member_leave: 'text-orange-600',
  member_death: 'text-gray-600',
};

export function TimelineEventPopup({ event, position, onClose }: TimelineEventPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Close on escape key
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Format date for display
  const formattedDate = event.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Position the popup above the clicked element
  const style = {
    left: `${position.x}px`,
    bottom: `calc(100vh - ${position.y}px + 8px)`,
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 transform -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={style}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 min-w-[280px] max-w-[350px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium uppercase tracking-wide ${EVENT_COLORS[event.type]}`}>
              {EVENT_LABELS[event.type]}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {event.title}
          </h3>

          {event.subtitle && (
            <p className="text-sm text-gray-600 mt-1">{event.subtitle}</p>
          )}

          <p className="text-xs text-gray-500 mt-2">{formattedDate}</p>

          {event.artistName && (
            <p className="text-xs text-gray-400 mt-1">
              Artist: {event.artistName}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
          {/* Streaming service button for albums */}
          {event.type === 'album' && event.artistName && (() => {
            const useNative = getUseNativeApp();
            const service = getPreferredService();
            return (
              <a
                href={getAlbumStreamingUrl(event.artistName, event.title)}
                // Only use target="_blank" for web URLs, not for native app URLs (music://, spotify://)
                {...(!useNative ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex-1 text-center px-3 py-2 text-xs font-medium text-white rounded transition-colors flex items-center justify-center gap-2"
                style={{ background: service.id === 'spotify'
                  ? 'linear-gradient(180deg, #1DB954 0%, #1aa34a 100%)'
                  : 'linear-gradient(180deg, #fc3c44 0%, #e91e63 100%)' }}
              >
                {service.id === 'spotify' ? (
                  <SpotifyIcon className="w-4 h-4" />
                ) : (
                  <AppleMusicIcon className="w-4 h-4" />
                )}
                Open in {service.name}{useNative ? ' App' : ''}
              </a>
            );
          })()}
          <div className="flex gap-2">
            {event.externalUrl && (
              <a
                href={event.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                MusicBrainz
                <ExternalLinkIcon className="w-3 h-3 inline-block ml-1" />
              </a>
            )}
            {event.relatedArtistIds && event.relatedArtistIds.length > 0 && (
              <button
                onClick={() => {
                  // This will be handled by the parent component
                }}
                className="flex-1 text-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                Highlight in Graph
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function AppleMusicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.401-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.56-2.075-1.465-.283-.882.078-1.906.92-2.35a2.916 2.916 0 011.234-.378c.428-.036.856-.067 1.283-.123.258-.035.392-.173.42-.434.006-.06.007-.12.007-.18V9.433c0-.146-.025-.196-.175-.222a55.42 55.42 0 00-.858-.135c-.752-.116-1.505-.227-2.257-.345-.695-.11-1.39-.225-2.085-.332-.098-.015-.15.017-.177.11-.004.013-.007.025-.007.038v6.96c0 .45-.044.894-.215 1.313-.278.68-.762 1.132-1.468 1.32-.378.1-.763.145-1.155.148-.853.003-1.627-.47-1.957-1.27-.362-.876-.055-1.94.79-2.467.39-.243.822-.352 1.275-.396.464-.046.93-.076 1.393-.13.265-.032.393-.164.424-.43.007-.06.006-.12.006-.18V6.793c0-.198.03-.303.227-.344l5.828-1.153c.61-.12 1.222-.235 1.833-.355.27-.053.343.03.343.3v4.873z" />
    </svg>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
