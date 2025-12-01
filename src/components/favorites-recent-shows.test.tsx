import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { FavoritesRecentShows } from './favorites-recent-shows';
import { renderWithClient } from '@/test/test-utils';
import * as hooks from '@/lib/concerts/hooks';

// Mock the hooks module
vi.mock('@/lib/concerts/hooks', () => ({
  useMultipleArtistsConcerts: vi.fn(),
  RECENT_THRESHOLD_MS: 90 * 24 * 60 * 60 * 1000,
}));

const mockUseMultipleArtistsConcerts = vi.mocked(hooks.useMultipleArtistsConcerts);

// Helper to create mock concert with artist
function createMockConcertWithArtist(overrides = {}) {
  return {
    id: 'test-id',
    date: new Date('2024-06-15'),
    formattedDate: 'Sat, Jun 15, 2024',
    venue: 'Test Venue',
    city: 'Test City',
    region: 'TC',
    country: 'Test Country',
    title: 'Test Concert',
    ticketUrl: 'https://example.com/setlist',
    lineup: ['Artist 1'],
    artistName: 'Test Artist',
    ...overrides,
  };
}

describe('FavoritesRecentShows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no artist names provided', () => {
    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: [],
      isLoading: false,
      loadingCount: 0,
      totalArtists: 0,
    });

    const { container } = renderWithClient(<FavoritesRecentShows artistNames={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows loading progress indicator', () => {
    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: [],
      isLoading: true,
      loadingCount: 2,
      totalArtists: 5,
    });

    renderWithClient(<FavoritesRecentShows artistNames={['Artist 1', 'Artist 2']} />);

    expect(screen.getByText('Loading (3/5)...')).toBeInTheDocument();
  });

  it('displays concerts from multiple artists', () => {
    const mockConcerts = [
      createMockConcertWithArtist({
        id: '1',
        venue: 'MSG',
        artistName: 'Radiohead'
      }),
      createMockConcertWithArtist({
        id: '2',
        venue: 'Red Rocks',
        artistName: 'Arcade Fire'
      }),
    ];

    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: mockConcerts,
      isLoading: false,
      loadingCount: 0,
      totalArtists: 2,
    });

    renderWithClient(<FavoritesRecentShows artistNames={['Radiohead', 'Arcade Fire']} />);

    expect(screen.getByText('Recent Shows from Favorites')).toBeInTheDocument();
    expect(screen.getByText('MSG')).toBeInTheDocument();
    expect(screen.getByText('Red Rocks')).toBeInTheDocument();
    expect(screen.getByText('Radiohead')).toBeInTheDocument();
    expect(screen.getByText('Arcade Fire')).toBeInTheDocument();
  });

  it('shows "in last 90 days" badge with correct count', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const mockConcerts = [
      createMockConcertWithArtist({ id: '1', date: thirtyDaysAgo }),
      createMockConcertWithArtist({ id: '2', date: thirtyDaysAgo }),
    ];

    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: mockConcerts,
      isLoading: false,
      loadingCount: 0,
      totalArtists: 1,
    });

    renderWithClient(<FavoritesRecentShows artistNames={['Test Artist']} />);

    // The component calculates its own recentCount
    expect(screen.getByText('2 in last 90 days')).toBeInTheDocument();
  });

  it('shows empty state when no concerts found', () => {
    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: [],
      isLoading: false,
      loadingCount: 0,
      totalArtists: 2,
    });

    renderWithClient(<FavoritesRecentShows artistNames={['Artist 1', 'Artist 2']} />);

    expect(screen.getByText('No recent shows from your favorites')).toBeInTheDocument();
  });

  it('shows tour dates links for favorite artists', () => {
    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: [createMockConcertWithArtist()],
      isLoading: false,
      loadingCount: 0,
      totalArtists: 2,
    });

    renderWithClient(<FavoritesRecentShows artistNames={['Radiohead', 'Arcade Fire']} />);

    const radioheadLink = screen.getByText('Radiohead tour dates →');
    expect(radioheadLink).toHaveAttribute(
      'href',
      expect.stringContaining('songkick.com/search?query=Radiohead')
    );

    const arcadeFireLink = screen.getByText('Arcade Fire tour dates →');
    expect(arcadeFireLink).toHaveAttribute(
      'href',
      expect.stringContaining('songkick.com/search?query=Arcade%20Fire')
    );
  });

  it('limits displayed artists links to 5', () => {
    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: [],
      isLoading: false,
      loadingCount: 0,
      totalArtists: 7,
    });

    const manyArtists = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    renderWithClient(<FavoritesRecentShows artistNames={manyArtists} />);

    // Should show "+2 more" for the remaining artists
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('limits displayed concerts to maxDisplay', () => {
    const manyConcerts = Array.from({ length: 12 }, (_, i) =>
      createMockConcertWithArtist({ id: String(i), venue: `Venue ${i}` })
    );

    mockUseMultipleArtistsConcerts.mockReturnValue({
      concerts: manyConcerts,
      isLoading: false,
      loadingCount: 0,
      totalArtists: 1,
    });

    renderWithClient(<FavoritesRecentShows artistNames={['Test']} maxDisplay={5} />);

    // Should show first 5 venues
    expect(screen.getByText('Venue 0')).toBeInTheDocument();
    expect(screen.getByText('Venue 4')).toBeInTheDocument();
    // Should not show venue 5+
    expect(screen.queryByText('Venue 5')).not.toBeInTheDocument();
    // Should show "+7 more shows"
    expect(screen.getByText('+7 more shows')).toBeInTheDocument();
  });
});
