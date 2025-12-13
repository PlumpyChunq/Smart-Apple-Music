# InterChord Web App Features

> **Last Updated:** 2025-12-13
>
> Comprehensive documentation of all InterChord web app features, organized by category.

---

## Table of Contents

1. [Core Features](#core-features)
2. [Graph Visualization](#graph-visualization)
3. [Data Sources & APIs](#data-sources--apis)
4. [User Features](#user-features)
5. [UI Components](#ui-components)
6. [Technical Architecture](#technical-architecture)

---

## Core Features

### Artist Search

| Feature | Implementation | Notes |
|---------|---------------|-------|
| **MusicBrainz Search** | Debounced search with 300ms delay | Prevents API rate limiting |
| **Solr Autocomplete** | `/api/musicbrainz/autocomplete` | Fast type-ahead results |
| **Disambiguation Display** | Shows artist type, country, dates | Helps distinguish "John Smith" variants |
| **Search History** | Recent searches in localStorage | Quick access to previous searches |

### Artist Detail View

- **Header Section**: Artist name, type badge (Person/Group), country flag, active years
- **Relationship Groups**: Members, collaborations, subgroups, tribute bands
- **Founding Member Badges**: `[F]` for founders, `[C]` for current members
- **Tenure Display**: "1960-1970" or "1985-present" format
- **Instrument Attribution**: Up to 3 instruments per member

### Recent Shows (Setlist.fm)

- Past concert history from Setlist.fm API
- Shows venue, city, country, and date
- Links to full setlist on Setlist.fm
- Songkick search links for upcoming tour dates

---

## Graph Visualization

### Layout Algorithms

| Layout | Algorithm | Best For |
|--------|-----------|----------|
| **Force (COSE)** | Compound Spring Embedder | Organic clustering, medium graphs |
| **Hierarchical (Dagre)** | Directed acyclic graph | Band lineages, clear parent-child |
| **Concentric** | Radial rings | Showing distance from root |
| **Spoke** | Custom radial | Fast layout for exploration |

### Node Types & Styling

| Node Type | Color | Size | Border |
|-----------|-------|------|--------|
| Root Artist | Blue | 80px | Cyan glow |
| Group/Band | Blue | 50px | Standard |
| Person | Green | 35px | Standard |
| Founding Member | Any | Any | Purple ring |
| Selected | Any | Any | Orange glow |

### Edge Types & Styling

| Relationship | Color | Style | Width |
|--------------|-------|-------|-------|
| member_of | Light Blue | Solid | 2px |
| founder_of | Purple | Solid | 3px |
| collaboration | Green | Dashed | 2px |
| subgroup | Orange | Dashed | 2px |
| vocal_support | Pink | Dotted | 1px |
| instrumental_support | Teal | Dotted | 1px |

### Graph Interactions

- **Click Node**: Select and show details in sidebar
- **Double-Click Node**: Expand relationships (lazy loading)
- **Drag Node**: Reposition (position persists during session)
- **Mouse Wheel**: Zoom in/out
- **Drag Background**: Pan graph
- **Fit Button**: Auto-fit all nodes in viewport

### Filtering Options

- **Relationship Type Filter**: Show/hide by relationship category
- **Time Period Filter**: Filter members by active years
- **Depth Limit**: Control expansion depth from root

---

## Data Sources & APIs

### MusicBrainz Integration

| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `/ws/2/artist` | Artist lookup by MBID | 1 req/sec (public) |
| `/ws/2/artist?query=` | Artist search | 1 req/sec (public) |
| Artist with `inc=artist-rels` | Relationships | 1 req/sec (public) |

**Local Mirror (Production):** No rate limits via `stonefrog-db01:5000`

### Supplement API (Wikipedia Data)

The `/api/supplement` endpoint provides enriched data from Wikipedia:

```typescript
// Request
GET /api/supplement?mbid=<artist-mbid>&name=<artist-name>

// Response
{
  founding_members: [
    { mbid: string, name: string }
  ],
  genres: string[],
  description: string,
  image_url: string
}
```

**Data Sources:**
- Wikipedia infoboxes for founding members
- Wikidata for genre mappings
- Last.fm for artist images (fallback)

### Setlist.fm Integration

| Feature | Endpoint | Notes |
|---------|----------|-------|
| Recent Shows | `GET /1.0/artist/{mbid}/setlists` | Requires API key |
| Setlist Details | `GET /1.0/setlist/{setlistId}` | Full song list |

**Proxy Route:** `/api/concerts` handles CORS and API key injection.

### Spotify Integration

| Feature | OAuth Scope | Purpose |
|---------|-------------|---------|
| Top Artists | `user-top-read` | Import listening preferences |
| Followed Artists | `user-follow-read` | Import followed artists |

**Flow:**
1. User clicks "Connect Spotify"
2. OAuth redirect to Spotify
3. Callback stores access token
4. Import fetches and matches to MusicBrainz

### Image Sources (Priority Order)

1. **Fanart.tv** - High-quality artist images
2. **Last.fm** - Wide coverage
3. **Spotify** - Album art, artist photos
4. **MusicBrainz CAA** - Cover Art Archive

---

## User Features

### Favorites System

- **Storage**: localStorage (client-side)
- **Genre Grouping**: Automatic categorization
- **Quick Access**: Sidebar favorites list
- **Batch Operations**: Import from Spotify

### Import Options

| Source | Data Imported |
|--------|--------------|
| Spotify Top Artists | Top 50 artists (short/medium/long term) |
| Spotify Followed | All followed artists |
| Manual Entry | Search and add individually |

### Session Features

- **Search History**: Last 20 searches
- **Graph State**: Node positions, expanded nodes
- **View Preferences**: Layout choice, filter settings

---

## UI Components

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo, Search Bar, Theme Toggle, User Menu          │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                           │
│  Sidebar         │  Main Content Area                        │
│  - Search        │  - Graph Visualization                    │
│  - Favorites     │  - OR Artist Timeline                     │
│  - Recent        │  - OR Recent Shows Grid                   │
│                  │                                           │
├──────────────────┼──────────────────────────────────────────┤
│  Detail Panel    │  Graph Controls                           │
│  (when artist    │  - Layout selector                        │
│   selected)      │  - Zoom controls                          │
│                  │  - Filter toggles                         │
└──────────────────┴──────────────────────────────────────────┘
```

### Component Library (shadcn/ui)

| Component | Usage |
|-----------|-------|
| `Button` | Actions, controls |
| `Card` | Artist cards, show cards |
| `Dialog` | Modals, confirmations |
| `DropdownMenu` | Layout selector, user menu |
| `Input` | Search, forms |
| `ScrollArea` | Scrollable lists |
| `Tabs` | View switching |
| `Tooltip` | Help text, node info |

### Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Mobile (<640px) | Single column, hidden graph |
| Tablet (640-1024px) | Two columns |
| Desktop (>1024px) | Three columns with graph |

### Theme Support

- **Light Mode**: Default, high contrast
- **Dark Mode**: Easy on eyes, reduced blue light
- **System**: Follows OS preference

---

## Technical Architecture

### State Management

| State Type | Solution | Scope |
|------------|----------|-------|
| Server State | TanStack Query | API data, caching |
| UI State | Zustand | Graph selection, filters |
| Persistent State | localStorage | Favorites, preferences |

### Caching Strategy

```typescript
// TanStack Query defaults
{
  staleTime: 5 * 60 * 1000,      // 5 minutes
  gcTime: 30 * 60 * 1000,        // 30 minutes
  refetchOnWindowFocus: false,
  retry: 2
}
```

### Rate Limiting

| API | Limit | Implementation |
|-----|-------|----------------|
| MusicBrainz (Public) | 1 req/sec | Request queue with 1.1s delay |
| MusicBrainz (Local) | Unlimited | Direct connection |
| Setlist.fm | 10 req/sec | Client-side throttling |
| Spotify | Per-user limits | OAuth token refresh |

### Error Handling

- **Network Errors**: Retry with exponential backoff
- **Rate Limits**: Queue and delay requests
- **API Errors**: User-friendly error messages
- **Fallbacks**: Graceful degradation (e.g., no image → placeholder)

---

## File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── concerts/      # Setlist.fm proxy
│   │   ├── musicbrainz/   # MB proxy + health
│   │   ├── spotify/       # OAuth callbacks
│   │   └── supplement/    # Wikipedia data
│   └── page.tsx           # Home page
├── components/
│   ├── graph/             # Cytoscape visualization
│   ├── sidebar/           # Search, favorites, detail
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── cache/             # localStorage with TTL
│   ├── concerts/          # Setlist.fm client
│   ├── favorites/         # Favorites hooks
│   ├── graph/             # Graph building, types
│   ├── musicbrainz/       # MB client with rate limiting
│   └── storage/           # Unified storage helpers
└── types/                 # TypeScript definitions
```

---

## See Also

- [CLAUDE.md](./CLAUDE.md) - Development guide and operations
- [PROGRESS.md](./PROGRESS.md) - Development roadmap and status
- [InterChord Native App Plan](./InterChord/) - iOS/macOS native app
