import SwiftUI
import SpriteKit

/// SwiftUI wrapper for the SpriteKit graph visualization.
struct GraphView: View {
    @Bindable var viewModel: GraphViewModel

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // SpriteKit Scene
                SpriteView(scene: makeScene(size: geometry.size), options: [.allowsTransparency])
                    .ignoresSafeArea()

                // Loading overlay
                if viewModel.isExpanding {
                    expandingOverlay
                }

                // Empty state
                if viewModel.graph.isEmpty {
                    emptyState
                }
            }
        }
        .background(Color(PlatformColor.systemBackground))
    }

    // MARK: - Scene Creation

    private func makeScene(size: CGSize) -> GraphScene {
        let scene = GraphScene(size: size)
        scene.scaleMode = .resizeFill
        scene.backgroundColor = .clear

        // Wire up callbacks
        scene.onNodeTapped = { nodeId in
            viewModel.selectNode(nodeId)
        }

        scene.onNodeDoubleTapped = { nodeId in
            Task {
                await viewModel.expandNode(nodeId)
            }
        }

        scene.onBackgroundTapped = {
            viewModel.selectNode(nil)
        }

        // Set initial graph
        if !viewModel.graph.isEmpty {
            scene.setGraph(viewModel.graph)
        }

        // Store reference for updates
        viewModel.scene = scene

        return scene
    }

    // MARK: - Overlays

    private var expandingOverlay: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Expanding...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private var emptyState: some View {
        ContentUnavailableView(
            "No Graph Data",
            systemImage: "chart.dots.scatter",
            description: Text("Select an artist to view their relationship graph")
        )
    }
}

// MARK: - Preview

#Preview {
    let viewModel = GraphViewModel()

    // Add sample data
    var sampleGraph = ArtistGraph()
    sampleGraph.addNode(GraphNode(id: "1", name: "The Beatles", type: .group, isRoot: true))
    sampleGraph.addNode(GraphNode(id: "2", name: "John Lennon", type: .person, isFoundingMember: true))
    sampleGraph.addNode(GraphNode(id: "3", name: "Paul McCartney", type: .person, isFoundingMember: true))
    sampleGraph.addNode(GraphNode(id: "4", name: "George Harrison", type: .person, isFoundingMember: true))
    sampleGraph.addNode(GraphNode(id: "5", name: "Ringo Starr", type: .person))

    sampleGraph.addEdge(GraphEdge(sourceId: "1", targetId: "2", type: .memberOf, tenure: "1960-1970"))
    sampleGraph.addEdge(GraphEdge(sourceId: "1", targetId: "3", type: .memberOf, tenure: "1960-1970"))
    sampleGraph.addEdge(GraphEdge(sourceId: "1", targetId: "4", type: .memberOf, tenure: "1960-1970"))
    sampleGraph.addEdge(GraphEdge(sourceId: "1", targetId: "5", type: .memberOf, tenure: "1962-1970"))

    viewModel.graph = sampleGraph

    return GraphView(viewModel: viewModel)
        .frame(width: 600, height: 400)
}
