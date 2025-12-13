import SwiftUI
import SwiftData

/// Main entry point for the InterChord app.
/// Targets: macOS 14+, iOS 17+, iPadOS 17+
@main
struct InterChordApp: App {
    /// SwiftData model container for persistent storage
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            FavoriteArtist.self
        ])
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
        #if os(macOS)
        .windowStyle(.automatic)
        .defaultSize(width: 1200, height: 800)
        #endif
    }
}

/// Sidebar tab selection
enum SidebarTab: String, CaseIterable {
    case search = "Search"
    case favorites = "Favorites"

    var icon: String {
        switch self {
        case .search: return "magnifyingglass"
        case .favorites: return "star.fill"
        }
    }
}

/// Root content view that adapts to platform
struct ContentView: View {
    @State private var searchViewModel = SearchViewModel()
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var navigationPath: [Artist] = []
    @State private var selectedTab: SidebarTab = .search
    @State private var selectedArtist: Artist?

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebarContent
                .navigationSplitViewColumnWidth(min: 250, ideal: 300)
        } detail: {
            NavigationStack(path: $navigationPath) {
                if let artist = selectedArtist ?? searchViewModel.selectedArtist {
                    ArtistDetailView(artist: artist) { relatedArtist in
                        navigationPath.append(relatedArtist)
                    }
                    .id(artist.id)
                } else {
                    ContentUnavailableView(
                        "Select an Artist",
                        systemImage: "music.note",
                        description: Text("Search for an artist or select from favorites")
                    )
                }
            }
            .navigationDestination(for: Artist.self) { artist in
                ArtistDetailView(artist: artist) { relatedArtist in
                    navigationPath.append(relatedArtist)
                }
            }
        }
        .onChange(of: searchViewModel.selectedArtist) { _, newValue in
            if newValue != nil {
                selectedArtist = newValue
                navigationPath.removeAll()
            }
        }
        .onChange(of: selectedArtist) { _, _ in
            navigationPath.removeAll()
        }
    }

    // MARK: - Sidebar Content

    @ViewBuilder
    private var sidebarContent: some View {
        VStack(spacing: 0) {
            // Tab picker
            Picker("View", selection: $selectedTab) {
                ForEach(SidebarTab.allCases, id: \.self) { tab in
                    Label(tab.rawValue, systemImage: tab.icon)
                        .tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.top, 8)

            // Tab content
            switch selectedTab {
            case .search:
                SearchView(viewModel: searchViewModel)
            case .favorites:
                FavoritesListView { artist in
                    selectedArtist = artist
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
