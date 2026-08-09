import Foundation

/// One frame from the desktop's `/api/events` stream.
public struct EventEnvelope: Decodable, Sendable {
    public let seq: UInt64
    public let event: String
    public let payload: JSONValue
}

/// A codex notification: externally tagged as `{ method, params }`.
public struct CodexNotification: Sendable {
    public let method: String
    public let params: JSONValue
}

/// Subscribes to a desktop's event stream, resuming after disconnects.
///
/// iOS suspends network connections when the app is backgrounded, so dropping
/// and resuming is the normal case rather than an error path. Every frame
/// carries a sequence number; reconnecting with `?since=` makes the desktop
/// replay whatever was missed, so backgrounding no longer punches holes in the
/// transcript.
///
/// Sequence numbers are global across agents. Because this client subscribes
/// with `agents=codex`, the numbers it sees have gaps — treat `seq` strictly as
/// an opaque cursor, never as a counter.
public actor EventStream {
    private let desktop: Desktop
    private let agents: [AgentKind]
    private var lastSeq: UInt64?
    private var task: Task<Void, Never>?

    private static let initialRetry: Duration = .milliseconds(500)
    private static let maxRetry: Duration = .seconds(10)

    public init(desktop: Desktop, agents: [AgentKind] = [.codex]) {
        self.desktop = desktop
        self.agents = agents
    }

    /// Starts streaming, delivering every frame to `onEvent` until cancelled.
    public func start(onEvent: @escaping @Sendable (EventEnvelope) async -> Void) {
        task?.cancel()
        task = Task { [weak self] in
            guard let self else { return }
            var retry = EventStream.initialRetry

            while !Task.isCancelled {
                do {
                    try await self.consume(onEvent: onEvent)
                    // A clean end still means the stream is gone (the desktop
                    // closes it when a client lags); reconnect from the cursor.
                    retry = EventStream.initialRetry
                } catch is CancellationError {
                    return
                } catch {
                    // Fall through to the backoff below.
                }

                if Task.isCancelled { return }
                try? await Task.sleep(for: retry)
                retry = min(retry * 2, EventStream.maxRetry)
            }
        }
    }

    public func stop() {
        task?.cancel()
        task = nil
    }

    private func streamURL() throws -> URL {
        var query = [URLQueryItem(name: "agents", value: agents.map(\.rawValue).joined(separator: ","))]
        if let lastSeq {
            query.append(URLQueryItem(name: "since", value: String(lastSeq)))
        }
        // EventSource-style clients cannot set headers, and URLSession's byte
        // stream can — but the token also rides in the query so the same URL
        // works from either transport.
        query.append(URLQueryItem(name: "token", value: desktop.token))
        return try APIClient(desktop: desktop).url(path: "/api/events", query: query)
    }

    private func record(seq: UInt64) {
        lastSeq = seq
    }

    private func consume(onEvent: @escaping @Sendable (EventEnvelope) async -> Void) async throws {
        var request = URLRequest(url: try streamURL())
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.timeoutInterval = .infinity
        request = APIClient(desktop: desktop).authorized(request)

        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 401 {
            throw APIError.unauthorized
        }

        for try await line in bytes.lines {
            try Task.checkCancellation()
            // SSE frames are `data: {...}`; keep-alive comments start with ':'.
            guard let json = line.hasPrefix("data:") ? String(line.dropFirst(5)) : nil else {
                continue
            }
            let trimmed = json.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else { continue }

            guard let envelope = try? JSONDecoder().decode(EventEnvelope.self, from: data) else {
                continue
            }
            record(seq: envelope.seq)
            await onEvent(envelope)
        }
    }
}

public extension EventEnvelope {
    /// Unwraps a `codex:notification` frame into its method and params.
    var codexNotification: CodexNotification? {
        guard event == "codex:notification",
              case let .object(fields) = payload,
              case let .string(method)? = fields["method"]
        else { return nil }
        return CodexNotification(method: method, params: fields["params"] ?? .null)
    }
}
