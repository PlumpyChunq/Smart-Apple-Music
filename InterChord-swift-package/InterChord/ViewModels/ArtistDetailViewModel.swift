import Foundation
import SwiftUI

/// ViewModel for artist detail view.
/// Fetches relationships and groups them by type with tenure and founding status.
@Observable
final class ArtistDetailViewModel: @unchecked Sendable {
    // MARK: - Published State

    /// The artist being displayed
    var artist: Artist?

    /// All relationships for this artist
    var relationships: [Relationship] = []

    /// Related artists (targets of relationships)
    var relatedArtists: [Artist] = []

    /// Relationships grouped by type with computed properties
    var groupedRelationships: [String: [GroupedItem]] = [:]

    /// Loading state
    var isLoading = false

    /// Error message to display
    var errorMessage: String?

    /// Data source used for last request
    var lastDataSource: String?

    // MARK: - Types

    /// A relationship item with computed display properties
    struct GroupedItem: Identifiable {
        var id: String { relationship.id }
        let relationship: Relationship
        let artist: Artist
        let isFoundingMember: Bool
        let isCurrent: Bool
        let tenure: String
        let sortYear: Int
        let instruments: [String]
    }

    // MARK: - Dependencies

    private let client: MusicBrainzClient

    // MARK: - Computed Properties

    var hasRelationships: Bool { !relationships.isEmpty }

    /// Relationship types in display order
    var sortedRelationshipTypes: [String] {
        let order: [RelationshipType] = [
            .memberOf, .founderOf, .collaboration, .subgroup,
            .vocalSupport, .instrumental, .supportingMusician,
            .tribute, .other
        ]

        let typeOrder = Dictionary(uniqueKeysWithValues: order.enumerated().map { ($1.rawValue, $0) })

        return groupedRelationships.keys.sorted { type1, type2 in
            let order1 = typeOrder[type1] ?? 999
            let order2 = typeOrder[type2] ?? 999
            return order1 < order2
        }
    }

    // MARK: - Initialization

    init(client: MusicBrainzClient = MusicBrainzClient()) {
        self.client = client
    }

    // MARK: - Actions

    /// Load relationships for an artist.
    @MainActor
    func loadDetails(for artist: Artist) async {
        self.artist = artist
        isLoading = true
        errorMessage = nil

        do {
            relationships = try await client.fetchRelationships(mbid: artist.id)
            lastDataSource = await client.lastDataSource?.rawValue

            // Extract related artists from relationships
            relatedArtists = relationships.compactMap { $0.targetArtist }

            // Group relationships by type
            groupedRelationships = groupByType(
                relationships,
                relatedArtists: relatedArtists,
                bandStartYear: artist.lifeSpan?.begin
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Relationship Grouping (ported from builder.ts)

    /// Group relationships by type with founding status and tenure.
    private func groupByType(
        _ relationships: [Relationship],
        relatedArtists: [Artist],
        bandStartYear: String?
    ) -> [String: [GroupedItem]] {
        let artistMap = Dictionary(uniqueKeysWithValues: relatedArtists.map { ($0.id, $0) })
        var grouped: [String: [GroupedItem]] = [:]
        let earliestYear = getEarliestMemberYear(relationships, bandStartYear: bandStartYear)

        for rel in relationships {
            guard let artist = artistMap[rel.targetArtistId] ?? artistMap[rel.sourceArtistId] else {
                continue
            }

            let type = rel.type.rawValue
            if grouped[type] == nil {
                grouped[type] = []
            }

            // Use relationship period if available, otherwise fall back to artist's active years
            let periodBegin = rel.begin ?? artist.lifeSpan?.begin
            let periodEnd = rel.end ?? artist.lifeSpan?.end

            let startYear = parseYear(periodBegin) ?? 9999
            let founding = isFoundingMember(rel, earliestYear: earliestYear)
            let isCurrent = periodEnd == nil
            let tenure = formatTenure(begin: periodBegin, end: periodEnd)
            let instruments = extractInstruments(rel.attributes)

            grouped[type]?.append(GroupedItem(
                relationship: rel,
                artist: artist,
                isFoundingMember: founding,
                isCurrent: isCurrent,
                tenure: tenure,
                sortYear: startYear,
                instruments: instruments
            ))
        }

        // Sort each group: founders first, then current, then by year
        for type in grouped.keys {
            grouped[type]?.sort { a, b in
                if a.isFoundingMember && !b.isFoundingMember { return true }
                if !a.isFoundingMember && b.isFoundingMember { return false }
                if a.isCurrent && !b.isCurrent { return true }
                if !a.isCurrent && b.isCurrent { return false }
                return a.sortYear < b.sortYear
            }
        }

        return grouped
    }

    /// Get the earliest year any member joined.
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

    /// Determine if a relationship represents a founding member.
    private func isFoundingMember(_ rel: Relationship, earliestYear: Int) -> Bool {
        guard rel.type == .memberOf else { return false }

        // Check for explicit "founder" attribute
        if let attributes = rel.attributes {
            if attributes.contains(where: { $0.lowercased().contains("found") }) {
                return true
            }
        }

        // Or if their start year matches the earliest known member year
        if let startYear = parseYear(rel.begin), startYear == earliestYear {
            return true
        }

        return false
    }

    /// Extract instruments from attributes (filter out non-instrument attributes).
    private func extractInstruments(_ attributes: [String]?) -> [String] {
        guard let attributes = attributes else { return [] }

        let nonInstruments = ["founding", "original", "past", "current", "minor"]
        return attributes
            .filter { attr in
                !nonInstruments.contains { ni in attr.lowercased().contains(ni) }
            }
            .prefix(3)
            .map { $0 }
    }

    /// Format tenure as "YYYY–YYYY" or "YYYY–present".
    private func formatTenure(begin: String?, end: String?) -> String {
        guard let startYear = parseYear(begin) else { return "" }

        if let endYear = parseYear(end) {
            return startYear == endYear ? "\(startYear)" : "\(startYear)–\(endYear)"
        }
        return "\(startYear)–present"
    }

    /// Parse year from date string (YYYY, YYYY-MM, or YYYY-MM-DD).
    private func parseYear(_ dateString: String?) -> Int? {
        guard let dateString = dateString, !dateString.isEmpty else { return nil }

        // Extract first 4 characters as year
        let yearString = String(dateString.prefix(4))
        return Int(yearString)
    }
}

// MARK: - Relationship Label Helper

extension ArtistDetailViewModel {
    /// Get human-readable label for relationship type.
    func relationshipLabel(for type: String) -> String {
        if let relType = RelationshipType(rawValue: type) {
            return relType.displayName
        }
        // Capitalize and clean up unknown types
        return type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    /// Get count suffix for section header.
    func sectionHeader(for type: String) -> String {
        let label = relationshipLabel(for: type)
        let count = groupedRelationships[type]?.count ?? 0
        return "\(label) (\(count))"
    }
}
