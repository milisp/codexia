import Foundation

/// A decoded JSON value of unknown shape.
///
/// The event stream carries the whole codex notification union. Rather than
/// decode ~70 payload types the phone does not render, frames are decoded
/// loosely and only the handful of fields the UI needs are read out. The
/// generated types in `Generated/CodexProtocol.swift` remain available for
/// anything that warrants full typing.
public enum JSONValue: Decodable, Sendable, Hashable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    // MARK: - Accessors

    public subscript(key: String) -> JSONValue? {
        guard case let .object(fields) = self else { return nil }
        return fields[key]
    }

    public var stringValue: String? {
        guard case let .string(value) = self else { return nil }
        return value
    }

    public var intValue: Int? {
        guard case let .number(value) = self else { return nil }
        return Int(value)
    }

    public var arrayValue: [JSONValue]? {
        guard case let .array(value) = self else { return nil }
        return value
    }

    /// Reads a nested value, e.g. `payload.path("item", "id")`.
    public func path(_ keys: String...) -> JSONValue? {
        var current: JSONValue? = self
        for key in keys {
            current = current?[key]
        }
        return current
    }
}
