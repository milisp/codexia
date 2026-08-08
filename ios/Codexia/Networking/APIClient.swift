import Foundation

public enum APIError: LocalizedError {
    case notPaired
    case badURL
    case unauthorized
    case server(status: Int, message: String)

    public var errorDescription: String? {
        switch self {
        case .notPaired:
            return "No desktop selected."
        case .badURL:
            return "The desktop address is not a valid URL."
        case .unauthorized:
            return "The desktop rejected this device's token. Re-pair from its settings screen."
        case let .server(status, message):
            return message.isEmpty ? "Request failed (\(status))." : message
        }
    }
}

public extension URLSession {
    /// The session every request to a desktop goes through.
    ///
    /// `URLSession.shared` waits 60 seconds before giving up, which is what made
    /// a wrong hostname or a sleeping machine feel like the app had hung. A
    /// tailnet round trip that has not answered in 15 seconds is not going to.
    static let codexia: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()
}

/// Talks to a paired desktop's app-server.
///
/// Every request carries the device token; the desktop only exempts loopback,
/// which never applies to a phone.
public struct APIClient: Sendable {
    public let desktop: Desktop
    private let session: URLSession

    public init(desktop: Desktop, session: URLSession = .codexia) {
        self.desktop = desktop
        self.session = session
    }

    func url(path: String, query: [URLQueryItem] = []) throws -> URL {
        guard let base = desktop.baseURL,
              var components = URLComponents(url: base, resolvingAgainstBaseURL: false)
        else { throw APIError.badURL }

        components.path = path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw APIError.badURL }
        return url
    }

    func authorized(_ request: URLRequest) -> URLRequest {
        var request = request
        request.setValue("Bearer \(desktop.token)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: authorized(request))
        guard let http = response as? HTTPURLResponse else { return data }

        switch http.statusCode {
        case 200..<300:
            return data
        case 401:
            throw APIError.unauthorized
        default:
            // The desktop reports failures as {"error": "..."}.
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError.server(status: http.statusCode, message: message ?? "")
        }
    }

    private func post(_ path: String, body: [String: Any]) async throws -> Data {
        var request = URLRequest(url: try url(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(request)
    }

    private func get(_ path: String, query: [URLQueryItem] = []) async throws -> Data {
        try await send(URLRequest(url: try url(path: path, query: query)))
    }

    private func json(_ data: Data) -> JSONValue {
        (try? JSONDecoder().decode(JSONValue.self, from: data)) ?? .null
    }

    // MARK: - Reachability

    /// `/health` is the one endpoint served without a token, so it separates
    /// "desktop is unreachable" from "desktop rejected this device".
    ///
    /// Returns the underlying failure rather than a bare `false`: the reasons
    /// (ATS blocking cleartext, TLS against a plaintext server, no route) are
    /// indistinguishable to the user but obvious in the error.
    public func reachabilityFailure() async -> String? {
        guard let url = try? url(path: "/health") else { return "invalid URL for host \(desktop.host)" }
        do {
            let (_, response) = try await session.data(from: url)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            return status == 200 ? nil : "HTTP \(status)"
        } catch {
            let ns = error as NSError
            return "\(ns.localizedDescription) [\(ns.domain) \(ns.code)]"
        }
    }

    public func isReachable() async -> Bool {
        await reachabilityFailure() == nil
    }

    // MARK: - Sessions

    /// Lists the sessions belonging to `agent`. The two backends store threads
    /// separately, so the phone queries whichever one the user is browsing
    /// rather than merging both into one list.
    public func listSessions(agent: AgentKind) async throws -> [AgentSession] {
        switch agent {
        case .codex:
            let data = try await post("/api/codex/thread/list", body: ["pageSize": 50])
            return ThreadListDecoder.decode(data)
        case .cc:
            let data = try await get(
                "/api/cc/sessions",
                query: [
                    URLQueryItem(name: "offset", value: "0"),
                    URLQueryItem(name: "includeWorktrees", value: "true"),
                ]
            )
            return CCSessionListDecoder.decode(data)
        }
    }

    /// Models the desktop offers for `agent`.
    public func listModels(agent: AgentKind) async throws -> [AgentModel] {
        switch agent {
        case .codex:
            let response = json(try await get("/api/codex/model/list"))
            return (response["data"]?.arrayValue ?? []).compactMap { model in
                guard let id = model["id"]?.stringValue, model["hidden"] != .bool(true) else {
                    return nil
                }
                return AgentModel(id: id, displayName: model["displayName"]?.stringValue ?? id)
            }
        case .cc:
            return AgentModel.ccModels
        }
    }

    /// Creates a session in `cwd` and returns it ready to open.
    public func createSession(
        agent: AgentKind,
        cwd: String,
        options: AgentOptions
    ) async throws -> AgentSession {
        switch agent {
        case .codex:
            let mode = options.codexMode ?? .workspaceWrite
            var body: [String: Any] = [
                "cwd": cwd,
                "approvalPolicy": mode.approvalPolicy,
                "sandbox": mode.sandbox,
            ]
            if let model = options.model { body["model"] = model }
            if let config = codexConfig(mode: mode, model: options.model) {
                body["config"] = config
            }
            let response = json(try await post("/api/codex/thread/start", body: body))
            guard let id = response.path("thread", "id")?.stringValue
                ?? response["threadId"]?.stringValue
                ?? response["id"]?.stringValue
            else { throw APIError.server(status: 200, message: "Desktop did not return a thread id.") }
            return AgentSession(id: id, agent: .codex, title: "New thread", cwd: cwd, updatedAt: Date())

        case .cc:
            var agentOptions: [String: Any] = [
                "cwd": cwd,
                "permissionMode": (options.ccMode ?? .ask).rawValue,
            ]
            if let model = options.model { agentOptions["model"] = model }
            // The desktop replies with a bare JSON string holding the new id.
            let response = json(try await post("/api/cc/new-session", body: ["options": agentOptions]))
            guard let id = response.stringValue else {
                throw APIError.server(status: 200, message: "Desktop did not return a session id.")
            }
            return AgentSession(id: id, agent: .cc, title: "New session", cwd: cwd, updatedAt: Date())
        }
    }

    /// Reattaches to an existing session and returns its transcript so far.
    ///
    /// Both backends need the resume call before they will accept a turn; codex
    /// returns the history inline, while cc exposes it as a separate read.
    public func resume(session: AgentSession, options: AgentOptions) async throws -> [TranscriptItem] {
        switch session.agent {
        case .codex:
            let mode = options.codexMode ?? .workspaceWrite
            var body: [String: Any] = [
                "threadId": session.id,
                "approvalPolicy": mode.approvalPolicy,
                "sandbox": mode.sandbox,
            ]
            if let model = options.model { body["model"] = model }
            if let config = codexConfig(mode: mode, model: options.model) {
                body["config"] = config
            }
            let data = try await post("/api/codex/thread/resume", body: body)
            return CodexHistoryDecoder.decode(json(data))
        case .cc:
            var agentOptions: [String: Any] = [
                "resume": session.id,
                "continueConversation": true,
                "permissionMode": (options.ccMode ?? .ask).rawValue,
            ]
            if let cwd = session.cwd { agentOptions["cwd"] = cwd }
            if let model = options.model { agentOptions["model"] = model }
            _ = try await post(
                "/api/cc/resume-session",
                body: ["session_id": session.id, "options": agentOptions]
            )
            let data = try await post("/api/cc/session-messages", body: ["session_id": session.id])
            return CCHistoryDecoder.decode(json(data))
        }
    }

    // MARK: - Turns

    public func startTurn(session: AgentSession, text: String) async throws {
        switch session.agent {
        case .codex:
            _ = try await post(
                "/api/codex/turn/start",
                body: [
                    "threadId": session.id,
                    "input": [["type": "text", "text": text]],
                ]
            )
        case .cc:
            _ = try await post(
                "/api/cc/send-message",
                body: ["session_id": session.id, "message": text, "image_paths": []]
            )
        }
    }

    public func interrupt(session: AgentSession) async throws {
        switch session.agent {
        case .codex:
            _ = try await post("/api/codex/turn/interrupt", body: ["threadId": session.id])
        case .cc:
            _ = try await post("/api/cc/interrupt", body: ["session_id": session.id])
        }
    }

    /// Changes the permission mode of a live cc session.
    ///
    /// Only cc can do this mid-session; codex fixes its approval policy when the
    /// thread starts, so there a change takes effect on the next resume.
    public func setCCPermissionMode(sessionId: String, mode: CCPermissionMode) async throws {
        _ = try await post(
            "/api/cc/set-permission-mode",
            body: ["session_id": sessionId, "mode": mode.rawValue]
        )
    }

    /// Plan mode is not a sandbox but a collaboration mode carried in the thread
    /// config, the same shape the desktop sends. Every other mode needs no config.
    private func codexConfig(mode: CodexMode, model: String?) -> [String: Any]? {
        guard mode == .plan else { return nil }
        var settings: [String: Any] = ["developer_instructions": NSNull()]
        if let model { settings["model"] = model }
        return ["collaboration_mode": ["mode": "plan", "settings": settings]]
    }

    // MARK: - Approvals

    public enum ApprovalDecision: String, Sendable {
        case approved
        case denied

        /// cc names the same two outcomes differently.
        var ccValue: String {
            self == .approved ? "allow" : "deny"
        }
    }

    public func respondToCommandApproval(
        requestId: Int,
        decision: ApprovalDecision
    ) async throws {
        _ = try await post(
            "/api/codex/approval/command-execution",
            body: ["requestId": requestId, "decision": decision.rawValue]
        )
    }

    public func respondToFileChangeApproval(
        requestId: Int,
        decision: ApprovalDecision
    ) async throws {
        _ = try await post(
            "/api/codex/approval/file-change",
            body: ["requestId": requestId, "decision": decision.rawValue]
        )
    }

    public func respondToCCPermission(
        requestId: String,
        decision: ApprovalDecision
    ) async throws {
        _ = try await post(
            "/api/cc/resolve-permission",
            body: ["request_id": requestId, "decision": decision.ccValue]
        )
    }
}

/// Pulls the session list out of the thread/list response.
///
/// The generated `ThreadListResponse` covers the full protocol shape; the list
/// screen only needs four fields, so decoding leniently here keeps the UI
/// working across upstream additions.
enum ThreadListDecoder {
    private struct Envelope: Decodable {
        let threads: [Thread]?
        let data: [Thread]?

        struct Thread: Decodable {
            let id: String
            let name: String?
            let cwd: String?
            let updatedAt: Double?
        }

        var all: [Thread] { threads ?? data ?? [] }
    }

    static func decode(_ data: Data) -> [AgentSession] {
        guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else {
            return []
        }
        return envelope.all.map { thread in
            AgentSession(
                id: thread.id,
                agent: .codex,
                title: thread.name?.isEmpty == false ? thread.name! : "Untitled",
                cwd: thread.cwd,
                updatedAt: thread.updatedAt.map { Date(timeIntervalSince1970: $0) }
            )
        }
    }
}

/// Pulls the session list out of the cc `/api/cc/sessions` response.
enum CCSessionListDecoder {
    private struct Envelope: Decodable {
        let sessions: [Session]

        struct Session: Decodable {
            let sessionId: String
            let summary: String
            let customTitle: String?
            let cwd: String?
            let lastModified: Int64

            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case summary
                case customTitle = "custom_title"
                case cwd
                case lastModified = "last_modified"
            }
        }
    }

    static func decode(_ data: Data) -> [AgentSession] {
        guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else {
            return []
        }
        return envelope.sessions.map { session in
            let title = session.customTitle?.isEmpty == false ? session.customTitle! : session.summary
            return AgentSession(
                id: session.sessionId,
                agent: .cc,
                title: title.isEmpty ? "Untitled" : title,
                cwd: session.cwd,
                updatedAt: Date(timeIntervalSince1970: Double(session.lastModified) / 1000)
            )
        }
    }
}
