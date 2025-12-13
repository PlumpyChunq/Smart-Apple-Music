import SwiftUI

/// Section displaying albums with cover art from MusicBrainz/Cover Art Archive.
struct AlbumsSection: View {
    let artistMbid: String
    let artistName: String

    @State private var albums: [Album] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isExpanded = true

    private let client = MusicBrainzClient()

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            content
        } label: {
            HStack {
                Label("Albums", systemImage: "square.stack")
                    .font(.headline)

                Spacer()

                if !albums.isEmpty {
                    Text("\(albums.count)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(.quaternary)
                        .clipShape(Capsule())
                }
            }
        }
        .task(id: artistMbid) {
            await loadAlbums()
        }
    }

    // MARK: - Content Views

    @ViewBuilder
    private var content: some View {
        if isLoading {
            loadingView
        } else if let error = errorMessage {
            errorView(message: error)
        } else if albums.isEmpty {
            emptyView
        } else {
            albumsGrid
        }
    }

    private var loadingView: some View {
        HStack {
            ProgressView()
                .scaleEffect(0.8)
            Text("Loading albums...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.secondary)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Retry") {
                Task {
                    await loadAlbums()
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var emptyView: some View {
        VStack(spacing: 8) {
            Image(systemName: "square.stack")
                .foregroundStyle(.secondary)
            Text("No albums found")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var albumsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8)
        ], spacing: 12) {
            ForEach(albums) { album in
                AlbumCard(album: album, artistName: artistName)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Data Loading

    private func loadAlbums() async {
        isLoading = true
        errorMessage = nil

        do {
            albums = try await client.fetchAlbums(mbid: artistMbid)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Album Card

/// Card view for a single album with artwork.
struct AlbumCard: View {
    let album: Album
    let artistName: String

    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 4) {
            // Album artwork
            AsyncImage(url: album.artworkURL) { phase in
                switch phase {
                case .empty:
                    placeholderView
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(1, contentMode: .fill)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                case .failure:
                    placeholderView
                @unknown default:
                    placeholderView
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .shadow(radius: 2)

            // Album title
            Text(album.title)
                .font(.caption2)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .foregroundStyle(.primary)

            // Release year
            if let year = album.year {
                Text(String(year))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .onTapGesture {
            // Open in Apple Music or default music app
            if let url = appleMusicSearchURL {
                openURL(url)
            }
        }
        .contextMenu {
            if let mbURL = album.musicBrainzURL {
                Button {
                    openURL(mbURL)
                } label: {
                    Label("View on MusicBrainz", systemImage: "globe")
                }
            }

            if let url = appleMusicSearchURL {
                Button {
                    openURL(url)
                } label: {
                    Label("Open in Music", systemImage: "music.note")
                }
            }

            if let url = wikipediaSearchURL {
                Button {
                    openURL(url)
                } label: {
                    Label("Search Wikipedia", systemImage: "book")
                }
            }
        }
    }

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(.quaternary)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                Image(systemName: "music.note")
                    .font(.title2)
                    .foregroundStyle(.tertiary)
            }
    }

    /// URL to search Apple Music for this album
    private var appleMusicSearchURL: URL? {
        let query = "\(album.title) \(artistName)"
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return nil
        }
        return URL(string: "music://music.apple.com/search?term=\(encoded)")
    }

    /// URL to search Wikipedia for this album
    private var wikipediaSearchURL: URL? {
        let query = "\(album.title) \(artistName) album"
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return nil
        }
        return URL(string: "https://en.wikipedia.org/wiki/Special:Search?search=\(encoded)")
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        AlbumsSection(
            artistMbid: "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d",
            artistName: "The Beatles"
        )
        .padding()
    }
}
