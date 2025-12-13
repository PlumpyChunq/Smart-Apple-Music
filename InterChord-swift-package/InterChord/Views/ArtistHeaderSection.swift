import SwiftUI

/// Header section showing artist name, type, country, and active years.
struct ArtistHeaderSection: View {
    let artist: Artist
    @State private var isFavorite = false

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Artist image placeholder
            artistIcon

            VStack(alignment: .leading, spacing: 6) {
                // Name and favorite button
                HStack(spacing: 8) {
                    Text(artist.name)
                        .font(.title)
                        .fontWeight(.bold)

                    Button(action: { isFavorite.toggle() }) {
                        Image(systemName: isFavorite ? "star.fill" : "star")
                            .foregroundStyle(isFavorite ? .yellow : .secondary)
                    }
                    .buttonStyle(.plain)
                    .help(isFavorite ? "Remove from favorites" : "Add to favorites")
                }

                // Disambiguation
                if let disambiguation = artist.disambiguation, !disambiguation.isEmpty {
                    Text(disambiguation)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // Badges row
                HStack(spacing: 8) {
                    ArtistTypeBadge(type: artist.type)

                    if let country = artist.country {
                        CountryBadge(code: country)
                    }

                    if let lifeSpan = artist.lifeSpan {
                        ActiveYearsBadge(lifeSpan: lifeSpan)
                    }
                }
            }

            Spacer()
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private var artistIcon: some View {
        ZStack {
            Circle()
                .fill(.quaternary)
                .frame(width: 80, height: 80)

            Image(systemName: iconName)
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
        }
    }

    private var iconName: String {
        switch artist.type {
        case .group: return "person.3.fill"
        case .person: return "person.fill"
        case .orchestra: return "music.quarternote.3"
        case .choir: return "person.wave.2.fill"
        default: return "music.note"
        }
    }
}

// MARK: - Badge Components

/// Badge showing artist type (Person, Group, etc.)
struct ArtistTypeBadge: View {
    let type: ArtistType?

    var body: some View {
        if let type = type {
            Text(type.rawValue)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(backgroundColor.opacity(0.2))
                .foregroundStyle(backgroundColor)
                .clipShape(Capsule())
        }
    }

    private var backgroundColor: Color {
        switch type {
        case .group: return .blue
        case .person: return .green
        case .orchestra: return .purple
        case .choir: return .pink
        default: return .gray
        }
    }
}

/// Badge showing country flag and code.
struct CountryBadge: View {
    let code: String

    var body: some View {
        HStack(spacing: 4) {
            Text(countryFlag)
            Text(code)
        }
        .font(.caption)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.secondary.opacity(0.1))
        .clipShape(Capsule())
    }

    private var countryFlag: String {
        let base: UInt32 = 127397
        var flag = ""
        for scalar in code.uppercased().unicodeScalars {
            if let unicode = UnicodeScalar(base + scalar.value) {
                flag.append(String(unicode))
            }
        }
        return flag.isEmpty ? code : flag
    }
}

/// Badge showing active years (e.g., "1960–1970" or "1990–present").
struct ActiveYearsBadge: View {
    let lifeSpan: LifeSpan

    var body: some View {
        Text(formattedYears)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(.secondary.opacity(0.1))
            .clipShape(Capsule())
    }

    private var formattedYears: String {
        guard let begin = lifeSpan.begin else { return "" }

        let startYear = String(begin.prefix(4))

        if let end = lifeSpan.end {
            let endYear = String(end.prefix(4))
            return startYear == endYear ? startYear : "\(startYear)–\(endYear)"
        }

        if lifeSpan.ended == true {
            return startYear
        }

        return "\(startYear)–present"
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        ArtistHeaderSection(
            artist: Artist(
                id: "1",
                name: "The Beatles",
                disambiguation: "English rock band from Liverpool",
                type: .group,
                country: "GB",
                lifeSpan: LifeSpan(begin: "1960", end: "1970", ended: true)
            )
        )

        ArtistHeaderSection(
            artist: Artist(
                id: "2",
                name: "Paul McCartney",
                disambiguation: "former member of The Beatles",
                type: .person,
                country: "GB",
                lifeSpan: LifeSpan(begin: "1942", end: nil, ended: false)
            )
        )
    }
    .padding()
}
