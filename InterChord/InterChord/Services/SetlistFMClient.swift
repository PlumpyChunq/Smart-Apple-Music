import Foundation

/// Thread-safe Setlist.fm API client using Swift actor.
/// Proxies requests through the InterChord web app API to handle CORS and API keys.
actor SetlistFMClient {
    // MARK: - Types

    enum ClientError: Error, LocalizedError {
        case invalidURL
        case networkError(Error)
        case decodingError(Error)
        case serverUnreachable
        case noResults

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid URL"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .decodingError(let error):
                return "Failed to parse response: \(error.localizedDescription)"
            case .serverUnreachable:
                return "Server is unreachable"
            case .noResults:
                return "No concerts found"
            }
        }
    }

    /// Response format from InterChord web app /api/concerts
    private struct WebAppConcert: Codable {
        let id: String
        let datetime: String  // yyyy-MM-dd format
        let venue: WebAppVenue
        let title: String?
        let url: String?
    }

    private struct WebAppVenue: Codable {
        let name: String
        let city: String
        let region: String?
        let country: String
    }

    // MARK: - Configuration

    /// InterChord web app API base URL (proxies Setlist.fm)
    private let webAppBaseURL: URL

    /// Cache for concert data (30 minute TTL)
    private var cache: [String: CachedConcerts] = [:]
    private let cacheTTL: TimeInterval = 30 * 60 // 30 minutes

    // MARK: - URLSession

    private let session: URLSession

    // MARK: - Initialization

    init(
        webAppBaseURL: URL = URL(string: "http://stonefrog-db01.stonefrog.com:3000")!,
        session: URLSession = .shared
    ) {
        self.webAppBaseURL = webAppBaseURL
        self.session = session
    }

    // MARK: - Public API

    /// Fetch recent concerts for an artist by MusicBrainz ID.
    /// - Parameters:
    ///   - mbid: MusicBrainz artist ID
    ///   - limit: Maximum number of concerts to return (default: 10)
    /// - Returns: Array of recent concerts
    func fetchConcerts(mbid: String, limit: Int = 10) async throws -> [Concert] {
        // Check cache first
        if let cached = cache[mbid], !cached.isExpired {
            return Array(cached.concerts.prefix(limit))
        }

        // Build URL: /api/concerts?mbid=<mbid>
        var urlComponents = URLComponents(url: webAppBaseURL, resolvingAgainstBaseURL: false)!
        urlComponents.path = "/api/concerts"
        urlComponents.queryItems = [
            URLQueryItem(name: "mbid", value: mbid)
        ]

        guard let url = urlComponents.url else {
            throw ClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("InterChord-Native/1.0", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        do {
            let (data, response) = try await session.data(for: request)

            // Check for HTTP errors
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                throw ClientError.serverUnreachable
            }

            // Decode web app response format
            let decoder = JSONDecoder()
            let webAppConcerts = try decoder.decode([WebAppConcert].self, from: data)

            // Convert to our Concert model
            let concerts = webAppConcerts.map { convertToConcert($0) }

            // Cache the results
            cache[mbid] = CachedConcerts(concerts: concerts, fetchedAt: Date())

            return Array(concerts.prefix(limit))
        } catch let error as ClientError {
            throw error
        } catch let error as DecodingError {
            throw ClientError.decodingError(error)
        } catch {
            throw ClientError.networkError(error)
        }
    }

    /// Convert web app concert format to native Concert model
    private func convertToConcert(_ webConcert: WebAppConcert) -> Concert {
        // Convert yyyy-MM-dd to dd-MM-yyyy for Concert model
        let dateParts = webConcert.datetime.split(separator: "-")
        let eventDateString: String
        if dateParts.count == 3 {
            eventDateString = "\(dateParts[2])-\(dateParts[1])-\(dateParts[0])"
        } else {
            eventDateString = webConcert.datetime
        }

        let city = City(
            id: nil,
            name: webConcert.venue.city,
            state: webConcert.venue.region,
            country: Country(code: "", name: webConcert.venue.country)
        )

        let venue = Venue(
            id: nil,
            name: webConcert.venue.name,
            city: city
        )

        let tour = webConcert.title.flatMap { $0.isEmpty ? nil : Tour(name: $0) }

        return Concert(
            id: webConcert.id,
            eventDateString: eventDateString,
            venue: venue,
            tour: tour,
            url: webConcert.url
        )
    }

    /// Clear the concert cache.
    func clearCache() {
        cache.removeAll()
    }

    /// Clear expired entries from cache.
    func pruneCache() {
        let now = Date()
        cache = cache.filter { !$0.value.isExpired(at: now) }
    }

    // MARK: - Cache Types

    private struct CachedConcerts {
        let concerts: [Concert]
        let fetchedAt: Date

        var isExpired: Bool {
            isExpired(at: Date())
        }

        func isExpired(at date: Date) -> Bool {
            date.timeIntervalSince(fetchedAt) > 30 * 60 // 30 minutes
        }
    }
}

// MARK: - Shared Instance

extension SetlistFMClient {
    /// Shared client instance for convenience
    static let shared = SetlistFMClient()
}
