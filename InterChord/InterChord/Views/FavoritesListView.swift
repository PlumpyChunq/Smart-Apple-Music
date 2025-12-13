import SwiftUI
import SwiftData

/// View displaying favorited artists grouped by genre.
struct FavoritesListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \FavoriteArtist.name) private var favorites: [FavoriteArtist]

    /// Callback when an artist is selected
    var onSelectArtist: ((Artist) -> Void)?

    /// Group favorites by genre
    private var groupedFavorites: [(genre: String, artists: [FavoriteArtist])] {
        let grouped = Dictionary(grouping: favorites) { $0.genre ?? "Other" }
        return grouped
            .map { (genre: $0.key, artists: $0.value) }
            .sorted { $0.genre < $1.genre }
    }

    var body: some View {
        Group {
            if favorites.isEmpty {
                emptyStateView
            } else {
                favoritesList
            }
        }
        .navigationTitle("Favorites")
        #if os(macOS)
        .navigationSubtitle("\(favorites.count) artists")
        #endif
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView(
            "No Favorites",
            systemImage: "star",
            description: Text("Star artists to add them to your favorites")
        )
    }

    // MARK: - Favorites List

    private var favoritesList: some View {
        List {
            ForEach(groupedFavorites, id: \.genre) { group in
                Section(header: genreHeader(group.genre, count: group.artists.count)) {
                    ForEach(group.artists) { favorite in
                        FavoriteRow(favorite: favorite)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                onSelectArtist?(favorite.toArtist())
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    removeFavorite(favorite)
                                } label: {
                                    Label("Remove", systemImage: "star.slash")
                                }
                            }
                            .contextMenu {
                                Button(role: .destructive) {
                                    removeFavorite(favorite)
                                } label: {
                                    Label("Remove from Favorites", systemImage: "star.slash")
                                }

                                Menu("Set Genre") {
                                    ForEach(FavoriteArtist.defaultGenres, id: \.self) { genre in
                                        Button(genre) {
                                            favorite.genre = genre
                                        }
                                    }
                                }
                            }
                    }
                }
            }
        }
        .listStyle(.sidebar)
    }

    // MARK: - Genre Header

    private func genreHeader(_ genre: String, count: Int) -> some View {
        HStack {
            Text(genre)
            Spacer()
            Text("\(count)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Actions

    private func removeFavorite(_ favorite: FavoriteArtist) {
        withAnimation {
            modelContext.delete(favorite)
        }
    }
}

// MARK: - Favorite Row

/// Row view for a single favorite artist.
struct FavoriteRow: View {
    let favorite: FavoriteArtist

    var body: some View {
        HStack(spacing: 12) {
            // Artist type icon
            Image(systemName: favorite.artistType == "Group" ? "person.3.fill" : "person.fill")
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(width: 32, height: 32)
                .background(.quaternary)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(favorite.name)
                    .font(.body)
                    .lineLimit(1)

                if let disambiguation = favorite.disambiguation, !disambiguation.isEmpty {
                    Text(disambiguation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Country flag
            if let country = favorite.country {
                Text(countryFlag(for: country))
                    .font(.caption)
            }

            // Star indicator
            Image(systemName: "star.fill")
                .foregroundStyle(.yellow)
                .font(.caption)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(favorite.name), favorite artist")
    }

    /// Convert country code to flag emoji
    private func countryFlag(for code: String) -> String {
        let base: UInt32 = 127397
        var flag = ""
        for scalar in code.uppercased().unicodeScalars {
            if let unicode = UnicodeScalar(base + scalar.value) {
                flag.append(String(unicode))
            }
        }
        return flag.isEmpty ? code : flag
    }
}

// MARK: - Preview

#Preview {
    FavoritesListView()
        .modelContainer(for: FavoriteArtist.self, inMemory: true)
}
