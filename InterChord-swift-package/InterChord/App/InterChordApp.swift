import SwiftUI

/// Main entry point for the InterChord app.
/// Targets: macOS 14+, iOS 17+, iPadOS 17+
///
/// IMPORTANT: When creating an Xcode project, uncomment the @main attribute below.
/// It is commented out for Swift Package Manager compatibility with tests.
// @main
struct InterChordApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        .windowStyle(.automatic)
        .defaultSize(width: 1200, height: 800)
        #endif
    }
}

/// Root content view that adapts to platform
struct ContentView: View {
    @State private var searchViewModel = SearchViewModel()

    var body: some View {
        #if os(macOS) || os(iOS)
        NavigationSplitView {
            SearchView(viewModel: searchViewModel)
        } detail: {
            if let selectedArtist = searchViewModel.selectedArtist {
                ArtistDetailView(artist: selectedArtist)
            } else {
                ContentUnavailableView(
                    "Select an Artist",
                    systemImage: "music.note",
                    description: Text("Search for an artist to view their details")
                )
            }
        }
        #endif
    }
}

#Preview {
    ContentView()
}
