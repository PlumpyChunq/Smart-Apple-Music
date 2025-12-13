import Foundation
import SwiftUI

/// ViewModel for the graph visualization.
/// Manages graph state, node selection, and expansion.
@Observable
final class GraphViewModel: @unchecked Sendable {
    // MARK: - Published State

    /// The current graph data
    var graph = ArtistGraph()

    /// Currently selected node ID
    var selectedNodeId: String?

    /// Whether the graph is currently expanding a node
    var isExpanding = false

    /// Error message from last operation
    var errorMessage: String?

    /// Reference to the SpriteKit scene for updates
    weak var scene: GraphScene?

    // MARK: - Dependencies

    private let client: MusicBrainzClient

    // MARK: - Computed Properties

    /// The selected node (if any)
    var selectedNode: GraphNode? {
        guard let id = selectedNodeId else { return nil }
        return graph.node(withId: id)
    }

    /// Whether there's a selection
    var hasSelection: Bool { selectedNodeId != nil }

    /// Whether the selected node can be expanded
    var canExpandSelection: Bool {
        guard let node = selectedNode else { return false }
        return !node.isLoaded
    }

    // MARK: - Initialization

    init(client: MusicBrainzClient = MusicBrainzClient()) {
        self.client = client
    }

    // MARK: - Actions

    /// Load the initial graph for an artist.
    @MainActor
    func loadGraph(for artist: Artist) async {
        isExpanding = true
        errorMessage = nil

        do {
            let relationships = try await client.fetchRelationships(mbid: artist.id)

            // Extract related artists
            let relatedArtists = relationships.compactMap { $0.targetArtist }

            // Build initial graph
            graph = ArtistGraph.build(
                from: artist,
                relationships: relationships,
                relatedArtists: relatedArtists
            )

            // Update scene
            scene?.setGraph(graph)

        } catch {
            errorMessage = error.localizedDescription
        }

        isExpanding = false
    }

    /// Select a node in the graph.
    @MainActor
    func selectNode(_ nodeId: String?) {
        selectedNodeId = nodeId
        scene?.selectNode(nodeId)
    }

    /// Expand a node to show its relationships.
    @MainActor
    func expandNode(_ nodeId: String) async {
        // Don't expand if already loaded
        guard let node = graph.node(withId: nodeId), !node.isLoaded else {
            return
        }

        isExpanding = true
        errorMessage = nil

        do {
            // Fetch relationships for this node
            let relationships = try await client.fetchRelationships(mbid: nodeId)

            // Extract related artists
            let relatedArtists = relationships.compactMap { $0.targetArtist }

            // Create new nodes and edges
            var newNodes: [GraphNode] = []
            var newEdges: [GraphEdge] = []

            // Calculate founding status for new members
            let bandStartYear = node.type == .group ? nil : relationships.first?.begin
            let earliestYear = getEarliestMemberYear(relationships, bandStartYear: bandStartYear)

            for artist in relatedArtists {
                // Skip if already in graph
                if graph.node(withId: artist.id) != nil {
                    continue
                }

                // Check if founding member
                let isFounder = relationships.contains { rel in
                    (rel.targetArtistId == artist.id || rel.sourceArtistId == artist.id) &&
                    isFoundingMember(rel, earliestYear: earliestYear)
                }

                let newNode = GraphNode(from: artist, isFoundingMember: isFounder)
                newNodes.append(newNode)
            }

            // Add edges
            for rel in relationships {
                let tenure = formatTenure(begin: rel.begin, end: rel.end)
                let edge = GraphEdge(from: rel, tenure: tenure.isEmpty ? nil : tenure)

                // Only add if not already in graph
                if !graph.edges.contains(where: { $0.id == edge.id }) {
                    newEdges.append(edge)
                }
            }

            // Merge into graph
            graph.merge(newNodes: newNodes, newEdges: newEdges, expandedNodeId: nodeId)

            // Update scene
            scene?.updateGraph(graph)

        } catch {
            errorMessage = error.localizedDescription
        }

        isExpanding = false
    }

    /// Clear the graph.
    @MainActor
    func clearGraph() {
        graph = ArtistGraph()
        selectedNodeId = nil
        scene?.setGraph(graph)
    }

    // MARK: - Helper Functions

    private func getEarliestMemberYear(_ relationships: [Relationship], bandStartYear: String?) -> Int {
        var earliestYear = parseYear(bandStartYear) ?? 9999

        for rel in relationships {
            if rel.type == .memberOf {
                if let year = parseYear(rel.begin), year < earliestYear {
                    earliestYear = year
                }
            }
        }

        return earliestYear
    }

    private func isFoundingMember(_ rel: Relationship, earliestYear: Int) -> Bool {
        guard rel.type == .memberOf else { return false }

        if let attributes = rel.attributes {
            if attributes.contains(where: { $0.lowercased().contains("found") }) {
                return true
            }
        }

        if let startYear = parseYear(rel.begin), startYear == earliestYear {
            return true
        }

        return false
    }

    private func formatTenure(begin: String?, end: String?) -> String {
        guard let startYear = parseYear(begin) else { return "" }

        if let endYear = parseYear(end) {
            return startYear == endYear ? "\(startYear)" : "\(startYear)–\(endYear)"
        }
        return "\(startYear)–present"
    }

    private func parseYear(_ dateString: String?) -> Int? {
        guard let dateString = dateString, !dateString.isEmpty else { return nil }
        return Int(String(dateString.prefix(4)))
    }
}
