import Foundation

/// Represents an album/release from MusicBrainz.
struct Album: Identifiable, Codable, Hashable, Sendable {
    let id: String              // MusicBrainz release-group ID
    let title: String
    let releaseDate: String?    // YYYY, YYYY-MM, or YYYY-MM-DD
    let primaryType: String?    // Album, EP, Single
    let secondaryTypes: [String]?

    /// Year extracted from release date for display
    var year: Int? {
        guard let date = releaseDate, date.count >= 4 else { return nil }
        return Int(date.prefix(4))
    }

    /// URL to Cover Art Archive artwork (250px)
    var artworkURL: URL? {
        URL(string: "https://coverartarchive.org/release-group/\(id)/front-250")
    }

    /// URL to larger Cover Art Archive artwork (500px)
    var largeArtworkURL: URL? {
        URL(string: "https://coverartarchive.org/release-group/\(id)/front-500")
    }

    /// URL to MusicBrainz page
    var musicBrainzURL: URL? {
        URL(string: "https://musicbrainz.org/release-group/\(id)")
    }
}

// MARK: - MusicBrainz Response Decoding

extension Album {
    /// Decode from MusicBrainz release-group API response
    init(from releaseGroup: MusicBrainzReleaseGroup) {
        self.id = releaseGroup.id
        self.title = releaseGroup.title
        self.releaseDate = releaseGroup.firstReleaseDate
        self.primaryType = releaseGroup.primaryType
        self.secondaryTypes = releaseGroup.secondaryTypes
    }
}

/// MusicBrainz release-group response structure
struct MusicBrainzReleaseGroup: Codable, Sendable {
    let id: String
    let title: String
    let primaryType: String?
    let secondaryTypes: [String]?
    let firstReleaseDate: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case primaryType = "primary-type"
        case secondaryTypes = "secondary-types"
        case firstReleaseDate = "first-release-date"
    }
}

/// Response wrapper for release-group browse endpoint
struct MusicBrainzReleaseGroupsResponse: Codable, Sendable {
    let releaseGroups: [MusicBrainzReleaseGroup]
    let releaseGroupCount: Int

    enum CodingKeys: String, CodingKey {
        case releaseGroups = "release-groups"
        case releaseGroupCount = "release-group-count"
    }
}
