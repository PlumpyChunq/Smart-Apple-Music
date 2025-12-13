import Foundation

/// A node in the artist relationship graph.
struct GraphNode: Identifiable, Hashable, Sendable {
    /// MusicBrainz ID (MBID)
    let id: String

    /// Artist's name
    let name: String

    /// Artist type (person, group, etc.)
    let type: ArtistType

    /// Whether this node's relationships have been loaded
    var isLoaded: Bool = false

    /// Whether this is the root/center node of the graph
    var isRoot: Bool = false

    /// Whether this is a founding member (for display styling)
    var isFoundingMember: Bool = false

    /// Top instruments/roles (for tooltips)
    var instruments: [String] = []

    /// Initialize from an Artist model
    init(from artist: Artist, isRoot: Bool = false, isFoundingMember: Bool = false) {
        self.id = artist.id
        self.name = artist.name
        self.type = artist.type ?? .other
        self.isRoot = isRoot
        self.isFoundingMember = isFoundingMember
    }

    /// Initialize directly
    init(
        id: String,
        name: String,
        type: ArtistType,
        isLoaded: Bool = false,
        isRoot: Bool = false,
        isFoundingMember: Bool = false,
        instruments: [String] = []
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.isLoaded = isLoaded
        self.isRoot = isRoot
        self.isFoundingMember = isFoundingMember
        self.instruments = instruments
    }
}

/// An edge connecting two artists in the graph.
struct GraphEdge: Identifiable, Hashable, Sendable {
    /// Computed unique identifier
    var id: String { "\(sourceId)-\(targetId)-\(type.rawValue)" }

    /// Source artist MBID
    let sourceId: String

    /// Target artist MBID
    let targetId: String

    /// Type of relationship
    let type: RelationshipType

    /// Formatted tenure string (e.g., "1960–1970")
    let tenure: String?

    /// Initialize from a Relationship model
    init(from relationship: Relationship, tenure: String? = nil) {
        self.sourceId = relationship.sourceArtistId
        self.targetId = relationship.targetArtistId
        self.type = relationship.type
        self.tenure = tenure
    }

    /// Initialize directly
    init(sourceId: String, targetId: String, type: RelationshipType, tenure: String? = nil) {
        self.sourceId = sourceId
        self.targetId = targetId
        self.type = type
        self.tenure = tenure
    }
}

/// The complete graph structure containing nodes and edges.
struct ArtistGraph: Sendable {
    /// All nodes in the graph
    var nodes: [GraphNode] = []

    /// All edges connecting nodes
    var edges: [GraphEdge] = []

    /// Set of existing node IDs for quick lookup
    private var nodeIds: Set<String> = []

    /// Set of existing edge IDs for quick lookup
    private var edgeIds: Set<String> = []

    // MARK: - Initialization

    init() {}

    init(nodes: [GraphNode], edges: [GraphEdge]) {
        self.nodes = nodes
        self.edges = edges
        self.nodeIds = Set(nodes.map(\.id))
        self.edgeIds = Set(edges.map(\.id))
    }

    // MARK: - Mutation

    /// Add a node if it doesn't already exist.
    mutating func addNode(_ node: GraphNode) {
        guard !nodeIds.contains(node.id) else { return }
        nodes.append(node)
        nodeIds.insert(node.id)
    }

    /// Add an edge if it doesn't already exist.
    mutating func addEdge(_ edge: GraphEdge) {
        guard !edgeIds.contains(edge.id) else { return }
        edges.append(edge)
        edgeIds.insert(edge.id)
    }

    /// Mark a node as loaded (relationships have been fetched).
    mutating func markNodeLoaded(_ nodeId: String) {
        if let index = nodes.firstIndex(where: { $0.id == nodeId }) {
            nodes[index].isLoaded = true
        }
    }

    /// Get a node by ID.
    func node(withId id: String) -> GraphNode? {
        nodes.first { $0.id == id }
    }

    /// Get all edges connected to a node.
    func edges(connectedTo nodeId: String) -> [GraphEdge] {
        edges.filter { $0.sourceId == nodeId || $0.targetId == nodeId }
    }

    /// Get neighbor node IDs for a given node.
    func neighborIds(for nodeId: String) -> [String] {
        edges(connectedTo: nodeId).compactMap { edge in
            edge.sourceId == nodeId ? edge.targetId : edge.sourceId
        }
    }

    // MARK: - Computed Properties

    /// The root node (if any)
    var rootNode: GraphNode? {
        nodes.first { $0.isRoot }
    }

    /// Number of nodes
    var nodeCount: Int { nodes.count }

    /// Number of edges
    var edgeCount: Int { edges.count }

    /// Whether the graph is empty
    var isEmpty: Bool { nodes.isEmpty }
}

// MARK: - Graph Building

extension ArtistGraph {
    /// Create a graph from an artist and their relationships.
    static func build(
        from artist: Artist,
        relationships: [Relationship],
        relatedArtists: [Artist]
    ) -> ArtistGraph {
        var graph = ArtistGraph()

        // Add root node
        let rootNode = GraphNode(from: artist, isRoot: true)
        graph.addNode(rootNode)

        // Calculate earliest member year for founding detection
        let earliestYear = getEarliestMemberYear(relationships, bandStartYear: artist.lifeSpan?.begin)

        // Add related artists as nodes
        for relatedArtist in relatedArtists {
            // Check if founding member
            let isFounder = relationships.contains { rel in
                (rel.targetArtistId == relatedArtist.id || rel.sourceArtistId == relatedArtist.id) &&
                isFoundingMember(rel, earliestYear: earliestYear)
            }

            // Extract instruments
            let instruments = relationships
                .filter { $0.targetArtistId == relatedArtist.id || $0.sourceArtistId == relatedArtist.id }
                .flatMap { extractInstruments($0.attributes) }
                .uniqued()
                .prefix(3)
                .map { $0 }

            var node = GraphNode(from: relatedArtist, isFoundingMember: isFounder)
            node.instruments = instruments
            graph.addNode(node)
        }

        // Add edges from relationships
        for rel in relationships {
            let tenure = formatTenure(begin: rel.begin, end: rel.end)
            let edge = GraphEdge(from: rel, tenure: tenure.isEmpty ? nil : tenure)
            graph.addEdge(edge)
        }

        return graph
    }

    /// Merge new nodes and edges into existing graph.
    mutating func merge(
        newNodes: [GraphNode],
        newEdges: [GraphEdge],
        expandedNodeId: String
    ) {
        // Mark expanded node as loaded
        markNodeLoaded(expandedNodeId)

        // Add new nodes
        for node in newNodes {
            addNode(node)
        }

        // Add new edges
        for edge in newEdges {
            addEdge(edge)
        }
    }

    // MARK: - Helper Functions

    private static func getEarliestMemberYear(_ relationships: [Relationship], bandStartYear: String?) -> Int {
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

    private static func isFoundingMember(_ rel: Relationship, earliestYear: Int) -> Bool {
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

    private static func extractInstruments(_ attributes: [String]?) -> [String] {
        guard let attributes = attributes else { return [] }

        let nonInstruments = ["founding", "original", "past", "current", "minor"]
        return attributes.filter { attr in
            !nonInstruments.contains { ni in attr.lowercased().contains(ni) }
        }
    }

    private static func formatTenure(begin: String?, end: String?) -> String {
        guard let startYear = parseYear(begin) else { return "" }

        if let endYear = parseYear(end) {
            return startYear == endYear ? "\(startYear)" : "\(startYear)–\(endYear)"
        }
        return "\(startYear)–present"
    }

    private static func parseYear(_ dateString: String?) -> Int? {
        guard let dateString = dateString, !dateString.isEmpty else { return nil }
        return Int(String(dateString.prefix(4)))
    }
}

// MARK: - Array Extension

extension Array where Element: Hashable {
    /// Return unique elements preserving order.
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
