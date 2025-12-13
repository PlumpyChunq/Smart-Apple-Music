import SwiftUI

/// Detail view for an artist showing bio, relationships, and navigation.
struct ArtistDetailView: View {
    let artist: Artist
    var onSelectArtist: ((Artist) -> Void)?
    @State private var viewModel = ArtistDetailViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header Section
                ArtistHeaderSection(artist: artist)

                // Content
                if viewModel.isLoading {
                    loadingView
                } else if let error = viewModel.errorMessage {
                    errorView(message: error)
                } else if viewModel.hasRelationships {
                    relationshipSections
                } else {
                    noRelationshipsView
                }
            }
            .padding()
        }
        .navigationTitle(artist.name)
        #if os(macOS)
        .navigationSubtitle(artist.disambiguation ?? "")
        #endif
        .task(id: artist.id) {
            await viewModel.loadDetails(for: artist)
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading relationships...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Error View

    private func errorView(message: String) -> some View {
        ContentUnavailableView(
            "Unable to Load",
            systemImage: "exclamationmark.triangle",
            description: Text(message)
        )
    }

    // MARK: - No Relationships View

    private var noRelationshipsView: some View {
        ContentUnavailableView(
            "No Relationships",
            systemImage: "person.2.slash",
            description: Text("No known relationships for this artist")
        )
    }

    // MARK: - Relationship Sections

    private var relationshipSections: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(viewModel.sortedRelationshipTypes, id: \.self) { type in
                if let items = viewModel.groupedRelationships[type], !items.isEmpty {
                    RelationshipSection(
                        title: viewModel.sectionHeader(for: type),
                        items: items,
                        onSelect: { artist in
                            onSelectArtist?(artist)
                        }
                    )
                }
            }

            // Albums Section
            AlbumsSection(artistMbid: artist.id, artistName: artist.name)
                .padding(.top, 8)

            // Recent Shows Section
            RecentShowsSection(artistMbid: artist.id)
                .padding(.top, 8)

            // Data source indicator
            if let dataSource = viewModel.lastDataSource {
                HStack {
                    Image(systemName: "server.rack")
                    Text("Data from: \(dataSource)")
                }
                .font(.caption)
                .foregroundStyle(.tertiary)
                .padding(.top, 8)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ArtistDetailView(
        artist: Artist(
            id: "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d",
            name: "The Beatles",
            disambiguation: "English rock band",
            type: .group,
            country: "GB",
            lifeSpan: LifeSpan(begin: "1960", end: "1970", ended: true)
        )
    )
}
