import Foundation

/// Which agent backend a session belongs to.
///
/// Only `codex` is wired up today. The discriminator exists from the start so
/// adding Claude Code later is a new case rather than a reshape of every model
/// and view — the desktop event stream already namespaces both.
public enum AgentKind: String, Codable, Sendable, CaseIterable {
    case codex
    case cc

    public var displayName: String {
        switch self {
        case .codex: return "Codex"
        case .cc: return "Claude Code"
        }
    }
}

/// A desktop this phone has been paired with.
///
/// Hosts are MagicDNS names (`codexia-mac.tail1234.ts.net`), which Tailscale
/// keeps stable across restarts, so a pairing stays valid indefinitely.
public struct Desktop: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    public var host: String
    public var port: Int
    /// Device token issued by the desktop. Read from its settings screen.
    public var token: String
    /// The desktop serves plain HTTP on the tailnet; WireGuard already encrypts
    /// the hop. TLS is opt-in for users who front the server with
    /// `tailscale serve`.
    public var useTLS: Bool

    public init(
        id: UUID = UUID(),
        name: String,
        host: String,
        port: Int = 7420,
        token: String,
        useTLS: Bool = false
    ) {
        self.id = id
        self.name = name
        self.host = host
        self.port = port
        self.token = token
        self.useTLS = useTLS
    }

    public var baseURL: URL? {
        var components = URLComponents()
        components.scheme = useTLS ? "https" : "http"
        components.host = host
        // Tailscale Serve sits on the default HTTPS port; anything else needs
        // the port spelled out.
        components.port = (useTLS && port == 443) ? nil : port
        return components.url
    }
}

/// A codex thread (or, later, a cc session) as shown in the session list.
public struct AgentSession: Identifiable, Hashable, Sendable {
    public let id: String
    public let agent: AgentKind
    public let title: String
    public let cwd: String?
    public let updatedAt: Date?

    public init(id: String, agent: AgentKind, title: String, cwd: String?, updatedAt: Date?) {
        self.id = id
        self.agent = agent
        self.title = title
        self.cwd = cwd
        self.updatedAt = updatedAt
    }
}

/// The sessions of one working directory, as shown under a collapsible header.
public struct SessionProject: Identifiable, Hashable, Sendable {
    /// Working directory; empty when the desktop reported none.
    public let path: String
    public let sessions: [AgentSession]

    public var id: String { path }

    public var name: String {
        path.isEmpty ? "Unknown project" : (path as NSString).lastPathComponent
    }

    public var lastActivity: Date? {
        sessions.compactMap(\.updatedAt).max()
    }

    public init(path: String, sessions: [AgentSession]) {
        self.path = path
        self.sessions = sessions
    }
}
