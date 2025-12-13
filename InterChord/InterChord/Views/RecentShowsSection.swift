import SwiftUI

/// Section displaying recent concerts from Setlist.fm.
struct RecentShowsSection: View {
    let artistMbid: String

    @State private var concerts: [Concert] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isExpanded = true

    private let client = SetlistFMClient.shared

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            content
        } label: {
            HStack {
                Label("Recent Shows", systemImage: "music.mic")
                    .font(.headline)

                Spacer()

                if !concerts.isEmpty {
                    Text("\(concerts.count)")
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
            await loadConcerts()
        }
    }

    // MARK: - Content Views

    @ViewBuilder
    private var content: some View {
        if isLoading {
            loadingView
        } else if let error = errorMessage {
            errorView(message: error)
        } else if concerts.isEmpty {
            emptyView
        } else {
            concertList
        }
    }

    private var loadingView: some View {
        HStack {
            ProgressView()
                .scaleEffect(0.8)
            Text("Loading shows...")
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
                    await loadConcerts()
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
            Image(systemName: "music.mic")
                .foregroundStyle(.secondary)
            Text("No recent shows found")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var concertList: some View {
        VStack(spacing: 8) {
            ForEach(concerts) { concert in
                ConcertRow(concert: concert)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Data Loading

    private func loadConcerts() async {
        isLoading = true
        errorMessage = nil

        do {
            concerts = try await client.fetchConcerts(mbid: artistMbid, limit: 10)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Concert Row

/// Row view for a single concert.
struct ConcertRow: View {
    let concert: Concert

    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Venue and location
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(concert.venue.name)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(concert.venue.formattedLocation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Date
                if let date = concert.eventDate {
                    Text(date, style: .date)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(concert.eventDateString)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // Tour name if available
            if let tour = concert.tour {
                Text(tour.name)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .italic()
            }

            // Setlist.fm link
            if let urlString = concert.url, let url = URL(string: urlString) {
                Button {
                    openURL(url)
                } label: {
                    Label("View Setlist", systemImage: "list.bullet")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(.quaternary.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        RecentShowsSection(artistMbid: "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d")
            .padding()
    }
}
