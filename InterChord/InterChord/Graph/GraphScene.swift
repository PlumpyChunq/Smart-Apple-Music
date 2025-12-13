import SpriteKit

/// SpriteKit scene for visualizing artist relationship graphs.
class GraphScene: SKScene {
    // MARK: - Types

    enum Layout {
        case spoke    // Radial rings by depth
        case force    // Physics-based (future)
    }

    // MARK: - Configuration

    private let nodeRadius: CGFloat = 25
    private let rootNodeRadius: CGFloat = 40
    private let ringSpacing: CGFloat = 120
    private let labelFontSize: CGFloat = 11

    // MARK: - State

    private var graph = ArtistGraph()
    private var nodeSprites: [String: SKNode] = [:]
    private var edgeShapes: [String: SKShapeNode] = [:]
    private var selectedNodeId: String?

    // MARK: - Callbacks

    var onNodeTapped: ((String) -> Void)?
    var onNodeDoubleTapped: ((String) -> Void)?
    var onBackgroundTapped: (() -> Void)?

    // MARK: - Lifecycle

    override func didMove(to view: SKView) {
        backgroundColor = .clear
        physicsWorld.gravity = .zero
    }

    // MARK: - Public API

    /// Set the graph to display.
    func setGraph(_ graph: ArtistGraph, layout: Layout = .spoke) {
        self.graph = graph
        clearScene()
        createNodes()
        createEdges()
        applyLayout(layout)
    }

    /// Update an existing graph (for expansion).
    func updateGraph(_ graph: ArtistGraph) {
        self.graph = graph

        // Add new nodes
        for node in graph.nodes where nodeSprites[node.id] == nil {
            let sprite = createNodeSprite(for: node)
            nodeSprites[node.id] = sprite
            addChild(sprite)
        }

        // Add new edges
        for edge in graph.edges where edgeShapes[edge.id] == nil {
            let shape = createEdgeShape(for: edge)
            edgeShapes[edge.id] = shape
            insertChild(shape, at: 0)
        }

        // Re-layout
        applyLayout(.spoke)
    }

    /// Select a node visually.
    func selectNode(_ nodeId: String?) {
        // Clear previous selection
        if let previousId = selectedNodeId, let previous = nodeSprites[previousId] {
            setNodeSelected(previous, selected: false)
        }

        selectedNodeId = nodeId

        // Apply new selection
        if let currentId = nodeId, let current = nodeSprites[currentId] {
            setNodeSelected(current, selected: true)
        }

        // Update edge highlighting
        updateEdgeHighlighting()
    }

    // MARK: - Node Creation

    private func createNodes() {
        for node in graph.nodes {
            let sprite = createNodeSprite(for: node)
            nodeSprites[node.id] = sprite
            addChild(sprite)
        }
    }

    private func createNodeSprite(for node: GraphNode) -> SKNode {
        let container = SKNode()
        container.name = node.id

        let radius = node.isRoot ? rootNodeRadius : nodeRadius

        // Main circle
        let circle = SKShapeNode(circleOfRadius: radius)
        circle.fillColor = nodeColor(for: node)
        circle.strokeColor = nodeBorderColor(for: node)
        circle.lineWidth = node.isRoot ? 4 : 2
        circle.name = "circle"
        container.addChild(circle)

        // Founding member ring
        if node.isFoundingMember && !node.isRoot {
            let ring = SKShapeNode(circleOfRadius: radius + 3)
            ring.fillColor = .clear
            ring.strokeColor = PlatformColor.systemPurple
            ring.lineWidth = 3
            ring.name = "foundingRing"
            container.addChild(ring)
        }

        // Root glow
        if node.isRoot {
            let glow = SKShapeNode(circleOfRadius: radius + 6)
            glow.fillColor = .clear
            glow.strokeColor = PlatformColor.systemCyan
            glow.lineWidth = 4
            glow.glowWidth = 8
            glow.name = "rootGlow"
            container.addChild(glow)
        }

        // Selection indicator (hidden by default)
        let selection = SKShapeNode(circleOfRadius: radius + 5)
        selection.fillColor = .clear
        selection.strokeColor = PlatformColor.systemOrange
        selection.lineWidth = 3
        selection.name = "selection"
        selection.isHidden = true
        container.addChild(selection)

        // Label
        let label = SKLabelNode(text: truncateName(node.name))
        label.fontSize = labelFontSize
        label.fontName = "Helvetica Neue"
        label.verticalAlignmentMode = .top
        label.horizontalAlignmentMode = .center
        label.position = CGPoint(x: 0, y: -radius - 4)
        label.fontColor = PlatformColor.label
        label.name = "label"
        container.addChild(label)

        // Position at center initially
        container.position = CGPoint(x: frame.midX, y: frame.midY)

        return container
    }

    private func nodeColor(for node: GraphNode) -> PlatformColor {
        if node.isRoot {
            return PlatformColor.systemBlue
        }

        switch node.type {
        case .group:
            return PlatformColor.systemBlue
        case .person:
            return PlatformColor.systemGreen
        case .orchestra:
            return PlatformColor.systemPurple
        case .choir:
            return PlatformColor.systemPink
        default:
            return PlatformColor.systemGray
        }
    }

    private func nodeBorderColor(for node: GraphNode) -> PlatformColor {
        if node.isRoot {
            return PlatformColor.systemCyan
        }
        if !node.isLoaded {
            return PlatformColor.systemGray
        }
        return nodeColor(for: node).withAlphaComponent(0.8)
    }

    private func truncateName(_ name: String, maxLength: Int = 15) -> String {
        if name.count <= maxLength {
            return name
        }
        return String(name.prefix(maxLength - 1)) + "..."
    }

    // MARK: - Edge Creation

    private func createEdges() {
        for edge in graph.edges {
            let shape = createEdgeShape(for: edge)
            edgeShapes[edge.id] = shape
            insertChild(shape, at: 0)
        }
    }

    private func createEdgeShape(for edge: GraphEdge) -> SKShapeNode {
        let shape = SKShapeNode()
        shape.name = edge.id
        shape.strokeColor = edgeColor(for: edge.type)
        shape.lineWidth = edge.type == .founderOf ? 3 : 2
        shape.lineCap = .round
        shape.alpha = 0.7

        // Dashed line for collaborations
        if edge.type == .collaboration || edge.type == .subgroup {
            shape.path = nil // Will be set in update loop with dashing
        }

        return shape
    }

    private func edgeColor(for type: RelationshipType) -> PlatformColor {
        switch type {
        case .memberOf:
            return PlatformColor.systemBlue.withAlphaComponent(0.6)
        case .founderOf:
            return PlatformColor.systemPurple
        case .collaboration:
            return PlatformColor.systemGreen
        case .subgroup:
            return PlatformColor.systemOrange
        case .supportingMusician, .vocalSupport, .instrumental:
            return PlatformColor.systemTeal
        default:
            return PlatformColor.systemGray.withAlphaComponent(0.5)
        }
    }

    // MARK: - Layout

    private func applyLayout(_ layout: Layout) {
        switch layout {
        case .spoke:
            applySpokeLayout()
        case .force:
            // Future: implement force-directed layout
            applySpokeLayout()
        }
    }

    private func applySpokeLayout() {
        let centerX = frame.midX
        let centerY = frame.midY

        // Calculate depths using BFS from root
        let depths = calculateDepths()

        // Group nodes by depth
        var nodesByDepth: [Int: [GraphNode]] = [:]
        for node in graph.nodes {
            let depth = depths[node.id] ?? 0
            nodesByDepth[depth, default: []].append(node)
        }

        // Position nodes by depth ring
        for (depth, nodes) in nodesByDepth {
            if depth == 0 {
                // Root at center
                for node in nodes {
                    nodeSprites[node.id]?.position = CGPoint(x: centerX, y: centerY)
                }
            } else {
                // Arrange in circle at this depth
                let radius = CGFloat(depth) * ringSpacing
                let angleStep = 2 * .pi / CGFloat(nodes.count)
                let startAngle: CGFloat = -.pi / 2 // Start from top

                for (index, node) in nodes.enumerated() {
                    let angle = startAngle + CGFloat(index) * angleStep
                    let x = centerX + radius * cos(angle)
                    let y = centerY + radius * sin(angle)

                    // Animate to position
                    let moveAction = SKAction.move(to: CGPoint(x: x, y: y), duration: 0.3)
                    moveAction.timingMode = .easeInEaseOut
                    nodeSprites[node.id]?.run(moveAction)
                }
            }
        }
    }

    private func calculateDepths() -> [String: Int] {
        var depths: [String: Int] = [:]
        guard let root = graph.rootNode else { return depths }

        depths[root.id] = 0
        var queue = [root.id]

        while !queue.isEmpty {
            let currentId = queue.removeFirst()
            let currentDepth = depths[currentId] ?? 0

            let neighborIds = graph.neighborIds(for: currentId)

            for neighborId in neighborIds where depths[neighborId] == nil {
                depths[neighborId] = currentDepth + 1
                queue.append(neighborId)
            }
        }

        return depths
    }

    // MARK: - Update Loop

    override func update(_ currentTime: TimeInterval) {
        // Update edge positions to follow nodes
        for edge in graph.edges {
            guard let shape = edgeShapes[edge.id],
                  let source = nodeSprites[edge.sourceId],
                  let target = nodeSprites[edge.targetId] else { continue }

            let path = CGMutablePath()
            path.move(to: source.position)
            path.addLine(to: target.position)
            shape.path = path
        }
    }

    // MARK: - Selection

    private func setNodeSelected(_ node: SKNode, selected: Bool) {
        if let selection = node.childNode(withName: "selection") {
            selection.isHidden = !selected
        }
    }

    private func updateEdgeHighlighting() {
        for edge in graph.edges {
            guard let shape = edgeShapes[edge.id] else { continue }

            let isConnectedToSelected = selectedNodeId != nil &&
                (edge.sourceId == selectedNodeId || edge.targetId == selectedNodeId)

            if isConnectedToSelected {
                shape.alpha = 1.0
                shape.lineWidth = edge.type == .founderOf ? 4 : 3
            } else if selectedNodeId != nil {
                shape.alpha = 0.15
                shape.lineWidth = edge.type == .founderOf ? 3 : 2
            } else {
                shape.alpha = 0.7
                shape.lineWidth = edge.type == .founderOf ? 3 : 2
            }
        }
    }

    // MARK: - Touch/Mouse Handling

    #if os(iOS)
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        handleTap(at: touch.location(in: self), tapCount: touch.tapCount)
    }
    #endif

    #if os(macOS)
    override func mouseDown(with event: NSEvent) {
        handleTap(at: event.location(in: self), tapCount: event.clickCount)
    }
    #endif

    private func handleTap(at location: CGPoint, tapCount: Int) {
        // Find tapped node
        let tappedNode = nodes(at: location).first { node in
            nodeSprites.values.contains { $0 === node || $0.children.contains { $0 === node } }
        }

        if let tappedNode = tappedNode {
            // Find the node ID
            let nodeId = findNodeId(for: tappedNode)

            if let nodeId = nodeId {
                if tapCount >= 2 {
                    onNodeDoubleTapped?(nodeId)
                } else {
                    onNodeTapped?(nodeId)
                }
            }
        } else {
            onBackgroundTapped?()
        }
    }

    private func findNodeId(for node: SKNode) -> String? {
        // Check if this node or its parent is in our sprites
        if let name = node.name, nodeSprites[name] != nil {
            return name
        }

        if let parent = node.parent, let name = parent.name, nodeSprites[name] != nil {
            return name
        }

        return nil
    }

    // MARK: - Cleanup

    private func clearScene() {
        nodeSprites.values.forEach { $0.removeFromParent() }
        edgeShapes.values.forEach { $0.removeFromParent() }
        nodeSprites.removeAll()
        edgeShapes.removeAll()
        selectedNodeId = nil
    }
}
