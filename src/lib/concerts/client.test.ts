import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getArtistEvents,
  isUpcoming,
  groupConcertsByMonth,
  RECENT_THRESHOLD_MS,
  type Concert,
} from './client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('concerts client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getArtistEvents', () => {
    it('should return concerts for a valid artist', async () => {
      const mockEvents = [
        {
          id: '123',
          datetime: '2024-06-15T20:00:00',
          title: 'Summer Tour',
          venue: {
            name: 'Madison Square Garden',
            city: 'New York',
            region: 'NY',
            country: 'United States',
          },
          url: 'https://setlist.fm/setlist/123',
          lineup: ['Artist 1', 'Artist 2'],
          offers: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const concerts = await getArtistEvents('Test Artist');

      expect(mockFetch).toHaveBeenCalledWith('/api/concerts?artist=Test%20Artist');
      expect(concerts).toHaveLength(1);
      expect(concerts[0]).toMatchObject({
        id: '123',
        venue: 'Madison Square Garden',
        city: 'New York',
        region: 'NY',
        country: 'United States',
        ticketUrl: 'https://setlist.fm/setlist/123',
      });
    });

    it('should return empty array for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const concerts = await getArtistEvents('Unknown Artist');

      expect(concerts).toEqual([]);
    });

    it('should return empty array when API returns non-array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'No events found' }),
      });

      const concerts = await getArtistEvents('Artist With No Shows');

      expect(concerts).toEqual([]);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const concerts = await getArtistEvents('Test Artist');

      expect(concerts).toEqual([]);
    });

    it('should URL encode artist names with special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await getArtistEvents('AC/DC');

      expect(mockFetch).toHaveBeenCalledWith('/api/concerts?artist=AC%2FDC');
    });

    it('should use event URL as ticket URL', async () => {
      const mockEvents = [
        {
          id: '456',
          datetime: '2024-07-01T19:00:00',
          title: 'Concert',
          venue: {
            name: 'The Forum',
            city: 'Los Angeles',
            region: 'CA',
            country: 'United States',
          },
          url: 'https://setlist.fm/setlist/456',
          lineup: [],
          offers: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const concerts = await getArtistEvents('Test Artist');

      expect(concerts[0].ticketUrl).toBe('https://setlist.fm/setlist/456');
    });

    it('should handle null URL gracefully', async () => {
      const mockEvents = [
        {
          id: '789',
          datetime: '2024-07-01T19:00:00',
          title: 'Concert',
          venue: {
            name: 'The Forum',
            city: 'Los Angeles',
            region: 'CA',
            country: 'United States',
          },
          url: null,
          lineup: [],
          offers: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const concerts = await getArtistEvents('Test Artist');

      expect(concerts[0].ticketUrl).toBeNull();
    });
  });

  describe('isUpcoming', () => {
    it('should return true for concerts within 30 days', () => {
      const concert: Concert = {
        id: '1',
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        formattedDate: 'Mon, Jan 15, 2024',
        venue: 'Test Venue',
        city: 'Test City',
        region: 'TC',
        country: 'Test Country',
        title: 'Test Concert',
        ticketUrl: null,
        lineup: [],
      };

      expect(isUpcoming(concert)).toBe(true);
    });

    it('should return false for concerts more than 30 days away', () => {
      const concert: Concert = {
        id: '2',
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        formattedDate: 'Fri, Feb 15, 2024',
        venue: 'Test Venue',
        city: 'Test City',
        region: 'TC',
        country: 'Test Country',
        title: 'Test Concert',
        ticketUrl: null,
        lineup: [],
      };

      expect(isUpcoming(concert)).toBe(false);
    });

    it('should return false for past concerts', () => {
      const concert: Concert = {
        id: '3',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        formattedDate: 'Mon, Dec 25, 2023',
        venue: 'Test Venue',
        city: 'Test City',
        region: 'TC',
        country: 'Test Country',
        title: 'Test Concert',
        ticketUrl: null,
        lineup: [],
      };

      expect(isUpcoming(concert)).toBe(false);
    });
  });

  describe('groupConcertsByMonth', () => {
    it('should group concerts by month', () => {
      const concerts: Concert[] = [
        {
          id: '1',
          date: new Date('2024-06-15'),
          formattedDate: 'Sat, Jun 15, 2024',
          venue: 'Venue A',
          city: 'City A',
          region: 'RA',
          country: 'Country A',
          title: 'Concert 1',
          ticketUrl: null,
          lineup: [],
        },
        {
          id: '2',
          date: new Date('2024-06-20'),
          formattedDate: 'Thu, Jun 20, 2024',
          venue: 'Venue B',
          city: 'City B',
          region: 'RB',
          country: 'Country B',
          title: 'Concert 2',
          ticketUrl: null,
          lineup: [],
        },
        {
          id: '3',
          date: new Date('2024-07-05'),
          formattedDate: 'Fri, Jul 5, 2024',
          venue: 'Venue C',
          city: 'City C',
          region: 'RC',
          country: 'Country C',
          title: 'Concert 3',
          ticketUrl: null,
          lineup: [],
        },
      ];

      const grouped = groupConcertsByMonth(concerts);

      expect(grouped.size).toBe(2);
      expect(grouped.get('June 2024')).toHaveLength(2);
      expect(grouped.get('July 2024')).toHaveLength(1);
    });

    it('should return empty map for empty input', () => {
      const grouped = groupConcertsByMonth([]);

      expect(grouped.size).toBe(0);
    });
  });

  describe('RECENT_THRESHOLD_MS', () => {
    it('should equal 90 days in milliseconds', () => {
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      expect(RECENT_THRESHOLD_MS).toBe(ninetyDaysMs);
    });
  });
});
