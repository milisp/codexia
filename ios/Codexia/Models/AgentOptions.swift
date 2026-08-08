import Foundation

/// How much a cc session may do before it stops to ask.
///
/// These are cc's own permission modes, sent verbatim as `permissionMode`.
public enum CCPermissionMode: String, Codable, CaseIterable, Sendable {
    case ask = "default"
    case acceptEdits
    case plan
    case bypassPermissions
}

/// What a codex thread may reach.
///
/// codex has no single mode field: `plan` is a collaboration mode carried in the
/// thread config, and the other three are sandboxes that each imply an approval
/// policy, exactly as the desktop's access-mode menu does it.
public enum CodexMode: String, Codable, CaseIterable, Sendable {
    case plan
    case readOnly = "read-only"
    case workspaceWrite = "workspace-write"
    case dangerFullAccess = "danger-full-access"

    /// The sandbox to start the thread with. Plan mode still needs one; reads are
    /// all a plan should require.
    var sandbox: String {
        switch self {
        case .plan, .readOnly: return "read-only"
        case .workspaceWrite: return "workspace-write"
        case .dangerFullAccess: return "danger-full-access"
        }
    }

    /// Mirrors the desktop's SANDBOX_APPROVAL_MAP.
    var approvalPolicy: String {
        switch self {
        case .plan, .readOnly: return "untrusted"
        case .workspaceWrite: return "on-request"
        case .dangerFullAccess: return "never"
        }
    }
}

/// The mode of whichever agent a session belongs to.
///
/// The two backends do not share a vocabulary, so neither does the phone: each
/// case carries its own agent's spelling rather than a shared four-way guess.
public enum AgentMode: Hashable, Sendable {
    case cc(CCPermissionMode)
    case codex(CodexMode)

    public var agent: AgentKind {
        switch self {
        case .cc: return .cc
        case .codex: return .codex
        }
    }

    public var rawValue: String {
        switch self {
        case .cc(let mode): return mode.rawValue
        case .codex(let mode): return mode.rawValue
        }
    }

    public init?(rawValue: String, agent: AgentKind) {
        switch agent {
        case .cc:
            guard let mode = CCPermissionMode(rawValue: rawValue) else { return nil }
            self = .cc(mode)
        case .codex:
            guard let mode = CodexMode(rawValue: rawValue) else { return nil }
            self = .codex(mode)
        }
    }

    public static func `default`(for agent: AgentKind) -> AgentMode {
        switch agent {
        case .cc: return .cc(.ask)
        case .codex: return .codex(.workspaceWrite)
        }
    }

    public static func all(for agent: AgentKind) -> [AgentMode] {
        switch agent {
        case .cc: return CCPermissionMode.allCases.map(AgentMode.cc)
        case .codex: return CodexMode.allCases.map(AgentMode.codex)
        }
    }

    public var displayName: String {
        switch self {
        case .cc(.ask): return "Ask Permission"
        case .cc(.acceptEdits): return "Accept Edits"
        case .cc(.plan): return "Plan Mode"
        case .cc(.bypassPermissions): return "Bypass All"
        case .codex(.plan): return "Plan Mode"
        case .codex(.readOnly): return "Ask Approval"
        case .codex(.workspaceWrite): return "Approval For Me"
        case .codex(.dangerFullAccess): return "Full Access"
        }
    }

    public var icon: String {
        switch self {
        case .cc(.ask), .codex(.readOnly): return "hand.raised"
        case .cc(.acceptEdits), .codex(.workspaceWrite): return "square.and.pencil"
        case .cc(.plan), .codex(.plan): return "list.bullet.clipboard"
        case .cc(.bypassPermissions), .codex(.dangerFullAccess): return "exclamationmark.triangle"
        }
    }
}

/// A model the desktop offers for a given agent.
public struct AgentModel: Identifiable, Hashable, Sendable {
    public let id: String
    public let displayName: String

    public init(id: String, displayName: String) {
        self.id = id
        self.displayName = displayName
    }

    /// cc takes short aliases rather than a catalog id, and the desktop hardcodes
    /// the same three, so the phone mirrors that list instead of inventing one.
    static let ccModels = [
        AgentModel(id: "sonnet", displayName: "Sonnet"),
        AgentModel(id: "haiku", displayName: "Haiku"),
        AgentModel(id: "opus", displayName: "Opus"),
    ]
}

/// Per-agent session settings, applied when a session is created or resumed.
///
/// The mode is stored by raw value so a stored setting from one agent can never
/// be read back as the other's.
public struct AgentOptions: Codable, Hashable, Sendable {
    public var agent: AgentKind
    public var modeRawValue: String
    /// `nil` leaves the desktop's own default in place.
    public var model: String?

    public init(agent: AgentKind, mode: AgentMode? = nil, model: String? = nil) {
        self.agent = agent
        self.modeRawValue = (mode ?? .default(for: agent)).rawValue
        self.model = model
    }

    public var mode: AgentMode {
        get { AgentMode(rawValue: modeRawValue, agent: agent) ?? .default(for: agent) }
        set { modeRawValue = newValue.rawValue }
    }

    var ccMode: CCPermissionMode? {
        if case .cc(let mode) = mode { return mode }
        return nil
    }

    var codexMode: CodexMode? {
        if case .codex(let mode) = mode { return mode }
        return nil
    }
}
