# Smart Apple Music - Music Discovery & Artist Relationship Mapping

## Quick Reference

```bash
# Development
pnpm dev          # Start dev server at http://localhost:3000
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
```

## Project Overview

A music discovery application that visualizes artist relationships through interactive graphs. Built with Next.js 16, Cytoscape.js for graph visualization, and MusicBrainz/Setlist.fm APIs for data.

**Key Features (Implemented):**
- Artist search with MusicBrainz disambiguation
- Interactive artist relationship graph with multiple layouts (Force/COSE, Hierarchical/Dagre, Concentric, Spoke)
- Band members and collaborations visualization
- Favorites system (localStorage-based)
- Recent shows from Setlist.fm API
- Tour date links to Songkick

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Artist Search | ✅ DONE | MusicBrainz with rate limiting |
| Relationship Graph | ✅ DONE | Cytoscape.js with 4 layout options |
| Favorites System | ✅ DONE | localStorage, displayed on home |
| Recent Shows | ✅ DONE | Setlist.fm API (past shows only) |
| Upcoming Shows | ⏳ PENDING | Waiting for SeatGeek API approval |
| Apple Music Integration | FUTURE | Requires $99/year investment |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Artist Search     │  │   Interactive Graph Visualizer  │   │
│  │   + Favorites       │  │   (Cytoscape.js)                │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   Recent Shows      │  │   Artist Detail Sidebar         │   │
│  │   (Setlist.fm)      │  │   (Members, Shows, Links)       │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   /api/concerts (Setlist.fm proxy - avoids CORS)        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────┐
│     MusicBrainz       │               │     Setlist.fm        │
│  (artist relations)   │               │   (past concerts)     │
│   1 req/sec limit     │               │    via API route      │
└───────────────────────┘               └───────────────────────┘
```

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20+ |
| Package Manager | pnpm | 8+ |
| Framework | Next.js | 16.0.6 |
| React | React | 19.2.0 |
| Graph Visualization | Cytoscape.js | 3.33+ |
| Graph Layouts | cytoscape-cola, cytoscape-dagre, cytoscape-fcose | Latest |
| UI Components | shadcn/ui + Tailwind CSS v4 | Latest |
| State Management | TanStack Query + Zustand | 5.x / 5.x |
| Testing | Vitest + Testing Library | Latest |

## External APIs

| API | Purpose | Auth | Notes |
|-----|---------|------|-------|
| MusicBrainz | Artist relationships | User-Agent header | **1 req/sec limit** - implemented with queue |
| Setlist.fm | Past concerts | API key in `.env.local` | Server-side proxy to avoid CORS |
| Songkick | Upcoming tour dates | None (search links only) | No API - links to search pages |
| SeatGeek | Upcoming concerts | Pending approval | Will replace Songkick links |

## Key Implementation Details

### MusicBrainz Rate Limiting
The client at `src/lib/musicbrainz/client.ts` implements request queuing with 1.1 second delays. **Never bypass this** - MusicBrainz will block all requests if exceeded.

### Setlist.fm CORS Workaround
Setlist.fm doesn't allow browser requests. All calls go through `/api/concerts` route which proxies to the API server-side. The API key is in `.env.local`.

### Graph Layouts
Four layout options in `src/components/graph/artist-graph.tsx`:
- **Force (COSE)**: Physics-based with node repulsion
- **Hierarchical (Dagre)**: Tree structure
- **Concentric**: Rings around center
- **Spoke**: Direct radial connections

### Favorites System
Stored in localStorage. The `FavoritesUpcomingShows` component on the home page fetches recent shows for all favorited artists in parallel.

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/concerts/route.ts     # Setlist.fm proxy API
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page (search + favorites)
│   └── globals.css               # Global styles
├── components/
│   ├── graph/
│   │   ├── artist-graph.tsx      # Main Cytoscape graph component
│   │   ├── graph-controls.tsx    # Layout/zoom controls
│   │   └── index.tsx             # Graph exports
│   ├── ui/                       # shadcn/ui components
│   ├── artist-detail.tsx         # Artist sidebar with members/shows
│   ├── artist-search.tsx         # Search + favorites list
│   ├── favorites-upcoming-shows.tsx  # Home page shows component
│   ├── providers.tsx             # React Query provider
│   └── upcoming-concerts.tsx     # Concert list for single artist
├── lib/
│   ├── cache/index.ts            # localStorage cache with TTL
│   ├── concerts/
│   │   ├── client.ts             # Setlist.fm API client
│   │   ├── hooks.ts              # useArtistConcerts, useMultipleArtistsConcerts
│   │   └── index.ts              # Exports
│   ├── musicbrainz/
│   │   ├── client.ts             # MusicBrainz API with rate limiting
│   │   ├── hooks.ts              # useArtistSearch, useArtistRelationships
│   │   └── index.ts              # Exports
│   └── utils.ts                  # cn() utility
├── types/
│   ├── index.ts                  # Core types (ArtistNode, ArtistRelationship, etc.)
│   └── cytoscape-*.d.ts          # Type declarations for Cytoscape plugins
└── test/
    └── setup.ts                  # Vitest setup
```

## Key Types

```typescript
// src/types/index.ts
interface ArtistNode {
  id: string;           // MusicBrainz MBID
  name: string;
  type: 'person' | 'group';
  loaded?: boolean;     // Has connections been fetched?
}

interface ArtistRelationship {
  id: string;
  source: string;       // Artist MBID
  target: string;       // Artist MBID
  type: 'member_of' | 'founder_of' | 'collaboration' | ...;
}

interface Concert {
  id: string;
  date: Date;
  venue: string;
  city: string;
  ticketUrl: string | null;  // Setlist.fm URL
}
```

## Environment Variables

```env
# .env.local (required)
SETLIST_FM_API_KEY=your_api_key_here
```

## Coding Conventions

- **'use client'** directive on all components using hooks or browser APIs
- **TypeScript strict mode** - no `any`, explicit types
- **shadcn/ui** for UI components in `src/components/ui/`
- **TanStack Query** for server state (caching, loading, refetching)
- **localStorage** for favorites and cached data (with TTL via `src/lib/cache`)

## Known Limitations

1. **Setlist.fm only provides past shows** - No future concert dates. Songkick search links are a workaround until SeatGeek API is approved.

2. **MusicBrainz rate limit** - 1 request/second. The client queues requests automatically, but large graphs take time to load.

3. **No database** - All data is fetched fresh or cached in localStorage. No user accounts.

4. **Force layout is static** - COSE calculates positions once; no real-time physics when dragging nodes.

## Future Improvements

- [ ] SeatGeek API integration for upcoming concerts (waiting for approval)
- [ ] Real-time force layout with d3-force
- [ ] Apple Music integration ($99/year developer program)
- [ ] PostgreSQL for persistent favorites/user data
- use Playwright when needed