/**
 * Tests for MusicBrainz API client
 *
 * Critical: These tests verify the API client works correctly.
 * MusicBrainz will ban IPs that exceed 1 request/second - the rate limiter
 * is critical infrastructure that protects against this.
 *
 * Note: Rate limiting timing tests are challenging due to module-level state.
 * These tests focus on response handling, error cases, and request format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocking
import { searchArtists } from './client';

describe('MusicBrainz client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(async () => {
    // Run all pending timers to clean up the queue
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  describe('searchArtists - response parsing', () => {
    it('should parse artist results correctly', async () => {
      const mockResponse = {
        artists: [
          {
            id: 'test-mbid-1',
            name: 'Test Artist',
            type: 'Person',
            disambiguation: 'rock musician',
            country: 'US',
            'life-span': {
              begin: '1990',
              end: null,
              ended: false,
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const resultPromise = searchArtists('Test Artist', 10);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'test-mbid-1',
        name: 'Test Artist',
        type: 'person', // Should be lowercase
        disambiguation: 'rock musician',
        country: 'US',
      });
    });

    it('should handle Group type correctly', async () => {
      const mockResponse = {
        artists: [
          {
            id: 'band-mbid',
            name: 'Test Band',
            type: 'Group',
            country: 'UK',
            'life-span': {
              begin: '1985',
              end: '2000',
              ended: true,
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const resultPromise = searchArtists('Test Band', 10);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result[0].type).toBe('group');
      expect(result[0].activeYears).toEqual({
        begin: '1985',
        end: '2000',
      });
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ artists: [] }),
      });

      const resultPromise = searchArtists('Nonexistent Artist', 10);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toHaveLength(0);
    });

    it('should handle missing optional fields', async () => {
      const mockResponse = {
        artists: [
          {
            id: 'minimal-mbid',
            name: 'Minimal Artist',
            // No type, country, life-span, or disambiguation
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const resultPromise = searchArtists('Minimal', 10);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result[0]).toMatchObject({
        id: 'minimal-mbid',
        name: 'Minimal Artist',
      });
    });
  });

  describe('searchArtists - request format', () => {
    it('should include User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ artists: [] }),
      });

      const resultPromise = searchArtists('Test', 10);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('InterChord'),
          }),
        })
      );
    });

    it('should request JSON format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ artists: [] }),
      });

      const resultPromise = searchArtists('Test', 10);
      await vi.runAllTimersAsync();
      await resultPromise;

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('fmt=json');
    });

    it('should use MusicBrainz artist search endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ artists: [] }),
      });

      const resultPromise = searchArtists('Test', 10);
      await vi.runAllTimersAsync();
      await resultPromise;

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('musicbrainz.org/ws/2/artist');
    });

    it('should include limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ artists: [] }),
      });

      const resultPromise = searchArtists('Test', 5);
      await vi.runAllTimersAsync();
      await resultPromise;

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=5');
    });
  });

  describe('searchArtists - error handling', () => {
    it('should throw specific error on 503 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const resultPromise = searchArtists('Test', 10);
      // Set up rejection handler BEFORE running timers to avoid unhandled rejection
      const expectation = expect(resultPromise).rejects.toThrow('MusicBrainz rate limit exceeded');
      await vi.runAllTimersAsync();
      await expectation;
    });

    it('should throw generic error on other HTTP failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const resultPromise = searchArtists('Test', 10);
      // Set up rejection handler BEFORE running timers to avoid unhandled rejection
      const expectation = expect(resultPromise).rejects.toThrow('MusicBrainz API error: 500');
      await vi.runAllTimersAsync();
      await expectation;
    });

    it('should throw on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const resultPromise = searchArtists('Test', 10);
      // Set up rejection handler BEFORE running timers to avoid unhandled rejection
      const expectation = expect(resultPromise).rejects.toThrow('MusicBrainz API error: 404');
      await vi.runAllTimersAsync();
      await expectation;
    });
  });

  describe('rate limiting - basic verification', () => {
    it('should queue requests and process them', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ artists: [] }),
        })
      );

      // Fire 3 requests simultaneously
      const p1 = searchArtists('first', 5);
      const p2 = searchArtists('second', 5);
      const p3 = searchArtists('third', 5);

      // Process all requests (rate limiter will space them out)
      await vi.runAllTimersAsync();

      // All three should resolve
      await expect(p1).resolves.toEqual([]);
      await expect(p2).resolves.toEqual([]);
      await expect(p3).resolves.toEqual([]);

      // All three requests should have been made
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should continue queue after a request fails', async () => {
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second request fails
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ artists: [] }),
        });
      });

      const p1 = searchArtists('first', 5);
      const p2 = searchArtists('second', 5); // Will fail
      const p3 = searchArtists('third', 5);

      // Set up rejection handler BEFORE running timers to avoid unhandled rejection
      const p2Expectation = expect(p2).rejects.toThrow();

      await vi.runAllTimersAsync();

      // First and third should succeed
      await expect(p1).resolves.toEqual([]);
      await p2Expectation;
      await expect(p3).resolves.toEqual([]);

      // All three requests should have been attempted
      expect(callCount).toBe(3);
    });
  });
});
