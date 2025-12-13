import Foundation

#if os(macOS)
import AppKit

/// Platform type alias for colors
public typealias PlatformColor = NSColor

extension NSColor {
    /// Compatibility shim for iOS-style semantic colors
    public static var label: NSColor { .labelColor }
    public static var secondaryLabel: NSColor { .secondaryLabelColor }
    public static var systemBackground: NSColor { .windowBackgroundColor }
    public static var secondarySystemBackground: NSColor { .controlBackgroundColor }
}

/// Platform type alias for images
public typealias PlatformImage = NSImage

#else
import UIKit

/// Platform type alias for colors
public typealias PlatformColor = UIColor

/// Platform type alias for images
public typealias PlatformImage = UIImage

#endif
