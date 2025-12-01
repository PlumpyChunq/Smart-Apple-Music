import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useArtistConcerts, useMultipleArtistsConcerts } from './hooks';
import { createWrapper } from '@/test/test-utils';
import * as client from './client';

// Mock the client module
vi.mock('./client', async () => {
  const actual = await vi.importActual('./client');
  return {
    ...actual,
    getArtistEvents: vi.fn(),
  };
});

const mockGetArtistEvents = vi.mocked(client.getArtistEvents);

// Helper to create mock concerts
function createMockConcert(overrides: Partial<client.Concert> = {}): client.Concert {
  return {
    id: 'test-id',
    date: new Date(),
    formattedDate: 'Mon, Jan 1, 2024',
    venue: 'Test Venue',
    city: 'Test City',
    region: 'TC',
    country: 'Test Country',
    title: 'Test Concert',
    ticketUrl: 'https://example.com/tickets',
    lineup: ['Artist 1'],
    ...overrides,
  };
}

describe('useArtistConcerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty concerts when artistName is null', () => {
    const { result } = renderHook(() => useArtistConcerts(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.concerts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.recentCount).toBe(0);
  });

  it('fetches concerts when artistName is provided', async () => {
    const mockConcerts = [
      createMockConcert({ id: '1', venue: 'Venue A' }),
      createMockConcert({ id: '2', venue: 'Venue B' }),
    ];
    mockGetArtistEvents.mockResolvedValue(mockConcerts);

    const { result } = renderHook(() => useArtistConcerts('Test Artist'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.concerts).toHaveLength(2);
    expect(result.current.error).toBeNull();
    expect(mockGetArtistEvents).toHaveBeenCalledWith('Test Artist');
  });

  it('calculates recentCount correctly for concerts in last 90 days', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneHundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

    const mockConcerts = [
      createMockConcert({ id: '1', date: thirtyDaysAgo }), // Within 90 days
      createMockConcert({ id: '2', date: oneHundredDaysAgo }), // Outside 90 days
    ];
    mockGetArtistEvents.mockResolvedValue(mockConcerts);

    const { result } = renderHook(() => useArtistConcerts('Test Artist'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recentCount).toBe(1); // Only the 30-day-ago concert
  });

  it('handles API errors gracefully', async () => {
    mockGetArtistEvents.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useArtistConcerts('Test Artist'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.concerts).toEqual([]);
    expect(result.current.error).toBe('API Error');
  });
});

describe('useMultipleArtistsConcerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty concerts when artistNames is empty', () => {
    const { result } = renderHook(() => useMultipleArtistsConcerts([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.concerts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingCount).toBe(0);
    expect(result.current.totalArtists).toBe(0);
  });

  it('fetches concerts for multiple artists in parallel', async () => {
    const artist1Concerts = [
      createMockConcert({ id: '1', venue: 'Venue A', date: new Date('2024-06-15') }),
    ];
    const artist2Concerts = [
      createMockConcert({ id: '2', venue: 'Venue B', date: new Date('2024-06-20') }),
    ];

    mockGetArtistEvents
      .mockResolvedValueOnce(artist1Concerts)
      .mockResolvedValueOnce(artist2Concerts);

    const { result } = renderHook(
      () => useMultipleArtistsConcerts(['Artist 1', 'Artist 2']),
      { wrapper: createWrapper() }
    );

    expect(result.current.totalArtists).toBe(2);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.concerts).toHaveLength(2);
    expect(result.current.loadingCount).toBe(0);
  });

  it('adds artistName to each concert', async () => {
    const mockConcerts = [createMockConcert({ id: '1' })];
    mockGetArtistEvents.mockResolvedValue(mockConcerts);

    const { result } = renderHook(
      () => useMultipleArtistsConcerts(['My Artist']),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.concerts[0].artistName).toBe('My Artist');
  });

  it('sorts concerts by date (most recent first)', async () => {
    const olderDate = new Date('2024-01-01');
    const newerDate = new Date('2024-06-01');

    mockGetArtistEvents
      .mockResolvedValueOnce([createMockConcert({ id: '1', date: olderDate })])
      .mockResolvedValueOnce([createMockConcert({ id: '2', date: newerDate })]);

    const { result } = renderHook(
      () => useMultipleArtistsConcerts(['Artist 1', 'Artist 2']),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Most recent should be first
    expect(result.current.concerts[0].date).toEqual(newerDate);
    expect(result.current.concerts[1].date).toEqual(olderDate);
  });

  it('tracks loading state correctly', async () => {
    // Make one request resolve immediately and one delayed
    mockGetArtistEvents
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

    const { result } = renderHook(
      () => useMultipleArtistsConcerts(['Artist 1', 'Artist 2']),
      { wrapper: createWrapper() }
    );

    // Initially both should be loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.loadingCount).toBe(0);
  });
});
