import Foundation

/// A single rendered line in a session transcript.
///
/// The desktop streams the full codex protocol; this is the flattened shape the
/// phone actually displays. Kept deliberately small — a thin client shows who
/// said what and which tools ran, not the entire item union.
public struct TranscriptItem: Identifiable, Hashable, Sendable {
    public enum Role: String, Sendable {
        case user
        case assistant
        case reasoning
        case tool
        case error
    }

    public let id: String
    public let role: Role
    public var text: String
    /// Populated for `.tool` items, e.g. the command that ran.
    public var detail: String?
    /// False while content is still streaming in.
    public var isComplete: Bool

    public init(
        id: String,
        role: Role,
        text: String,
        detail: String? = nil,
        isComplete: Bool = true
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.detail = detail
        self.isComplete = isComplete
    }
}

/// Ordered transcript with in-place updates for streaming deltas.
public struct Transcript: Sendable {
    public private(set) var items: [TranscriptItem] = []
    private var indexByID: [String: Int] = [:]

    public init() {}

    /// Appends `delta` to an existing item, creating it if this is the first
    /// chunk. Streaming arrives as many small deltas per item, so appending in
    /// place avoids rebuilding the list on every frame.
    public mutating func appendDelta(id: String, role: TranscriptItem.Role, delta: String) {
        if let index = indexByID[id] {
            items[index].text += delta
            items[index].isComplete = false
        } else {
            indexByID[id] = items.count
            items.append(TranscriptItem(id: id, role: role, text: delta, isComplete: false))
        }
    }

    public mutating func upsert(_ item: TranscriptItem) {
        if let index = indexByID[item.id] {
            items[index] = item
        } else {
            indexByID[item.id] = items.count
            items.append(item)
        }
    }

    public mutating func markComplete(id: String) {
        guard let index = indexByID[id] else { return }
        items[index].isComplete = true
    }

    public mutating func removeAll() {
        items.removeAll()
        indexByID.removeAll()
    }
}
