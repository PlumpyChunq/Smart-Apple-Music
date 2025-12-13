import Foundation
import SwiftData

/// SwiftData model for persisting favorite artists.
/// Stores essential artist info for quick access without API calls.
@Model
final class FavoriteArtist {
    /// MusicBrainz ID - unique identifier
    @Attribute(.unique) var mbid: String

    /// Artist's display name
    var name: String

    /// Artist type (person, group, etc.)
    var artistType: String

    /// User-assigned or auto-detected genre category
    var genre: String?

    /// When the artist was added to favorites
    var addedAt: Date

    /// Cached image URL for quick display
    var imageUrl: String?

    /// Country code (ISO 3166-1 alpha-2)
    var country: String?

    /// Disambiguation text
    var disambiguation: String?

    init(
        mbid: String,
        name: String,
        artistType: String,
        genre: String? = nil,
        addedAt: Date = Date(),
        imageUrl: String? = nil,
        country: String? = nil,
        disambiguation: String? = nil
    ) {
        self.mbid = mbid
        self.name = name
        self.artistType = artistType
        self.genre = genre
        self.addedAt = addedAt
        self.imageUrl = imageUrl
        self.country = country
        self.disambiguation = disambiguation
    }

    /// Create from an Artist model
    convenience init(from artist: Artist, genre: String? = nil) {
        self.init(
            mbid: artist.id,
            name: artist.name,
            artistType: artist.type?.rawValue ?? "Other",
            genre: genre,
            country: artist.country,
            disambiguation: artist.disambiguation
        )
    }

    /// Convert to Artist for use with existing views
    func toArtist() -> Artist {
        Artist(
            id: mbid,
            name: name,
            disambiguation: disambiguation,
            type: ArtistType(rawValue: artistType),
            country: country
        )
    }
}

// MARK: - Genre Categories

extension FavoriteArtist {
    /// Default genre categories matching web app
    static let defaultGenres = [
        "Rock",
        "Pop",
        "Hip-Hop",
        "R&B/Soul",
        "Electronic",
        "Jazz",
        "Classical",
        "Country",
        "Folk",
        "Metal",
        "Punk/Hardcore",
        "Indie/Alternative",
        "Latin",
        "World",
        "New Wave",
        "Other"
    ]
}
