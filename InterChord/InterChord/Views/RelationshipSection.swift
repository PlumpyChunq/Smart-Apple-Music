import SwiftUI

/// A section displaying a group of relationships (e.g., "Members (8)").
struct RelationshipSection: View {
    let title: String
    let items: [ArtistDetailViewModel.GroupedItem]
    let onSelect: (Artist) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section header
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)

            // Relationship rows
            VStack(spacing: 0) {
                ForEach(items) { item in
                    RelationshipRow(item: item, onTap: { onSelect(item.artist) })

                    if item.id != items.last?.id {
                        Divider()
                            .padding(.leading, 40)
                    }
                }
            }
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

/// A single row in a relationship section.
struct RelationshipRow: View {
    let item: ArtistDetailViewModel.GroupedItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Artist type icon
                artistIcon
                    .frame(width: 28, height: 28)
                    .background(.quaternary)
                    .clipShape(Circle())

                // Name and details
                VStack(alignment: .leading, spacing: 2) {
                    // Name with badges
                    HStack(spacing: 4) {
                        Text(item.artist.name)
                            .font(.body)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)

                        if item.isFoundingMember {
                            FoundingBadge()
                        }

                        if item.isCurrent {
                            CurrentBadge()
                        }
                    }

                    // Instruments (if any)
                    if !item.instruments.isEmpty {
                        Text(item.instruments.joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                // Tenure badge
                if !item.tenure.isEmpty {
                    Text(item.tenure)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.secondary.opacity(0.1))
                        .clipShape(Capsule())
                }

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Double tap to view details")
    }

    private var artistIcon: some View {
        Image(systemName: iconName)
            .font(.system(size: 14))
            .foregroundStyle(.secondary)
    }

    private var iconName: String {
        switch item.artist.type {
        case .group: return "person.3.fill"
        case .person: return "person.fill"
        case .orchestra: return "music.quarternote.3"
        case .choir: return "person.wave.2.fill"
        default: return "music.note"
        }
    }

    private var accessibilityLabel: String {
        var parts = [item.artist.name]

        if item.isFoundingMember {
            parts.append("founding member")
        }

        if item.isCurrent {
            parts.append("current")
        }

        if !item.tenure.isEmpty {
            parts.append(item.tenure)
        }

        if !item.instruments.isEmpty {
            parts.append(item.instruments.joined(separator: ", "))
        }

        return parts.joined(separator: ", ")
    }
}

/// Small "F" badge indicating founding member.
struct FoundingBadge: View {
    var body: some View {
        Text("F")
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(.purple.opacity(0.2))
            .foregroundStyle(.purple)
            .clipShape(Capsule())
            .help("Founding member")
    }
}

/// Small "C" badge indicating current member.
struct CurrentBadge: View {
    var body: some View {
        Text("C")
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(.green.opacity(0.2))
            .foregroundStyle(.green)
            .clipShape(Capsule())
            .help("Current member")
    }
}

// MARK: - Preview

#Preview {
    let sampleItems = [
        ArtistDetailViewModel.GroupedItem(
            relationship: Relationship(
                type: .memberOf,
                sourceArtistId: "band-id",
                targetArtistId: "john-id",
                attributes: ["vocals", "guitar"],
                begin: "1960",
                end: "1970",
                ended: true
            ),
            artist: Artist(
                id: "john-id",
                name: "John Lennon",
                type: .person,
                country: "GB"
            ),
            isFoundingMember: true,
            isCurrent: false,
            tenure: "1960–1970",
            sortYear: 1960,
            instruments: ["vocals", "guitar"]
        ),
        ArtistDetailViewModel.GroupedItem(
            relationship: Relationship(
                type: .memberOf,
                sourceArtistId: "band-id",
                targetArtistId: "paul-id",
                attributes: ["vocals", "bass"],
                begin: "1960",
                end: "1970",
                ended: true
            ),
            artist: Artist(
                id: "paul-id",
                name: "Paul McCartney",
                type: .person,
                country: "GB"
            ),
            isFoundingMember: true,
            isCurrent: false,
            tenure: "1960–1970",
            sortYear: 1960,
            instruments: ["vocals", "bass"]
        ),
    ]

    return RelationshipSection(
        title: "Members (4)",
        items: sampleItems,
        onSelect: { _ in }
    )
    .padding()
}
