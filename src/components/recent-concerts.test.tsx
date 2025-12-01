import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { RecentConcerts } from './recent-concerts';
import { renderWithClient } from '@/test/test-utils';
import * as hooks from '@/lib/concerts/hooks';

// Mock the hooks module
vi.mock('@/lib/concerts/hooks', () => ({
  useArtistConcerts: vi.fn(),
  RECENT_THRESHOLD_MS: 90 * 24 * 60 * 60 * 1000,
}));

const mockUseArtistConcerts = vi.mocked(hooks.useArtistConcerts);

// Helper to create mock concert
function createMockConcert(overrides = {}) {
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
    ...overrides,
  };
}

describe('RecentConcerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when isLoading is true', () => {
    mockUseArtistConcerts.mockReturnValue({
      concerts: [],
      isLoading: true,
      error: null,
      recentCount: 0,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" />);

    expect(screen.getByText('Recent Shows')).toBeInTheDocument();
    // Check for skeleton animation class
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows empty state when no concerts', () => {
    mockUseArtistConcerts.mockReturnValue({
      concerts: [],
      isLoading: false,
      error: null,
      recentCount: 0,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" />);

    expect(screen.getByText('No recent shows found')).toBeInTheDocument();
  });

  it('renders concert list correctly', () => {
    const mockConcerts = [
      createMockConcert({ id: '1', venue: 'Madison Square Garden', city: 'New York', region: 'NY' }),
      createMockConcert({ id: '2', venue: 'The Forum', city: 'Los Angeles', region: 'CA' }),
    ];

    mockUseArtistConcerts.mockReturnValue({
      concerts: mockConcerts,
      isLoading: false,
      error: null,
      recentCount: 2,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" />);

    expect(screen.getByText('Madison Square Garden')).toBeInTheDocument();
    expect(screen.getByText('The Forum')).toBeInTheDocument();
    // Cities and regions are rendered in separate text nodes, check they exist
    expect(screen.getByText(/New York/)).toBeInTheDocument();
    expect(screen.getByText(/Los Angeles/)).toBeInTheDocument();
  });

  it('shows recent count badge when there are recent shows', () => {
    mockUseArtistConcerts.mockReturnValue({
      concerts: [createMockConcert()],
      isLoading: false,
      error: null,
      recentCount: 3,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" />);

    expect(screen.getByText('3 in last 90 days')).toBeInTheDocument();
  });

  it('does not show badge when recentCount is 0', () => {
    mockUseArtistConcerts.mockReturnValue({
      concerts: [createMockConcert()],
      isLoading: false,
      error: null,
      recentCount: 0,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" />);

    expect(screen.queryByText(/in last 90 days/)).not.toBeInTheDocument();
  });

  it('returns null on error', () => {
    mockUseArtistConcerts.mockReturnValue({
      concerts: [],
      isLoading: false,
      error: 'API Error',
      recentCount: 0,
    });

    const { container } = renderWithClient(<RecentConcerts artistName="Test Artist" />);

    expect(container.firstChild).toBeNull();
  });

  it('limits displayed concerts to maxDisplay', () => {
    const manyConcerts = Array.from({ length: 10 }, (_, i) =>
      createMockConcert({ id: String(i), venue: `Venue ${i}` })
    );

    mockUseArtistConcerts.mockReturnValue({
      concerts: manyConcerts,
      isLoading: false,
      error: null,
      recentCount: 10,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" maxDisplay={3} />);

    // Should show first 3 venues
    expect(screen.getByText('Venue 0')).toBeInTheDocument();
    expect(screen.getByText('Venue 1')).toBeInTheDocument();
    expect(screen.getByText('Venue 2')).toBeInTheDocument();
    // Should not show the rest
    expect(screen.queryByText('Venue 3')).not.toBeInTheDocument();
    // Should show "+7 more shows"
    expect(screen.getByText('+7 more shows')).toBeInTheDocument();
  });

  it('includes setlist link for concerts with ticketUrl', () => {
    mockUseArtistConcerts.mockReturnValue({
      concerts: [createMockConcert({ ticketUrl: 'https://setlist.fm/setlist/123' })],
      isLoading: false,
      error: null,
      recentCount: 1,
    });

    renderWithClient(<RecentConcerts artistName="Test Artist" />);

    const setlistLink = screen.getByText('Setlist');
    expect(setlistLink).toHaveAttribute('href', 'https://setlist.fm/setlist/123');
    expect(setlistLink).toHaveAttribute('target', '_blank');
  });
});
