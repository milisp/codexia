// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let threadListParams = try ThreadListParams(json)
//   let threadListResponse = try ThreadListResponse(json)
//   let threadStartParams = try ThreadStartParams(json)
//   let threadResumeParams = try ThreadResumeParams(json)
//   let threadStatusChangedNotification = try ThreadStatusChangedNotification(json)
//   let threadTokenUsageUpdatedNotification = try ThreadTokenUsageUpdatedNotification(json)
//   let turnStartParams = try TurnStartParams(json)
//   let turnStartedNotification = try TurnStartedNotification(json)
//   let turnCompletedNotification = try TurnCompletedNotification(json)
//   let turnInterruptParams = try TurnInterruptParams(json)
//   let agentMessageDeltaNotification = try AgentMessageDeltaNotification(json)
//   let itemStartedNotification = try ItemStartedNotification(json)
//   let itemCompletedNotification = try ItemCompletedNotification(json)
//   let reasoningSummaryTextDeltaNotification = try ReasoningSummaryTextDeltaNotification(json)
//   let errorNotification = try ErrorNotification(json)

import Foundation

// MARK: - ThreadListParams
public struct ThreadListParams: Codable {
    /// Optional archived filter; when set to true, only archived threads are returned. If false
    /// or null, only non-archived threads are returned.
    public let archived: Bool?
    /// Opaque pagination cursor returned by a previous call.
    public let cursor: String?
    /// Optional cwd filter or filters; when set, only threads whose session cwd exactly matches
    /// one of these paths are returned.
    public let cwd: ThreadListCwdFilter?
    /// Optional page size; defaults to a reasonable server-side value.
    public let limit: Int?
    /// Optional provider filter; when set, only sessions recorded under these providers are
    /// returned. When present but empty, includes all providers.
    public let modelProviders: [String]?
    /// Optional substring filter for the extracted thread title.
    public let searchTerm: String?
    /// Omit to include every section, set to `null` for unsectioned threads, or provide a
    /// section ID to return only threads in that section.
    public let sectionID: String?
    /// Optional sort direction; defaults to descending (newest first).
    public let sortDirection: SortDirection?
    /// Optional sort key; defaults to created_at.
    public let sortKey: ThreadSortKey?
    /// Optional source filter; when set, only sessions from these source kinds are returned.
    /// When omitted or empty, defaults to interactive sources.
    public let sourceKinds: [ThreadSourceKind]?
    /// If true, return from the state DB without scanning JSONL rollouts to repair thread
    /// metadata. Omitted or false preserves scan-and-repair behavior.
    public let useStateDBOnly: Bool?

    public enum CodingKeys: String, CodingKey {
        case archived, cursor, cwd, limit, modelProviders, searchTerm
        case sectionID = "sectionId"
        case sortDirection, sortKey, sourceKinds
        case useStateDBOnly = "useStateDbOnly"
    }

    public init(archived: Bool?, cursor: String?, cwd: ThreadListCwdFilter?, limit: Int?, modelProviders: [String]?, searchTerm: String?, sectionID: String?, sortDirection: SortDirection?, sortKey: ThreadSortKey?, sourceKinds: [ThreadSourceKind]?, useStateDBOnly: Bool?) {
        self.archived = archived
        self.cursor = cursor
        self.cwd = cwd
        self.limit = limit
        self.modelProviders = modelProviders
        self.searchTerm = searchTerm
        self.sectionID = sectionID
        self.sortDirection = sortDirection
        self.sortKey = sortKey
        self.sourceKinds = sourceKinds
        self.useStateDBOnly = useStateDBOnly
    }
}

// MARK: ThreadListParams convenience initializers and mutators

public extension ThreadListParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadListParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        archived: Bool?? = nil,
        cursor: String?? = nil,
        cwd: ThreadListCwdFilter?? = nil,
        limit: Int?? = nil,
        modelProviders: [String]?? = nil,
        searchTerm: String?? = nil,
        sectionID: String?? = nil,
        sortDirection: SortDirection?? = nil,
        sortKey: ThreadSortKey?? = nil,
        sourceKinds: [ThreadSourceKind]?? = nil,
        useStateDBOnly: Bool?? = nil
    ) -> ThreadListParams {
        return ThreadListParams(
            archived: archived ?? self.archived,
            cursor: cursor ?? self.cursor,
            cwd: cwd ?? self.cwd,
            limit: limit ?? self.limit,
            modelProviders: modelProviders ?? self.modelProviders,
            searchTerm: searchTerm ?? self.searchTerm,
            sectionID: sectionID ?? self.sectionID,
            sortDirection: sortDirection ?? self.sortDirection,
            sortKey: sortKey ?? self.sortKey,
            sourceKinds: sourceKinds ?? self.sourceKinds,
            useStateDBOnly: useStateDBOnly ?? self.useStateDBOnly
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Optional cwd filter or filters; when set, only threads whose session cwd exactly matches
/// one of these paths are returned.
public enum ThreadListCwdFilter: Codable {
    case string(String)
    case stringArray([String])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode([String].self) {
            self = .stringArray(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(ThreadListCwdFilter.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for ThreadListCwdFilter"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let x):
            try container.encode(x)
        case .stringArray(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

public enum SortDirection: String, Codable {
    case asc = "asc"
    case desc = "desc"
}

public enum ThreadSortKey: String, Codable {
    case createdAt = "created_at"
    case recencyAt = "recency_at"
    case sectionPosition = "section_position"
    case updatedAt = "updated_at"
}

public enum ThreadSourceKind: String, Codable {
    case appServer = "appServer"
    case cli = "cli"
    case exec = "exec"
    case subAgent = "subAgent"
    case subAgentCompact = "subAgentCompact"
    case subAgentOther = "subAgentOther"
    case subAgentReview = "subAgentReview"
    case subAgentThreadSpawn = "subAgentThreadSpawn"
    case unknown = "unknown"
    case vscode = "vscode"
}

// MARK: - ThreadListResponse
public struct ThreadListResponse: Codable {
    /// Opaque cursor to pass as `cursor` when reversing `sortDirection`. This is only populated
    /// when the page contains at least one thread. Use it with the opposite `sortDirection`; for
    /// timestamp sorts it anchors at the start of the page timestamp so same-second updates are
    /// not skipped.
    public let backwardsCursor: String?
    public let data: [Thread]
    /// Opaque cursor to pass to the next call to continue after the last item. if None, there
    /// are no more items to return.
    public let nextCursor: String?

    public init(backwardsCursor: String?, data: [Thread], nextCursor: String?) {
        self.backwardsCursor = backwardsCursor
        self.data = data
        self.nextCursor = nextCursor
    }
}

// MARK: ThreadListResponse convenience initializers and mutators

public extension ThreadListResponse {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadListResponse.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        backwardsCursor: String?? = nil,
        data: [Thread]? = nil,
        nextCursor: String?? = nil
    ) -> ThreadListResponse {
        return ThreadListResponse(
            backwardsCursor: backwardsCursor ?? self.backwardsCursor,
            data: data ?? self.data,
            nextCursor: nextCursor ?? self.nextCursor
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Thread
public struct Thread: Codable {
    /// Optional random unique nickname assigned to an AgentControl-spawned sub-agent.
    public let agentNickname: String?
    /// Optional role (agent_role) assigned to an AgentControl-spawned sub-agent.
    public let agentRole: String?
    /// Version of the CLI that created the thread.
    public let cliVersion: String
    /// Unix timestamp (in seconds) when the thread was created.
    public let createdAt: Int
    /// Working directory captured for the thread.
    public let cwd: String
    /// Whether the thread is ephemeral and should not be materialized on disk.
    public let ephemeral: Bool
    /// Source thread id when this thread was created by forking another thread.
    public let forkedFromID: String?
    /// Optional Git metadata captured when the thread was created.
    public let gitInfo: GitInfo?
    /// Identifier for this thread. Codex-generated thread IDs are UUIDv7.
    public let id: String
    /// Model provider used for this thread (for example, 'openai').
    public let modelProvider: String
    /// Optional user-facing thread title.
    public let name: String?
    /// The ID of the parent thread. This will only be set if this thread is a subagent.
    public let parentThreadID: String?
    /// [UNSTABLE] Path to the thread on disk.
    public let path: String?
    /// Usually the first user message in the thread, if available.
    public let preview: String
    /// Unix timestamp (in seconds) used for thread recency ordering.
    public let recencyAt: Int?
    /// The independently persisted section selected for this thread, if any.
    public let section: ThreadSection?
    /// Unix timestamp in seconds when the thread entered its current section.
    public let sectionEnteredAt: Int?
    /// Session id shared by threads that belong to the same session tree.
    public let sessionID: String
    /// Origin of the thread (CLI, VSCode, codex exec, codex app-server, etc.).
    public let source: SessionSourceUnion
    /// Current runtime status for the thread.
    public let status: DatumThreadStatus
    /// Optional analytics source classification for this thread.
    public let threadSource: String?
    /// Only populated on `thread/resume`, `thread/rollback`, `thread/fork`, and `thread/read`
    /// (when `includeTurns` is true) responses. For all other responses and notifications
    /// returning a Thread, the turns field will be an empty list.
    public let turns: [TurnElement]
    /// Unix timestamp (in seconds) when the thread was last updated.
    public let updatedAt: Int

    public enum CodingKeys: String, CodingKey {
        case agentNickname, agentRole, cliVersion, createdAt, cwd, ephemeral
        case forkedFromID = "forkedFromId"
        case gitInfo, id, modelProvider, name
        case parentThreadID = "parentThreadId"
        case path, preview, recencyAt, section, sectionEnteredAt
        case sessionID = "sessionId"
        case source, status, threadSource, turns, updatedAt
    }

    public init(agentNickname: String?, agentRole: String?, cliVersion: String, createdAt: Int, cwd: String, ephemeral: Bool, forkedFromID: String?, gitInfo: GitInfo?, id: String, modelProvider: String, name: String?, parentThreadID: String?, path: String?, preview: String, recencyAt: Int?, section: ThreadSection?, sectionEnteredAt: Int?, sessionID: String, source: SessionSourceUnion, status: DatumThreadStatus, threadSource: String?, turns: [TurnElement], updatedAt: Int) {
        self.agentNickname = agentNickname
        self.agentRole = agentRole
        self.cliVersion = cliVersion
        self.createdAt = createdAt
        self.cwd = cwd
        self.ephemeral = ephemeral
        self.forkedFromID = forkedFromID
        self.gitInfo = gitInfo
        self.id = id
        self.modelProvider = modelProvider
        self.name = name
        self.parentThreadID = parentThreadID
        self.path = path
        self.preview = preview
        self.recencyAt = recencyAt
        self.section = section
        self.sectionEnteredAt = sectionEnteredAt
        self.sessionID = sessionID
        self.source = source
        self.status = status
        self.threadSource = threadSource
        self.turns = turns
        self.updatedAt = updatedAt
    }
}

// MARK: Thread convenience initializers and mutators

public extension Thread {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Thread.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        agentNickname: String?? = nil,
        agentRole: String?? = nil,
        cliVersion: String? = nil,
        createdAt: Int? = nil,
        cwd: String? = nil,
        ephemeral: Bool? = nil,
        forkedFromID: String?? = nil,
        gitInfo: GitInfo?? = nil,
        id: String? = nil,
        modelProvider: String? = nil,
        name: String?? = nil,
        parentThreadID: String?? = nil,
        path: String?? = nil,
        preview: String? = nil,
        recencyAt: Int?? = nil,
        section: ThreadSection?? = nil,
        sectionEnteredAt: Int?? = nil,
        sessionID: String? = nil,
        source: SessionSourceUnion? = nil,
        status: DatumThreadStatus? = nil,
        threadSource: String?? = nil,
        turns: [TurnElement]? = nil,
        updatedAt: Int? = nil
    ) -> Thread {
        return Thread(
            agentNickname: agentNickname ?? self.agentNickname,
            agentRole: agentRole ?? self.agentRole,
            cliVersion: cliVersion ?? self.cliVersion,
            createdAt: createdAt ?? self.createdAt,
            cwd: cwd ?? self.cwd,
            ephemeral: ephemeral ?? self.ephemeral,
            forkedFromID: forkedFromID ?? self.forkedFromID,
            gitInfo: gitInfo ?? self.gitInfo,
            id: id ?? self.id,
            modelProvider: modelProvider ?? self.modelProvider,
            name: name ?? self.name,
            parentThreadID: parentThreadID ?? self.parentThreadID,
            path: path ?? self.path,
            preview: preview ?? self.preview,
            recencyAt: recencyAt ?? self.recencyAt,
            section: section ?? self.section,
            sectionEnteredAt: sectionEnteredAt ?? self.sectionEnteredAt,
            sessionID: sessionID ?? self.sessionID,
            source: source ?? self.source,
            status: status ?? self.status,
            threadSource: threadSource ?? self.threadSource,
            turns: turns ?? self.turns,
            updatedAt: updatedAt ?? self.updatedAt
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - GitInfo
public struct GitInfo: Codable {
    public let branch, originURL, sha: String?

    public enum CodingKeys: String, CodingKey {
        case branch
        case originURL = "originUrl"
        case sha
    }

    public init(branch: String?, originURL: String?, sha: String?) {
        self.branch = branch
        self.originURL = originURL
        self.sha = sha
    }
}

// MARK: GitInfo convenience initializers and mutators

public extension GitInfo {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(GitInfo.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        branch: String?? = nil,
        originURL: String?? = nil,
        sha: String?? = nil
    ) -> GitInfo {
        return GitInfo(
            branch: branch ?? self.branch,
            originURL: originURL ?? self.originURL,
            sha: sha ?? self.sha
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// An independently persisted, user-visible thread section.
// MARK: - ThreadSection
public struct ThreadSection: Codable {
    /// Opaque UUIDv7 identity that remains stable when the section is renamed.
    public let id: String
    /// The current user-visible section name.
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

// MARK: ThreadSection convenience initializers and mutators

public extension ThreadSection {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadSection.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: String? = nil,
        name: String? = nil
    ) -> ThreadSection {
        return ThreadSection(
            id: id ?? self.id,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Origin of the thread (CLI, VSCode, codex exec, codex app-server, etc.).
public enum SessionSourceUnion: Codable {
    case enumeration(SessionSourceEnum)
    case sessionSource(SessionSource)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(SessionSourceEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(SessionSource.self) {
            self = .sessionSource(x)
            return
        }
        throw DecodingError.typeMismatch(SessionSourceUnion.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for SessionSourceUnion"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .sessionSource(let x):
            try container.encode(x)
        }
    }
}

// MARK: - SessionSource
public struct SessionSource: Codable {
    public let custom: String?
    public let subAgent: SubAgentSourceUnion?

    public init(custom: String?, subAgent: SubAgentSourceUnion?) {
        self.custom = custom
        self.subAgent = subAgent
    }
}

// MARK: SessionSource convenience initializers and mutators

public extension SessionSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SessionSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        custom: String?? = nil,
        subAgent: SubAgentSourceUnion?? = nil
    ) -> SessionSource {
        return SessionSource(
            custom: custom ?? self.custom,
            subAgent: subAgent ?? self.subAgent
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum SubAgentSourceUnion: Codable {
    case enumeration(SubAgentSourceEnum)
    case subAgentSource(SubAgentSource)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(SubAgentSourceEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(SubAgentSource.self) {
            self = .subAgentSource(x)
            return
        }
        throw DecodingError.typeMismatch(SubAgentSourceUnion.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for SubAgentSourceUnion"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .subAgentSource(let x):
            try container.encode(x)
        }
    }
}

// MARK: - SubAgentSource
public struct SubAgentSource: Codable {
    public let threadSpawn: ThreadSpawn?
    public let other: String?

    public enum CodingKeys: String, CodingKey {
        case threadSpawn = "thread_spawn"
        case other
    }

    public init(threadSpawn: ThreadSpawn?, other: String?) {
        self.threadSpawn = threadSpawn
        self.other = other
    }
}

// MARK: SubAgentSource convenience initializers and mutators

public extension SubAgentSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SubAgentSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        threadSpawn: ThreadSpawn?? = nil,
        other: String?? = nil
    ) -> SubAgentSource {
        return SubAgentSource(
            threadSpawn: threadSpawn ?? self.threadSpawn,
            other: other ?? self.other
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ThreadSpawn
public struct ThreadSpawn: Codable {
    public let agentNickname, agentPath, agentRole: String?
    public let depth: Int
    public let parentThreadID: String

    public enum CodingKeys: String, CodingKey {
        case agentNickname = "agent_nickname"
        case agentPath = "agent_path"
        case agentRole = "agent_role"
        case depth
        case parentThreadID = "parent_thread_id"
    }

    public init(agentNickname: String?, agentPath: String?, agentRole: String?, depth: Int, parentThreadID: String) {
        self.agentNickname = agentNickname
        self.agentPath = agentPath
        self.agentRole = agentRole
        self.depth = depth
        self.parentThreadID = parentThreadID
    }
}

// MARK: ThreadSpawn convenience initializers and mutators

public extension ThreadSpawn {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadSpawn.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        agentNickname: String?? = nil,
        agentPath: String?? = nil,
        agentRole: String?? = nil,
        depth: Int? = nil,
        parentThreadID: String? = nil
    ) -> ThreadSpawn {
        return ThreadSpawn(
            agentNickname: agentNickname ?? self.agentNickname,
            agentPath: agentPath ?? self.agentPath,
            agentRole: agentRole ?? self.agentRole,
            depth: depth ?? self.depth,
            parentThreadID: parentThreadID ?? self.parentThreadID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum SubAgentSourceEnum: String, Codable {
    case compact = "compact"
    case memoryConsolidation = "memory_consolidation"
    case review = "review"
}

public enum SessionSourceEnum: String, Codable {
    case appServer = "appServer"
    case cli = "cli"
    case exec = "exec"
    case unknown = "unknown"
    case vscode = "vscode"
}

/// Current runtime status for the thread.
// MARK: - DatumThreadStatus
public struct DatumThreadStatus: Codable {
    public let type: ThreadStatusType
    public let activeFlags: [ThreadActiveFlag]?

    public init(type: ThreadStatusType, activeFlags: [ThreadActiveFlag]?) {
        self.type = type
        self.activeFlags = activeFlags
    }
}

// MARK: DatumThreadStatus convenience initializers and mutators

public extension DatumThreadStatus {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(DatumThreadStatus.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: ThreadStatusType? = nil,
        activeFlags: [ThreadActiveFlag]?? = nil
    ) -> DatumThreadStatus {
        return DatumThreadStatus(
            type: type ?? self.type,
            activeFlags: activeFlags ?? self.activeFlags
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ThreadActiveFlag: String, Codable {
    case waitingOnApproval = "waitingOnApproval"
    case waitingOnUserInput = "waitingOnUserInput"
}

public enum ThreadStatusType: String, Codable {
    case active = "active"
    case idle = "idle"
    case notLoaded = "notLoaded"
    case systemError = "systemError"
}

// MARK: - TurnElement
public struct TurnElement: Codable {
    /// Unix timestamp (in seconds) when the turn completed.
    public let completedAt: Int?
    /// Duration between turn start and completion in milliseconds, if known.
    public let durationMS: Int?
    /// Only populated when the Turn's status is failed.
    public let error: PurpleTurnError?
    /// Identifier for this turn. Codex-generated turn IDs are UUIDv7.
    public let id: String
    /// Thread items currently included in this turn payload.
    public let items: [PurpleThreadItem]
    /// Describes how much of `items` has been loaded for this turn.
    public let itemsView: TurnItemsView?
    /// Unix timestamp (in seconds) when the turn started.
    public let startedAt: Int?
    public let status: TurnStatus

    public enum CodingKeys: String, CodingKey {
        case completedAt
        case durationMS = "durationMs"
        case error, id, items, itemsView, startedAt, status
    }

    public init(completedAt: Int?, durationMS: Int?, error: PurpleTurnError?, id: String, items: [PurpleThreadItem], itemsView: TurnItemsView?, startedAt: Int?, status: TurnStatus) {
        self.completedAt = completedAt
        self.durationMS = durationMS
        self.error = error
        self.id = id
        self.items = items
        self.itemsView = itemsView
        self.startedAt = startedAt
        self.status = status
    }
}

// MARK: TurnElement convenience initializers and mutators

public extension TurnElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        completedAt: Int?? = nil,
        durationMS: Int?? = nil,
        error: PurpleTurnError?? = nil,
        id: String? = nil,
        items: [PurpleThreadItem]? = nil,
        itemsView: TurnItemsView?? = nil,
        startedAt: Int?? = nil,
        status: TurnStatus? = nil
    ) -> TurnElement {
        return TurnElement(
            completedAt: completedAt ?? self.completedAt,
            durationMS: durationMS ?? self.durationMS,
            error: error ?? self.error,
            id: id ?? self.id,
            items: items ?? self.items,
            itemsView: itemsView ?? self.itemsView,
            startedAt: startedAt ?? self.startedAt,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleTurnError
public struct PurpleTurnError: Codable {
    public let additionalDetails: String?
    public let codexErrorInfo: IndigoCodexErrorInfo?
    public let message: String

    public init(additionalDetails: String?, codexErrorInfo: IndigoCodexErrorInfo?, message: String) {
        self.additionalDetails = additionalDetails
        self.codexErrorInfo = codexErrorInfo
        self.message = message
    }
}

// MARK: PurpleTurnError convenience initializers and mutators

public extension PurpleTurnError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleTurnError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        additionalDetails: String?? = nil,
        codexErrorInfo: IndigoCodexErrorInfo?? = nil,
        message: String? = nil
    ) -> PurpleTurnError {
        return PurpleTurnError(
            additionalDetails: additionalDetails ?? self.additionalDetails,
            codexErrorInfo: codexErrorInfo ?? self.codexErrorInfo,
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum IndigoCodexErrorInfo: Codable {
    case enumeration(CodexErrorInfoEnum)
    case purpleCodexErrorInfo(PurpleCodexErrorInfo)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(CodexErrorInfoEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(PurpleCodexErrorInfo.self) {
            self = .purpleCodexErrorInfo(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(IndigoCodexErrorInfo.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for IndigoCodexErrorInfo"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .purpleCodexErrorInfo(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

/// Failed to connect to the response SSE stream.
///
/// The response SSE stream disconnected in the middle of a turn before completion.
///
/// Reached the retry limit for responses.
///
/// Returned when `turn/start` or `turn/steer` is submitted while the current active turn
/// cannot accept same-turn steering, for example `/review` or manual `/compact`.
// MARK: - PurpleCodexErrorInfo
public struct PurpleCodexErrorInfo: Codable {
    public let httpConnectionFailed: PurpleHTTPConnectionFailed?
    public let responseStreamConnectionFailed: PurpleResponseStreamConnectionFailed?
    public let responseStreamDisconnected: PurpleResponseStreamDisconnected?
    public let responseTooManyFailedAttempts: PurpleResponseTooManyFailedAttempts?
    public let activeTurnNotSteerable: PurpleActiveTurnNotSteerable?

    public init(httpConnectionFailed: PurpleHTTPConnectionFailed?, responseStreamConnectionFailed: PurpleResponseStreamConnectionFailed?, responseStreamDisconnected: PurpleResponseStreamDisconnected?, responseTooManyFailedAttempts: PurpleResponseTooManyFailedAttempts?, activeTurnNotSteerable: PurpleActiveTurnNotSteerable?) {
        self.httpConnectionFailed = httpConnectionFailed
        self.responseStreamConnectionFailed = responseStreamConnectionFailed
        self.responseStreamDisconnected = responseStreamDisconnected
        self.responseTooManyFailedAttempts = responseTooManyFailedAttempts
        self.activeTurnNotSteerable = activeTurnNotSteerable
    }
}

// MARK: PurpleCodexErrorInfo convenience initializers and mutators

public extension PurpleCodexErrorInfo {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleCodexErrorInfo.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpConnectionFailed: PurpleHTTPConnectionFailed?? = nil,
        responseStreamConnectionFailed: PurpleResponseStreamConnectionFailed?? = nil,
        responseStreamDisconnected: PurpleResponseStreamDisconnected?? = nil,
        responseTooManyFailedAttempts: PurpleResponseTooManyFailedAttempts?? = nil,
        activeTurnNotSteerable: PurpleActiveTurnNotSteerable?? = nil
    ) -> PurpleCodexErrorInfo {
        return PurpleCodexErrorInfo(
            httpConnectionFailed: httpConnectionFailed ?? self.httpConnectionFailed,
            responseStreamConnectionFailed: responseStreamConnectionFailed ?? self.responseStreamConnectionFailed,
            responseStreamDisconnected: responseStreamDisconnected ?? self.responseStreamDisconnected,
            responseTooManyFailedAttempts: responseTooManyFailedAttempts ?? self.responseTooManyFailedAttempts,
            activeTurnNotSteerable: activeTurnNotSteerable ?? self.activeTurnNotSteerable
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleActiveTurnNotSteerable
public struct PurpleActiveTurnNotSteerable: Codable {
    public let turnKind: NonSteerableTurnKind

    public init(turnKind: NonSteerableTurnKind) {
        self.turnKind = turnKind
    }
}

// MARK: PurpleActiveTurnNotSteerable convenience initializers and mutators

public extension PurpleActiveTurnNotSteerable {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleActiveTurnNotSteerable.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        turnKind: NonSteerableTurnKind? = nil
    ) -> PurpleActiveTurnNotSteerable {
        return PurpleActiveTurnNotSteerable(
            turnKind: turnKind ?? self.turnKind
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum NonSteerableTurnKind: String, Codable {
    case compact = "compact"
    case review = "review"
}

// MARK: - PurpleHTTPConnectionFailed
public struct PurpleHTTPConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: PurpleHTTPConnectionFailed convenience initializers and mutators

public extension PurpleHTTPConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleHTTPConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> PurpleHTTPConnectionFailed {
        return PurpleHTTPConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleResponseStreamConnectionFailed
public struct PurpleResponseStreamConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: PurpleResponseStreamConnectionFailed convenience initializers and mutators

public extension PurpleResponseStreamConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleResponseStreamConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> PurpleResponseStreamConnectionFailed {
        return PurpleResponseStreamConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleResponseStreamDisconnected
public struct PurpleResponseStreamDisconnected: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: PurpleResponseStreamDisconnected convenience initializers and mutators

public extension PurpleResponseStreamDisconnected {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleResponseStreamDisconnected.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> PurpleResponseStreamDisconnected {
        return PurpleResponseStreamDisconnected(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleResponseTooManyFailedAttempts
public struct PurpleResponseTooManyFailedAttempts: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: PurpleResponseTooManyFailedAttempts convenience initializers and mutators

public extension PurpleResponseTooManyFailedAttempts {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleResponseTooManyFailedAttempts.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> PurpleResponseTooManyFailedAttempts {
        return PurpleResponseTooManyFailedAttempts(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum CodexErrorInfoEnum: String, Codable {
    case badRequest = "badRequest"
    case contextWindowExceeded = "contextWindowExceeded"
    case cyberPolicy = "cyberPolicy"
    case internalServerError = "internalServerError"
    case other = "other"
    case sandboxError = "sandboxError"
    case serverOverloaded = "serverOverloaded"
    case sessionBudgetExceeded = "sessionBudgetExceeded"
    case threadRollbackFailed = "threadRollbackFailed"
    case unauthorized = "unauthorized"
    case usageLimitExceeded = "usageLimitExceeded"
}

/// EXPERIMENTAL - proposed plan item content. The completed plan item is authoritative and
/// may not match the concatenation of `PlanDelta` text.
///
/// Display item emitted by the interruptible `clock.sleep` tool.
// MARK: - PurpleThreadItem
public struct PurpleThreadItem: Codable {
    public let clientID: String?
    public let content: [IndecentUserInput]?
    /// Unique identifier for this collab tool call.
    public let id: String
    public let type: ThreadItemType
    public let fragments: [PurpleHookPromptFragment]?
    public let memoryCitation: PurpleMemoryCitation?
    public let phase: MessagePhase?
    public let text: String?
    public let summary: [String]?
    /// The command's output, aggregated from stdout and stderr.
    public let aggregatedOutput: String?
    /// The command to be executed.
    public let command: String?
    /// A best-effort parsing of the command to understand the action(s) it will perform. This
    /// returns a list of CommandAction objects because a single shell command may be composed of
    /// many commands piped together.
    public let commandActions: [PurpleCommandAction]?
    /// The command's working directory.
    public let cwd: String?
    /// The duration of the command execution in milliseconds.
    ///
    /// The duration of the MCP tool call in milliseconds.
    ///
    /// The duration of the dynamic tool call in milliseconds.
    public let durationMS: Int?
    /// The command's exit code.
    public let exitCode: Int?
    /// Trusted first-party plugin id when this command resolves to one plugin script.
    public let pluginID: String?
    /// Identifier for the underlying PTY process (when available).
    public let processID: String?
    /// Safe plugin-relative path when this command resolves to one plugin script.
    public let scriptPath: String?
    public let source: CommandExecutionSource?
    /// Current status of the collab tool call.
    public let status: String?
    public let changes: [PurpleFileUpdateChange]?
    public let appContext: PurpleMCPToolCallAppContext?
    public let arguments: JSONAny?
    public let error: PurpleMCPToolCallError?
    /// Deprecated: use `appContext.resourceUri` instead.
    public let mcpAppResourceURI: String?
    public let readOnlyHint: Bool?
    public let result: PurpleResult?
    public let server: String?
    /// Name of the collab tool that was invoked.
    public let tool: String?
    public let contentItems: [PurpleDynamicToolCallOutputContentItem]?
    public let namespace: String?
    public let success: Bool?
    /// Last known status of the target agents, when available.
    public let agentsStates: [String: PurpleCollabAgentState]?
    /// Model requested for the spawned agent, when applicable.
    public let model: String?
    /// Prompt text sent as part of the collab tool call, when available.
    public let prompt: String?
    /// Reasoning effort requested for the spawned agent, when applicable.
    public let reasoningEffort: String?
    /// Thread ID of the receiving agent, when applicable. In case of spawn operation, this
    /// corresponds to the newly spawned agent.
    public let receiverThreadIDS: [String]?
    /// Thread ID of the agent issuing the collab request.
    public let senderThreadID: String?
    public let agentPath, agentThreadID: String?
    public let kind: SubAgentActivityKind?
    public let action: PurpleWebSearchAction?
    public let query: String?
    /// Structured search results returned out-of-band by standalone web search.
    ///
    /// These stay as opaque JSON at the extension/app-server boundary so new result fields and
    /// result types can pass through without a Codex release.
    public let results: [JSONAny]?
    public let path: String?
    public let revisedPrompt, savedPath: String?
    public let review: String?

    public enum CodingKeys: String, CodingKey {
        case clientID = "clientId"
        case content, id, type, fragments, memoryCitation, phase, text, summary, aggregatedOutput, command, commandActions, cwd
        case durationMS = "durationMs"
        case exitCode
        case pluginID = "pluginId"
        case processID = "processId"
        case scriptPath, source, status, changes, appContext, arguments, error
        case mcpAppResourceURI = "mcpAppResourceUri"
        case readOnlyHint, result, server, tool, contentItems, namespace, success, agentsStates, model, prompt, reasoningEffort
        case receiverThreadIDS = "receiverThreadIds"
        case senderThreadID = "senderThreadId"
        case agentPath
        case agentThreadID = "agentThreadId"
        case kind, action, query, results, path, revisedPrompt, savedPath, review
    }

    public init(clientID: String?, content: [IndecentUserInput]?, id: String, type: ThreadItemType, fragments: [PurpleHookPromptFragment]?, memoryCitation: PurpleMemoryCitation?, phase: MessagePhase?, text: String?, summary: [String]?, aggregatedOutput: String?, command: String?, commandActions: [PurpleCommandAction]?, cwd: String?, durationMS: Int?, exitCode: Int?, pluginID: String?, processID: String?, scriptPath: String?, source: CommandExecutionSource?, status: String?, changes: [PurpleFileUpdateChange]?, appContext: PurpleMCPToolCallAppContext?, arguments: JSONAny?, error: PurpleMCPToolCallError?, mcpAppResourceURI: String?, readOnlyHint: Bool?, result: PurpleResult?, server: String?, tool: String?, contentItems: [PurpleDynamicToolCallOutputContentItem]?, namespace: String?, success: Bool?, agentsStates: [String: PurpleCollabAgentState]?, model: String?, prompt: String?, reasoningEffort: String?, receiverThreadIDS: [String]?, senderThreadID: String?, agentPath: String?, agentThreadID: String?, kind: SubAgentActivityKind?, action: PurpleWebSearchAction?, query: String?, results: [JSONAny]?, path: String?, revisedPrompt: String?, savedPath: String?, review: String?) {
        self.clientID = clientID
        self.content = content
        self.id = id
        self.type = type
        self.fragments = fragments
        self.memoryCitation = memoryCitation
        self.phase = phase
        self.text = text
        self.summary = summary
        self.aggregatedOutput = aggregatedOutput
        self.command = command
        self.commandActions = commandActions
        self.cwd = cwd
        self.durationMS = durationMS
        self.exitCode = exitCode
        self.pluginID = pluginID
        self.processID = processID
        self.scriptPath = scriptPath
        self.source = source
        self.status = status
        self.changes = changes
        self.appContext = appContext
        self.arguments = arguments
        self.error = error
        self.mcpAppResourceURI = mcpAppResourceURI
        self.readOnlyHint = readOnlyHint
        self.result = result
        self.server = server
        self.tool = tool
        self.contentItems = contentItems
        self.namespace = namespace
        self.success = success
        self.agentsStates = agentsStates
        self.model = model
        self.prompt = prompt
        self.reasoningEffort = reasoningEffort
        self.receiverThreadIDS = receiverThreadIDS
        self.senderThreadID = senderThreadID
        self.agentPath = agentPath
        self.agentThreadID = agentThreadID
        self.kind = kind
        self.action = action
        self.query = query
        self.results = results
        self.path = path
        self.revisedPrompt = revisedPrompt
        self.savedPath = savedPath
        self.review = review
    }
}

// MARK: PurpleThreadItem convenience initializers and mutators

public extension PurpleThreadItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleThreadItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        clientID: String?? = nil,
        content: [IndecentUserInput]?? = nil,
        id: String? = nil,
        type: ThreadItemType? = nil,
        fragments: [PurpleHookPromptFragment]?? = nil,
        memoryCitation: PurpleMemoryCitation?? = nil,
        phase: MessagePhase?? = nil,
        text: String?? = nil,
        summary: [String]?? = nil,
        aggregatedOutput: String?? = nil,
        command: String?? = nil,
        commandActions: [PurpleCommandAction]?? = nil,
        cwd: String?? = nil,
        durationMS: Int?? = nil,
        exitCode: Int?? = nil,
        pluginID: String?? = nil,
        processID: String?? = nil,
        scriptPath: String?? = nil,
        source: CommandExecutionSource?? = nil,
        status: String?? = nil,
        changes: [PurpleFileUpdateChange]?? = nil,
        appContext: PurpleMCPToolCallAppContext?? = nil,
        arguments: JSONAny?? = nil,
        error: PurpleMCPToolCallError?? = nil,
        mcpAppResourceURI: String?? = nil,
        readOnlyHint: Bool?? = nil,
        result: PurpleResult?? = nil,
        server: String?? = nil,
        tool: String?? = nil,
        contentItems: [PurpleDynamicToolCallOutputContentItem]?? = nil,
        namespace: String?? = nil,
        success: Bool?? = nil,
        agentsStates: [String: PurpleCollabAgentState]?? = nil,
        model: String?? = nil,
        prompt: String?? = nil,
        reasoningEffort: String?? = nil,
        receiverThreadIDS: [String]?? = nil,
        senderThreadID: String?? = nil,
        agentPath: String?? = nil,
        agentThreadID: String?? = nil,
        kind: SubAgentActivityKind?? = nil,
        action: PurpleWebSearchAction?? = nil,
        query: String?? = nil,
        results: [JSONAny]?? = nil,
        path: String?? = nil,
        revisedPrompt: String?? = nil,
        savedPath: String?? = nil,
        review: String?? = nil
    ) -> PurpleThreadItem {
        return PurpleThreadItem(
            clientID: clientID ?? self.clientID,
            content: content ?? self.content,
            id: id ?? self.id,
            type: type ?? self.type,
            fragments: fragments ?? self.fragments,
            memoryCitation: memoryCitation ?? self.memoryCitation,
            phase: phase ?? self.phase,
            text: text ?? self.text,
            summary: summary ?? self.summary,
            aggregatedOutput: aggregatedOutput ?? self.aggregatedOutput,
            command: command ?? self.command,
            commandActions: commandActions ?? self.commandActions,
            cwd: cwd ?? self.cwd,
            durationMS: durationMS ?? self.durationMS,
            exitCode: exitCode ?? self.exitCode,
            pluginID: pluginID ?? self.pluginID,
            processID: processID ?? self.processID,
            scriptPath: scriptPath ?? self.scriptPath,
            source: source ?? self.source,
            status: status ?? self.status,
            changes: changes ?? self.changes,
            appContext: appContext ?? self.appContext,
            arguments: arguments ?? self.arguments,
            error: error ?? self.error,
            mcpAppResourceURI: mcpAppResourceURI ?? self.mcpAppResourceURI,
            readOnlyHint: readOnlyHint ?? self.readOnlyHint,
            result: result ?? self.result,
            server: server ?? self.server,
            tool: tool ?? self.tool,
            contentItems: contentItems ?? self.contentItems,
            namespace: namespace ?? self.namespace,
            success: success ?? self.success,
            agentsStates: agentsStates ?? self.agentsStates,
            model: model ?? self.model,
            prompt: prompt ?? self.prompt,
            reasoningEffort: reasoningEffort ?? self.reasoningEffort,
            receiverThreadIDS: receiverThreadIDS ?? self.receiverThreadIDS,
            senderThreadID: senderThreadID ?? self.senderThreadID,
            agentPath: agentPath ?? self.agentPath,
            agentThreadID: agentThreadID ?? self.agentThreadID,
            kind: kind ?? self.kind,
            action: action ?? self.action,
            query: query ?? self.query,
            results: results ?? self.results,
            path: path ?? self.path,
            revisedPrompt: revisedPrompt ?? self.revisedPrompt,
            savedPath: savedPath ?? self.savedPath,
            review: review ?? self.review
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleWebSearchAction
public struct PurpleWebSearchAction: Codable {
    public let queries: [String]?
    public let query: String?
    public let type: WebSearchActionType
    public let url, pattern: String?

    public init(queries: [String]?, query: String?, type: WebSearchActionType, url: String?, pattern: String?) {
        self.queries = queries
        self.query = query
        self.type = type
        self.url = url
        self.pattern = pattern
    }
}

// MARK: PurpleWebSearchAction convenience initializers and mutators

public extension PurpleWebSearchAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleWebSearchAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        queries: [String]?? = nil,
        query: String?? = nil,
        type: WebSearchActionType? = nil,
        url: String?? = nil,
        pattern: String?? = nil
    ) -> PurpleWebSearchAction {
        return PurpleWebSearchAction(
            queries: queries ?? self.queries,
            query: query ?? self.query,
            type: type ?? self.type,
            url: url ?? self.url,
            pattern: pattern ?? self.pattern
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum WebSearchActionType: String, Codable {
    case findInPage = "findInPage"
    case openPage = "openPage"
    case other = "other"
    case search = "search"
}

// MARK: - PurpleCollabAgentState
public struct PurpleCollabAgentState: Codable {
    public let message: String?
    public let status: CollabAgentStatus

    public init(message: String?, status: CollabAgentStatus) {
        self.message = message
        self.status = status
    }
}

// MARK: PurpleCollabAgentState convenience initializers and mutators

public extension PurpleCollabAgentState {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleCollabAgentState.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String?? = nil,
        status: CollabAgentStatus? = nil
    ) -> PurpleCollabAgentState {
        return PurpleCollabAgentState(
            message: message ?? self.message,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum CollabAgentStatus: String, Codable {
    case completed = "completed"
    case errored = "errored"
    case interrupted = "interrupted"
    case notFound = "notFound"
    case pendingInit = "pendingInit"
    case running = "running"
    case shutdown = "shutdown"
}

// MARK: - PurpleMCPToolCallAppContext
public struct PurpleMCPToolCallAppContext: Codable {
    public let actionName, appName: String?
    public let connectorID: String
    public let linkID, resourceURI: String?

    public enum CodingKeys: String, CodingKey {
        case actionName, appName
        case connectorID = "connectorId"
        case linkID = "linkId"
        case resourceURI = "resourceUri"
    }

    public init(actionName: String?, appName: String?, connectorID: String, linkID: String?, resourceURI: String?) {
        self.actionName = actionName
        self.appName = appName
        self.connectorID = connectorID
        self.linkID = linkID
        self.resourceURI = resourceURI
    }
}

// MARK: PurpleMCPToolCallAppContext convenience initializers and mutators

public extension PurpleMCPToolCallAppContext {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleMCPToolCallAppContext.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        actionName: String?? = nil,
        appName: String?? = nil,
        connectorID: String? = nil,
        linkID: String?? = nil,
        resourceURI: String?? = nil
    ) -> PurpleMCPToolCallAppContext {
        return PurpleMCPToolCallAppContext(
            actionName: actionName ?? self.actionName,
            appName: appName ?? self.appName,
            connectorID: connectorID ?? self.connectorID,
            linkID: linkID ?? self.linkID,
            resourceURI: resourceURI ?? self.resourceURI
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleFileUpdateChange
public struct PurpleFileUpdateChange: Codable {
    public let diff: String
    public let kind: PurplePatchChangeKind
    public let path: String

    public init(diff: String, kind: PurplePatchChangeKind, path: String) {
        self.diff = diff
        self.kind = kind
        self.path = path
    }
}

// MARK: PurpleFileUpdateChange convenience initializers and mutators

public extension PurpleFileUpdateChange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleFileUpdateChange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        diff: String? = nil,
        kind: PurplePatchChangeKind? = nil,
        path: String? = nil
    ) -> PurpleFileUpdateChange {
        return PurpleFileUpdateChange(
            diff: diff ?? self.diff,
            kind: kind ?? self.kind,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurplePatchChangeKind
public struct PurplePatchChangeKind: Codable {
    public let type: PatchChangeKindType
    public let movePath: String?

    public enum CodingKeys: String, CodingKey {
        case type
        case movePath = "move_path"
    }

    public init(type: PatchChangeKindType, movePath: String?) {
        self.type = type
        self.movePath = movePath
    }
}

// MARK: PurplePatchChangeKind convenience initializers and mutators

public extension PurplePatchChangeKind {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurplePatchChangeKind.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: PatchChangeKindType? = nil,
        movePath: String?? = nil
    ) -> PurplePatchChangeKind {
        return PurplePatchChangeKind(
            type: type ?? self.type,
            movePath: movePath ?? self.movePath
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum PatchChangeKindType: String, Codable {
    case add = "add"
    case delete = "delete"
    case update = "update"
}

// MARK: - PurpleCommandAction
public struct PurpleCommandAction: Codable {
    public let command: String
    public let name: String?
    public let path: String?
    public let type: CommandActionType
    public let query: String?

    public init(command: String, name: String?, path: String?, type: CommandActionType, query: String?) {
        self.command = command
        self.name = name
        self.path = path
        self.type = type
        self.query = query
    }
}

// MARK: PurpleCommandAction convenience initializers and mutators

public extension PurpleCommandAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleCommandAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String? = nil,
        name: String?? = nil,
        path: String?? = nil,
        type: CommandActionType? = nil,
        query: String?? = nil
    ) -> PurpleCommandAction {
        return PurpleCommandAction(
            command: command ?? self.command,
            name: name ?? self.name,
            path: path ?? self.path,
            type: type ?? self.type,
            query: query ?? self.query
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum CommandActionType: String, Codable {
    case listFiles = "listFiles"
    case read = "read"
    case search = "search"
    case unknown = "unknown"
}

public enum IndecentUserInput: Codable {
    case purpleUserInput(PurpleUserInput)
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(PurpleUserInput.self) {
            self = .purpleUserInput(x)
            return
        }
        throw DecodingError.typeMismatch(IndecentUserInput.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for IndecentUserInput"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .purpleUserInput(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

// MARK: - PurpleUserInput
public struct PurpleUserInput: Codable {
    public let text: String?
    /// UI-defined spans within `text` used to render or persist special elements.
    public let textElements: [PurpleTextElement]?
    public let type: UserInputType
    public let detail: ImageDetail?
    public let url, path, name: String?

    public enum CodingKeys: String, CodingKey {
        case text
        case textElements = "text_elements"
        case type, detail, url, path, name
    }

    public init(text: String?, textElements: [PurpleTextElement]?, type: UserInputType, detail: ImageDetail?, url: String?, path: String?, name: String?) {
        self.text = text
        self.textElements = textElements
        self.type = type
        self.detail = detail
        self.url = url
        self.path = path
        self.name = name
    }
}

// MARK: PurpleUserInput convenience initializers and mutators

public extension PurpleUserInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleUserInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        textElements: [PurpleTextElement]?? = nil,
        type: UserInputType? = nil,
        detail: ImageDetail?? = nil,
        url: String?? = nil,
        path: String?? = nil,
        name: String?? = nil
    ) -> PurpleUserInput {
        return PurpleUserInput(
            text: text ?? self.text,
            textElements: textElements ?? self.textElements,
            type: type ?? self.type,
            detail: detail ?? self.detail,
            url: url ?? self.url,
            path: path ?? self.path,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ImageDetail: String, Codable {
    case auto = "auto"
    case high = "high"
    case low = "low"
    case original = "original"
}

// MARK: - PurpleTextElement
public struct PurpleTextElement: Codable {
    /// Byte range in the parent `text` buffer that this element occupies.
    public let byteRange: PurpleByteRange
    /// Optional human-readable placeholder for the element, displayed in the UI.
    public let placeholder: String?

    public init(byteRange: PurpleByteRange, placeholder: String?) {
        self.byteRange = byteRange
        self.placeholder = placeholder
    }
}

// MARK: PurpleTextElement convenience initializers and mutators

public extension PurpleTextElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleTextElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byteRange: PurpleByteRange? = nil,
        placeholder: String?? = nil
    ) -> PurpleTextElement {
        return PurpleTextElement(
            byteRange: byteRange ?? self.byteRange,
            placeholder: placeholder ?? self.placeholder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Byte range in the parent `text` buffer that this element occupies.
// MARK: - PurpleByteRange
public struct PurpleByteRange: Codable {
    public let end, start: Int

    public init(end: Int, start: Int) {
        self.end = end
        self.start = start
    }
}

// MARK: PurpleByteRange convenience initializers and mutators

public extension PurpleByteRange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleByteRange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        end: Int? = nil,
        start: Int? = nil
    ) -> PurpleByteRange {
        return PurpleByteRange(
            end: end ?? self.end,
            start: start ?? self.start
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum UserInputType: String, Codable {
    case audio = "audio"
    case image = "image"
    case localAudio = "localAudio"
    case localImage = "localImage"
    case mention = "mention"
    case skill = "skill"
    case text = "text"
}

// MARK: - PurpleDynamicToolCallOutputContentItem
public struct PurpleDynamicToolCallOutputContentItem: Codable {
    public let text: String?
    public let type: InputDynamicToolCallOutputContentItemType
    public let imageURL, audioURL: String?

    public enum CodingKeys: String, CodingKey {
        case text, type
        case imageURL = "imageUrl"
        case audioURL = "audioUrl"
    }

    public init(text: String?, type: InputDynamicToolCallOutputContentItemType, imageURL: String?, audioURL: String?) {
        self.text = text
        self.type = type
        self.imageURL = imageURL
        self.audioURL = audioURL
    }
}

// MARK: PurpleDynamicToolCallOutputContentItem convenience initializers and mutators

public extension PurpleDynamicToolCallOutputContentItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleDynamicToolCallOutputContentItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        type: InputDynamicToolCallOutputContentItemType? = nil,
        imageURL: String?? = nil,
        audioURL: String?? = nil
    ) -> PurpleDynamicToolCallOutputContentItem {
        return PurpleDynamicToolCallOutputContentItem(
            text: text ?? self.text,
            type: type ?? self.type,
            imageURL: imageURL ?? self.imageURL,
            audioURL: audioURL ?? self.audioURL
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum InputDynamicToolCallOutputContentItemType: String, Codable {
    case inputAudio = "inputAudio"
    case inputImage = "inputImage"
    case inputText = "inputText"
}

// MARK: - PurpleMCPToolCallError
public struct PurpleMCPToolCallError: Codable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// MARK: PurpleMCPToolCallError convenience initializers and mutators

public extension PurpleMCPToolCallError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleMCPToolCallError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String? = nil
    ) -> PurpleMCPToolCallError {
        return PurpleMCPToolCallError(
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleHookPromptFragment
public struct PurpleHookPromptFragment: Codable {
    public let hookRunID, text: String

    public enum CodingKeys: String, CodingKey {
        case hookRunID = "hookRunId"
        case text
    }

    public init(hookRunID: String, text: String) {
        self.hookRunID = hookRunID
        self.text = text
    }
}

// MARK: PurpleHookPromptFragment convenience initializers and mutators

public extension PurpleHookPromptFragment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleHookPromptFragment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hookRunID: String? = nil,
        text: String? = nil
    ) -> PurpleHookPromptFragment {
        return PurpleHookPromptFragment(
            hookRunID: hookRunID ?? self.hookRunID,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum SubAgentActivityKind: String, Codable {
    case interacted = "interacted"
    case interrupted = "interrupted"
    case started = "started"
}

// MARK: - PurpleMemoryCitation
public struct PurpleMemoryCitation: Codable {
    public let entries: [PurpleMemoryCitationEntry]
    public let threadIDS: [String]

    public enum CodingKeys: String, CodingKey {
        case entries
        case threadIDS = "threadIds"
    }

    public init(entries: [PurpleMemoryCitationEntry], threadIDS: [String]) {
        self.entries = entries
        self.threadIDS = threadIDS
    }
}

// MARK: PurpleMemoryCitation convenience initializers and mutators

public extension PurpleMemoryCitation {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleMemoryCitation.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        entries: [PurpleMemoryCitationEntry]? = nil,
        threadIDS: [String]? = nil
    ) -> PurpleMemoryCitation {
        return PurpleMemoryCitation(
            entries: entries ?? self.entries,
            threadIDS: threadIDS ?? self.threadIDS
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleMemoryCitationEntry
public struct PurpleMemoryCitationEntry: Codable {
    public let lineEnd, lineStart: Int
    public let note, path: String

    public init(lineEnd: Int, lineStart: Int, note: String, path: String) {
        self.lineEnd = lineEnd
        self.lineStart = lineStart
        self.note = note
        self.path = path
    }
}

// MARK: PurpleMemoryCitationEntry convenience initializers and mutators

public extension PurpleMemoryCitationEntry {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleMemoryCitationEntry.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        lineEnd: Int? = nil,
        lineStart: Int? = nil,
        note: String? = nil,
        path: String? = nil
    ) -> PurpleMemoryCitationEntry {
        return PurpleMemoryCitationEntry(
            lineEnd: lineEnd ?? self.lineEnd,
            lineStart: lineStart ?? self.lineStart,
            note: note ?? self.note,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Mid-turn assistant text (for example preamble/progress narration).
///
/// Additional tool calls or assistant output may follow before turn completion.
///
/// The assistant's terminal answer text for the current turn.
public enum MessagePhase: String, Codable {
    case commentary = "commentary"
    case finalAnswer = "final_answer"
}

public enum PurpleResult: Codable {
    case purpleMCPToolCallResult(PurpleMCPToolCallResult)
    case string(String)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(PurpleMCPToolCallResult.self) {
            self = .purpleMCPToolCallResult(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(PurpleResult.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for PurpleResult"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .purpleMCPToolCallResult(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - PurpleMCPToolCallResult
public struct PurpleMCPToolCallResult: Codable {
    public let meta: JSONAny?
    public let content: [JSONAny]
    public let structuredContent: JSONAny?

    public enum CodingKeys: String, CodingKey {
        case meta = "_meta"
        case content, structuredContent
    }

    public init(meta: JSONAny?, content: [JSONAny], structuredContent: JSONAny?) {
        self.meta = meta
        self.content = content
        self.structuredContent = structuredContent
    }
}

// MARK: PurpleMCPToolCallResult convenience initializers and mutators

public extension PurpleMCPToolCallResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleMCPToolCallResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        meta: JSONAny?? = nil,
        content: [JSONAny]? = nil,
        structuredContent: JSONAny?? = nil
    ) -> PurpleMCPToolCallResult {
        return PurpleMCPToolCallResult(
            meta: meta ?? self.meta,
            content: content ?? self.content,
            structuredContent: structuredContent ?? self.structuredContent
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum CommandExecutionSource: String, Codable {
    case agent = "agent"
    case unifiedExecInteraction = "unifiedExecInteraction"
    case unifiedExecStartup = "unifiedExecStartup"
    case userShell = "userShell"
}

public enum ThreadItemType: String, Codable {
    case agentMessage = "agentMessage"
    case collabAgentToolCall = "collabAgentToolCall"
    case commandExecution = "commandExecution"
    case contextCompaction = "contextCompaction"
    case dynamicToolCall = "dynamicToolCall"
    case enteredReviewMode = "enteredReviewMode"
    case exitedReviewMode = "exitedReviewMode"
    case fileChange = "fileChange"
    case hookPrompt = "hookPrompt"
    case imageGeneration = "imageGeneration"
    case imageView = "imageView"
    case mcpToolCall = "mcpToolCall"
    case plan = "plan"
    case reasoning = "reasoning"
    case sleep = "sleep"
    case subAgentActivity = "subAgentActivity"
    case userMessage = "userMessage"
    case webSearch = "webSearch"
}

/// Describes how much of `items` has been loaded for this turn.
///
/// `items` was not loaded for this turn. The field is intentionally empty.
///
/// `items` contains only a display summary for this turn.
///
/// `items` contains every ThreadItem available from persisted app-server history for this
/// turn.
public enum TurnItemsView: String, Codable {
    case full = "full"
    case notLoaded = "notLoaded"
    case summary = "summary"
}

public enum TurnStatus: String, Codable {
    case completed = "completed"
    case failed = "failed"
    case inProgress = "inProgress"
    case interrupted = "interrupted"
}

// MARK: - ThreadStartParams
public struct ThreadStartParams: Codable {
    public let approvalPolicy: ThreadStartParamsApprovalPolicy?
    /// Override where approval requests are routed for review on this thread and subsequent
    /// turns.
    public let approvalsReviewer: ApprovalsReviewer?
    public let baseInstructions: String?
    public let config: [String: JSONAny]?
    public let cwd, developerInstructions: String?
    public let ephemeral: Bool?
    public let model, modelProvider: String?
    public let personality: Personality?
    public let sandbox: SandboxMode?
    public let serviceName, serviceTier: String?
    public let sessionStartSource: ThreadStartSource?
    /// Optional client-supplied analytics source classification for this thread.
    public let threadSource: String?

    public init(approvalPolicy: ThreadStartParamsApprovalPolicy?, approvalsReviewer: ApprovalsReviewer?, baseInstructions: String?, config: [String: JSONAny]?, cwd: String?, developerInstructions: String?, ephemeral: Bool?, model: String?, modelProvider: String?, personality: Personality?, sandbox: SandboxMode?, serviceName: String?, serviceTier: String?, sessionStartSource: ThreadStartSource?, threadSource: String?) {
        self.approvalPolicy = approvalPolicy
        self.approvalsReviewer = approvalsReviewer
        self.baseInstructions = baseInstructions
        self.config = config
        self.cwd = cwd
        self.developerInstructions = developerInstructions
        self.ephemeral = ephemeral
        self.model = model
        self.modelProvider = modelProvider
        self.personality = personality
        self.sandbox = sandbox
        self.serviceName = serviceName
        self.serviceTier = serviceTier
        self.sessionStartSource = sessionStartSource
        self.threadSource = threadSource
    }
}

// MARK: ThreadStartParams convenience initializers and mutators

public extension ThreadStartParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadStartParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approvalPolicy: ThreadStartParamsApprovalPolicy?? = nil,
        approvalsReviewer: ApprovalsReviewer?? = nil,
        baseInstructions: String?? = nil,
        config: [String: JSONAny]?? = nil,
        cwd: String?? = nil,
        developerInstructions: String?? = nil,
        ephemeral: Bool?? = nil,
        model: String?? = nil,
        modelProvider: String?? = nil,
        personality: Personality?? = nil,
        sandbox: SandboxMode?? = nil,
        serviceName: String?? = nil,
        serviceTier: String?? = nil,
        sessionStartSource: ThreadStartSource?? = nil,
        threadSource: String?? = nil
    ) -> ThreadStartParams {
        return ThreadStartParams(
            approvalPolicy: approvalPolicy ?? self.approvalPolicy,
            approvalsReviewer: approvalsReviewer ?? self.approvalsReviewer,
            baseInstructions: baseInstructions ?? self.baseInstructions,
            config: config ?? self.config,
            cwd: cwd ?? self.cwd,
            developerInstructions: developerInstructions ?? self.developerInstructions,
            ephemeral: ephemeral ?? self.ephemeral,
            model: model ?? self.model,
            modelProvider: modelProvider ?? self.modelProvider,
            personality: personality ?? self.personality,
            sandbox: sandbox ?? self.sandbox,
            serviceName: serviceName ?? self.serviceName,
            serviceTier: serviceTier ?? self.serviceTier,
            sessionStartSource: sessionStartSource ?? self.sessionStartSource,
            threadSource: threadSource ?? self.threadSource
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ThreadStartParamsApprovalPolicy: Codable {
    case enumeration(ApprovalPolicyEnum)
    case purpleGranularAskForApproval(PurpleGranularAskForApproval)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(ApprovalPolicyEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(PurpleGranularAskForApproval.self) {
            self = .purpleGranularAskForApproval(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(ThreadStartParamsApprovalPolicy.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for ThreadStartParamsApprovalPolicy"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .purpleGranularAskForApproval(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - PurpleGranularAskForApproval
public struct PurpleGranularAskForApproval: Codable {
    public let granular: PurpleGranular

    public init(granular: PurpleGranular) {
        self.granular = granular
    }
}

// MARK: PurpleGranularAskForApproval convenience initializers and mutators

public extension PurpleGranularAskForApproval {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleGranularAskForApproval.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        granular: PurpleGranular? = nil
    ) -> PurpleGranularAskForApproval {
        return PurpleGranularAskForApproval(
            granular: granular ?? self.granular
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - PurpleGranular
public struct PurpleGranular: Codable {
    public let mcpElicitations: Bool
    public let requestPermissions: Bool?
    public let rules, sandboxApproval: Bool
    public let skillApproval: Bool?

    public enum CodingKeys: String, CodingKey {
        case mcpElicitations = "mcp_elicitations"
        case requestPermissions = "request_permissions"
        case rules
        case sandboxApproval = "sandbox_approval"
        case skillApproval = "skill_approval"
    }

    public init(mcpElicitations: Bool, requestPermissions: Bool?, rules: Bool, sandboxApproval: Bool, skillApproval: Bool?) {
        self.mcpElicitations = mcpElicitations
        self.requestPermissions = requestPermissions
        self.rules = rules
        self.sandboxApproval = sandboxApproval
        self.skillApproval = skillApproval
    }
}

// MARK: PurpleGranular convenience initializers and mutators

public extension PurpleGranular {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PurpleGranular.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        mcpElicitations: Bool? = nil,
        requestPermissions: Bool?? = nil,
        rules: Bool? = nil,
        sandboxApproval: Bool? = nil,
        skillApproval: Bool?? = nil
    ) -> PurpleGranular {
        return PurpleGranular(
            mcpElicitations: mcpElicitations ?? self.mcpElicitations,
            requestPermissions: requestPermissions ?? self.requestPermissions,
            rules: rules ?? self.rules,
            sandboxApproval: sandboxApproval ?? self.sandboxApproval,
            skillApproval: skillApproval ?? self.skillApproval
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ApprovalPolicyEnum: String, Codable {
    case never = "never"
    case onRequest = "on-request"
    case untrusted = "untrusted"
}

/// Configures who approval requests are routed to for review. Examples include sandbox
/// escapes, blocked network access, MCP approval prompts, and ARC escalations. Defaults to
/// `user`. `auto_review` uses a carefully prompted subagent to gather relevant context and
/// apply a risk-based decision framework before approving or denying the request. The legacy
/// value `guardian_subagent` is accepted for compatibility.
public enum ApprovalsReviewer: String, Codable {
    case autoReview = "auto_review"
    case guardianSubagent = "guardian_subagent"
    case user = "user"
}

public enum Personality: String, Codable {
    case friendly = "friendly"
    case none = "none"
    case pragmatic = "pragmatic"
}

public enum SandboxMode: String, Codable {
    case dangerFullAccess = "danger-full-access"
    case readOnly = "read-only"
    case workspaceWrite = "workspace-write"
}

public enum ThreadStartSource: String, Codable {
    case clear = "clear"
    case startup = "startup"
}

/// There are three ways to resume a thread: 1. By thread_id: load the thread from disk by
/// thread_id and resume it. 2. By history: instantiate the thread from memory and resume it.
/// 3. By path: load the thread from disk by path and resume it.
///
/// For non-running threads, the precedence is: history > non-empty path > thread_id. If
/// using history or a non-empty path for a non-running thread, the thread_id param will be
/// ignored.
///
/// If thread_id identifies a running thread, app-server rejoins that thread and treats a
/// non-empty path as a consistency check against the active rollout path. Empty string path
/// values are treated as absent.
///
/// Prefer using thread_id whenever possible.
// MARK: - ThreadResumeParams
public struct ThreadResumeParams: Codable {
    public let approvalPolicy: ThreadResumeParamsApprovalPolicy?
    /// Override where approval requests are routed for review on this thread and subsequent
    /// turns.
    public let approvalsReviewer: ApprovalsReviewer?
    public let baseInstructions: String?
    public let config: [String: JSONAny]?
    public let cwd, developerInstructions: String?
    /// Configuration overrides for the resumed thread, if any.
    public let model: String?
    public let modelProvider: String?
    public let personality: Personality?
    public let sandbox: SandboxMode?
    public let serviceTier: String?
    public let threadID: String

    public enum CodingKeys: String, CodingKey {
        case approvalPolicy, approvalsReviewer, baseInstructions, config, cwd, developerInstructions, model, modelProvider, personality, sandbox, serviceTier
        case threadID = "threadId"
    }

    public init(approvalPolicy: ThreadResumeParamsApprovalPolicy?, approvalsReviewer: ApprovalsReviewer?, baseInstructions: String?, config: [String: JSONAny]?, cwd: String?, developerInstructions: String?, model: String?, modelProvider: String?, personality: Personality?, sandbox: SandboxMode?, serviceTier: String?, threadID: String) {
        self.approvalPolicy = approvalPolicy
        self.approvalsReviewer = approvalsReviewer
        self.baseInstructions = baseInstructions
        self.config = config
        self.cwd = cwd
        self.developerInstructions = developerInstructions
        self.model = model
        self.modelProvider = modelProvider
        self.personality = personality
        self.sandbox = sandbox
        self.serviceTier = serviceTier
        self.threadID = threadID
    }
}

// MARK: ThreadResumeParams convenience initializers and mutators

public extension ThreadResumeParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadResumeParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approvalPolicy: ThreadResumeParamsApprovalPolicy?? = nil,
        approvalsReviewer: ApprovalsReviewer?? = nil,
        baseInstructions: String?? = nil,
        config: [String: JSONAny]?? = nil,
        cwd: String?? = nil,
        developerInstructions: String?? = nil,
        model: String?? = nil,
        modelProvider: String?? = nil,
        personality: Personality?? = nil,
        sandbox: SandboxMode?? = nil,
        serviceTier: String?? = nil,
        threadID: String? = nil
    ) -> ThreadResumeParams {
        return ThreadResumeParams(
            approvalPolicy: approvalPolicy ?? self.approvalPolicy,
            approvalsReviewer: approvalsReviewer ?? self.approvalsReviewer,
            baseInstructions: baseInstructions ?? self.baseInstructions,
            config: config ?? self.config,
            cwd: cwd ?? self.cwd,
            developerInstructions: developerInstructions ?? self.developerInstructions,
            model: model ?? self.model,
            modelProvider: modelProvider ?? self.modelProvider,
            personality: personality ?? self.personality,
            sandbox: sandbox ?? self.sandbox,
            serviceTier: serviceTier ?? self.serviceTier,
            threadID: threadID ?? self.threadID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ThreadResumeParamsApprovalPolicy: Codable {
    case enumeration(ApprovalPolicyEnum)
    case fluffyGranularAskForApproval(FluffyGranularAskForApproval)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(ApprovalPolicyEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(FluffyGranularAskForApproval.self) {
            self = .fluffyGranularAskForApproval(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(ThreadResumeParamsApprovalPolicy.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for ThreadResumeParamsApprovalPolicy"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .fluffyGranularAskForApproval(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - FluffyGranularAskForApproval
public struct FluffyGranularAskForApproval: Codable {
    public let granular: FluffyGranular

    public init(granular: FluffyGranular) {
        self.granular = granular
    }
}

// MARK: FluffyGranularAskForApproval convenience initializers and mutators

public extension FluffyGranularAskForApproval {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyGranularAskForApproval.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        granular: FluffyGranular? = nil
    ) -> FluffyGranularAskForApproval {
        return FluffyGranularAskForApproval(
            granular: granular ?? self.granular
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyGranular
public struct FluffyGranular: Codable {
    public let mcpElicitations: Bool
    public let requestPermissions: Bool?
    public let rules, sandboxApproval: Bool
    public let skillApproval: Bool?

    public enum CodingKeys: String, CodingKey {
        case mcpElicitations = "mcp_elicitations"
        case requestPermissions = "request_permissions"
        case rules
        case sandboxApproval = "sandbox_approval"
        case skillApproval = "skill_approval"
    }

    public init(mcpElicitations: Bool, requestPermissions: Bool?, rules: Bool, sandboxApproval: Bool, skillApproval: Bool?) {
        self.mcpElicitations = mcpElicitations
        self.requestPermissions = requestPermissions
        self.rules = rules
        self.sandboxApproval = sandboxApproval
        self.skillApproval = skillApproval
    }
}

// MARK: FluffyGranular convenience initializers and mutators

public extension FluffyGranular {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyGranular.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        mcpElicitations: Bool? = nil,
        requestPermissions: Bool?? = nil,
        rules: Bool? = nil,
        sandboxApproval: Bool? = nil,
        skillApproval: Bool?? = nil
    ) -> FluffyGranular {
        return FluffyGranular(
            mcpElicitations: mcpElicitations ?? self.mcpElicitations,
            requestPermissions: requestPermissions ?? self.requestPermissions,
            rules: rules ?? self.rules,
            sandboxApproval: sandboxApproval ?? self.sandboxApproval,
            skillApproval: skillApproval ?? self.skillApproval
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ThreadStatusChangedNotification
public struct ThreadStatusChangedNotification: Codable {
    public let status: ThreadStatusChangedNotificationThreadStatus
    public let threadID: String

    public enum CodingKeys: String, CodingKey {
        case status
        case threadID = "threadId"
    }

    public init(status: ThreadStatusChangedNotificationThreadStatus, threadID: String) {
        self.status = status
        self.threadID = threadID
    }
}

// MARK: ThreadStatusChangedNotification convenience initializers and mutators

public extension ThreadStatusChangedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadStatusChangedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        status: ThreadStatusChangedNotificationThreadStatus? = nil,
        threadID: String? = nil
    ) -> ThreadStatusChangedNotification {
        return ThreadStatusChangedNotification(
            status: status ?? self.status,
            threadID: threadID ?? self.threadID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ThreadStatusChangedNotificationThreadStatus
public struct ThreadStatusChangedNotificationThreadStatus: Codable {
    public let type: ThreadStatusType
    public let activeFlags: [ThreadActiveFlag]?

    public init(type: ThreadStatusType, activeFlags: [ThreadActiveFlag]?) {
        self.type = type
        self.activeFlags = activeFlags
    }
}

// MARK: ThreadStatusChangedNotificationThreadStatus convenience initializers and mutators

public extension ThreadStatusChangedNotificationThreadStatus {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadStatusChangedNotificationThreadStatus.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: ThreadStatusType? = nil,
        activeFlags: [ThreadActiveFlag]?? = nil
    ) -> ThreadStatusChangedNotificationThreadStatus {
        return ThreadStatusChangedNotificationThreadStatus(
            type: type ?? self.type,
            activeFlags: activeFlags ?? self.activeFlags
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ThreadTokenUsageUpdatedNotification
public struct ThreadTokenUsageUpdatedNotification: Codable {
    public let threadID: String
    public let tokenUsage: ThreadTokenUsage
    public let turnID: String

    public enum CodingKeys: String, CodingKey {
        case threadID = "threadId"
        case tokenUsage
        case turnID = "turnId"
    }

    public init(threadID: String, tokenUsage: ThreadTokenUsage, turnID: String) {
        self.threadID = threadID
        self.tokenUsage = tokenUsage
        self.turnID = turnID
    }
}

// MARK: ThreadTokenUsageUpdatedNotification convenience initializers and mutators

public extension ThreadTokenUsageUpdatedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadTokenUsageUpdatedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        threadID: String? = nil,
        tokenUsage: ThreadTokenUsage? = nil,
        turnID: String? = nil
    ) -> ThreadTokenUsageUpdatedNotification {
        return ThreadTokenUsageUpdatedNotification(
            threadID: threadID ?? self.threadID,
            tokenUsage: tokenUsage ?? self.tokenUsage,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ThreadTokenUsage
public struct ThreadTokenUsage: Codable {
    public let last: TokenUsageBreakdown
    public let modelContextWindow: Int?
    public let total: TokenUsageBreakdown

    public init(last: TokenUsageBreakdown, modelContextWindow: Int?, total: TokenUsageBreakdown) {
        self.last = last
        self.modelContextWindow = modelContextWindow
        self.total = total
    }
}

// MARK: ThreadTokenUsage convenience initializers and mutators

public extension ThreadTokenUsage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ThreadTokenUsage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        last: TokenUsageBreakdown? = nil,
        modelContextWindow: Int?? = nil,
        total: TokenUsageBreakdown? = nil
    ) -> ThreadTokenUsage {
        return ThreadTokenUsage(
            last: last ?? self.last,
            modelContextWindow: modelContextWindow ?? self.modelContextWindow,
            total: total ?? self.total
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TokenUsageBreakdown
public struct TokenUsageBreakdown: Codable {
    public let cachedInputTokens: Int
    public let cacheWriteInputTokens: Int?
    public let inputTokens, outputTokens, reasoningOutputTokens, totalTokens: Int

    public init(cachedInputTokens: Int, cacheWriteInputTokens: Int?, inputTokens: Int, outputTokens: Int, reasoningOutputTokens: Int, totalTokens: Int) {
        self.cachedInputTokens = cachedInputTokens
        self.cacheWriteInputTokens = cacheWriteInputTokens
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.reasoningOutputTokens = reasoningOutputTokens
        self.totalTokens = totalTokens
    }
}

// MARK: TokenUsageBreakdown convenience initializers and mutators

public extension TokenUsageBreakdown {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TokenUsageBreakdown.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        cachedInputTokens: Int? = nil,
        cacheWriteInputTokens: Int?? = nil,
        inputTokens: Int? = nil,
        outputTokens: Int? = nil,
        reasoningOutputTokens: Int? = nil,
        totalTokens: Int? = nil
    ) -> TokenUsageBreakdown {
        return TokenUsageBreakdown(
            cachedInputTokens: cachedInputTokens ?? self.cachedInputTokens,
            cacheWriteInputTokens: cacheWriteInputTokens ?? self.cacheWriteInputTokens,
            inputTokens: inputTokens ?? self.inputTokens,
            outputTokens: outputTokens ?? self.outputTokens,
            reasoningOutputTokens: reasoningOutputTokens ?? self.reasoningOutputTokens,
            totalTokens: totalTokens ?? self.totalTokens
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnStartParams
public struct TurnStartParams: Codable {
    /// Override the approval policy for this turn and subsequent turns.
    public let approvalPolicy: TurnStartParamsApprovalPolicy?
    /// Override where approval requests are routed for review on this turn and subsequent turns.
    public let approvalsReviewer: ApprovalsReviewer?
    public let clientUserMessageID: String?
    /// Override the working directory for this turn and subsequent turns.
    public let cwd: String?
    /// Override the reasoning effort for this turn and subsequent turns.
    public let effort: String?
    public let input: [UserInput]
    /// Override the model for this turn and subsequent turns.
    public let model: String?
    /// Optional JSON Schema used to constrain the final assistant message for this turn.
    public let outputSchema: JSONAny?
    /// Override the personality for this turn and subsequent turns.
    public let personality: Personality?
    /// Override the sandbox policy for this turn and subsequent turns.
    public let sandboxPolicy: SandboxPolicy?
    /// Override the service tier for this turn and subsequent turns.
    public let serviceTier: String?
    /// Override the reasoning summary for this turn and subsequent turns.
    public let summary: ReasoningSummary?
    public let threadID: String

    public enum CodingKeys: String, CodingKey {
        case approvalPolicy, approvalsReviewer
        case clientUserMessageID = "clientUserMessageId"
        case cwd, effort, input, model, outputSchema, personality, sandboxPolicy, serviceTier, summary
        case threadID = "threadId"
    }

    public init(approvalPolicy: TurnStartParamsApprovalPolicy?, approvalsReviewer: ApprovalsReviewer?, clientUserMessageID: String?, cwd: String?, effort: String?, input: [UserInput], model: String?, outputSchema: JSONAny?, personality: Personality?, sandboxPolicy: SandboxPolicy?, serviceTier: String?, summary: ReasoningSummary?, threadID: String) {
        self.approvalPolicy = approvalPolicy
        self.approvalsReviewer = approvalsReviewer
        self.clientUserMessageID = clientUserMessageID
        self.cwd = cwd
        self.effort = effort
        self.input = input
        self.model = model
        self.outputSchema = outputSchema
        self.personality = personality
        self.sandboxPolicy = sandboxPolicy
        self.serviceTier = serviceTier
        self.summary = summary
        self.threadID = threadID
    }
}

// MARK: TurnStartParams convenience initializers and mutators

public extension TurnStartParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnStartParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        approvalPolicy: TurnStartParamsApprovalPolicy?? = nil,
        approvalsReviewer: ApprovalsReviewer?? = nil,
        clientUserMessageID: String?? = nil,
        cwd: String?? = nil,
        effort: String?? = nil,
        input: [UserInput]? = nil,
        model: String?? = nil,
        outputSchema: JSONAny?? = nil,
        personality: Personality?? = nil,
        sandboxPolicy: SandboxPolicy?? = nil,
        serviceTier: String?? = nil,
        summary: ReasoningSummary?? = nil,
        threadID: String? = nil
    ) -> TurnStartParams {
        return TurnStartParams(
            approvalPolicy: approvalPolicy ?? self.approvalPolicy,
            approvalsReviewer: approvalsReviewer ?? self.approvalsReviewer,
            clientUserMessageID: clientUserMessageID ?? self.clientUserMessageID,
            cwd: cwd ?? self.cwd,
            effort: effort ?? self.effort,
            input: input ?? self.input,
            model: model ?? self.model,
            outputSchema: outputSchema ?? self.outputSchema,
            personality: personality ?? self.personality,
            sandboxPolicy: sandboxPolicy ?? self.sandboxPolicy,
            serviceTier: serviceTier ?? self.serviceTier,
            summary: summary ?? self.summary,
            threadID: threadID ?? self.threadID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Override the approval policy for this turn and subsequent turns.
public enum TurnStartParamsApprovalPolicy: Codable {
    case enumeration(ApprovalPolicyEnum)
    case tentacledGranularAskForApproval(TentacledGranularAskForApproval)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(ApprovalPolicyEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(TentacledGranularAskForApproval.self) {
            self = .tentacledGranularAskForApproval(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(TurnStartParamsApprovalPolicy.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for TurnStartParamsApprovalPolicy"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .tentacledGranularAskForApproval(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - TentacledGranularAskForApproval
public struct TentacledGranularAskForApproval: Codable {
    public let granular: TentacledGranular

    public init(granular: TentacledGranular) {
        self.granular = granular
    }
}

// MARK: TentacledGranularAskForApproval convenience initializers and mutators

public extension TentacledGranularAskForApproval {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledGranularAskForApproval.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        granular: TentacledGranular? = nil
    ) -> TentacledGranularAskForApproval {
        return TentacledGranularAskForApproval(
            granular: granular ?? self.granular
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledGranular
public struct TentacledGranular: Codable {
    public let mcpElicitations: Bool
    public let requestPermissions: Bool?
    public let rules, sandboxApproval: Bool
    public let skillApproval: Bool?

    public enum CodingKeys: String, CodingKey {
        case mcpElicitations = "mcp_elicitations"
        case requestPermissions = "request_permissions"
        case rules
        case sandboxApproval = "sandbox_approval"
        case skillApproval = "skill_approval"
    }

    public init(mcpElicitations: Bool, requestPermissions: Bool?, rules: Bool, sandboxApproval: Bool, skillApproval: Bool?) {
        self.mcpElicitations = mcpElicitations
        self.requestPermissions = requestPermissions
        self.rules = rules
        self.sandboxApproval = sandboxApproval
        self.skillApproval = skillApproval
    }
}

// MARK: TentacledGranular convenience initializers and mutators

public extension TentacledGranular {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledGranular.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        mcpElicitations: Bool? = nil,
        requestPermissions: Bool?? = nil,
        rules: Bool? = nil,
        sandboxApproval: Bool? = nil,
        skillApproval: Bool?? = nil
    ) -> TentacledGranular {
        return TentacledGranular(
            mcpElicitations: mcpElicitations ?? self.mcpElicitations,
            requestPermissions: requestPermissions ?? self.requestPermissions,
            rules: rules ?? self.rules,
            sandboxApproval: sandboxApproval ?? self.sandboxApproval,
            skillApproval: skillApproval ?? self.skillApproval
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - UserInput
public struct UserInput: Codable {
    public let text: String?
    /// UI-defined spans within `text` used to render or persist special elements.
    public let textElements: [UserInputTextElement]?
    public let type: UserInputType
    public let detail: ImageDetail?
    public let url, path, name: String?

    public enum CodingKeys: String, CodingKey {
        case text
        case textElements = "text_elements"
        case type, detail, url, path, name
    }

    public init(text: String?, textElements: [UserInputTextElement]?, type: UserInputType, detail: ImageDetail?, url: String?, path: String?, name: String?) {
        self.text = text
        self.textElements = textElements
        self.type = type
        self.detail = detail
        self.url = url
        self.path = path
        self.name = name
    }
}

// MARK: UserInput convenience initializers and mutators

public extension UserInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(UserInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        textElements: [UserInputTextElement]?? = nil,
        type: UserInputType? = nil,
        detail: ImageDetail?? = nil,
        url: String?? = nil,
        path: String?? = nil,
        name: String?? = nil
    ) -> UserInput {
        return UserInput(
            text: text ?? self.text,
            textElements: textElements ?? self.textElements,
            type: type ?? self.type,
            detail: detail ?? self.detail,
            url: url ?? self.url,
            path: path ?? self.path,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - UserInputTextElement
public struct UserInputTextElement: Codable {
    /// Byte range in the parent `text` buffer that this element occupies.
    public let byteRange: FluffyByteRange
    /// Optional human-readable placeholder for the element, displayed in the UI.
    public let placeholder: String?

    public init(byteRange: FluffyByteRange, placeholder: String?) {
        self.byteRange = byteRange
        self.placeholder = placeholder
    }
}

// MARK: UserInputTextElement convenience initializers and mutators

public extension UserInputTextElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(UserInputTextElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byteRange: FluffyByteRange? = nil,
        placeholder: String?? = nil
    ) -> UserInputTextElement {
        return UserInputTextElement(
            byteRange: byteRange ?? self.byteRange,
            placeholder: placeholder ?? self.placeholder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Byte range in the parent `text` buffer that this element occupies.
// MARK: - FluffyByteRange
public struct FluffyByteRange: Codable {
    public let end, start: Int

    public init(end: Int, start: Int) {
        self.end = end
        self.start = start
    }
}

// MARK: FluffyByteRange convenience initializers and mutators

public extension FluffyByteRange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyByteRange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        end: Int? = nil,
        start: Int? = nil
    ) -> FluffyByteRange {
        return FluffyByteRange(
            end: end ?? self.end,
            start: start ?? self.start
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - SandboxPolicy
public struct SandboxPolicy: Codable {
    public let type: SandboxPolicyType
    public let networkAccess: NetworkAccessUnion?
    public let excludeSlashTmp, excludeTmpdirEnvVar: Bool?
    public let writableRoots: [String]?

    public init(type: SandboxPolicyType, networkAccess: NetworkAccessUnion?, excludeSlashTmp: Bool?, excludeTmpdirEnvVar: Bool?, writableRoots: [String]?) {
        self.type = type
        self.networkAccess = networkAccess
        self.excludeSlashTmp = excludeSlashTmp
        self.excludeTmpdirEnvVar = excludeTmpdirEnvVar
        self.writableRoots = writableRoots
    }
}

// MARK: SandboxPolicy convenience initializers and mutators

public extension SandboxPolicy {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SandboxPolicy.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: SandboxPolicyType? = nil,
        networkAccess: NetworkAccessUnion?? = nil,
        excludeSlashTmp: Bool?? = nil,
        excludeTmpdirEnvVar: Bool?? = nil,
        writableRoots: [String]?? = nil
    ) -> SandboxPolicy {
        return SandboxPolicy(
            type: type ?? self.type,
            networkAccess: networkAccess ?? self.networkAccess,
            excludeSlashTmp: excludeSlashTmp ?? self.excludeSlashTmp,
            excludeTmpdirEnvVar: excludeTmpdirEnvVar ?? self.excludeTmpdirEnvVar,
            writableRoots: writableRoots ?? self.writableRoots
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum NetworkAccessUnion: Codable {
    case bool(Bool)
    case enumeration(NetworkAccess)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Bool.self) {
            self = .bool(x)
            return
        }
        if let x = try? container.decode(NetworkAccess.self) {
            self = .enumeration(x)
            return
        }
        throw DecodingError.typeMismatch(NetworkAccessUnion.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for NetworkAccessUnion"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let x):
            try container.encode(x)
        case .enumeration(let x):
            try container.encode(x)
        }
    }
}

public enum NetworkAccess: String, Codable {
    case enabled = "enabled"
    case restricted = "restricted"
}

public enum SandboxPolicyType: String, Codable {
    case dangerFullAccess = "dangerFullAccess"
    case externalSandbox = "externalSandbox"
    case readOnly = "readOnly"
    case workspaceWrite = "workspaceWrite"
}

/// Option to disable reasoning summaries.
public enum ReasoningSummary: String, Codable {
    case auto = "auto"
    case concise = "concise"
    case detailed = "detailed"
    case none = "none"
}

// MARK: - TurnStartedNotification
public struct TurnStartedNotification: Codable {
    public let threadID: String
    public let turn: TurnStartedNotificationTurn

    public enum CodingKeys: String, CodingKey {
        case threadID = "threadId"
        case turn
    }

    public init(threadID: String, turn: TurnStartedNotificationTurn) {
        self.threadID = threadID
        self.turn = turn
    }
}

// MARK: TurnStartedNotification convenience initializers and mutators

public extension TurnStartedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnStartedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        threadID: String? = nil,
        turn: TurnStartedNotificationTurn? = nil
    ) -> TurnStartedNotification {
        return TurnStartedNotification(
            threadID: threadID ?? self.threadID,
            turn: turn ?? self.turn
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnStartedNotificationTurn
public struct TurnStartedNotificationTurn: Codable {
    /// Unix timestamp (in seconds) when the turn completed.
    public let completedAt: Int?
    /// Duration between turn start and completion in milliseconds, if known.
    public let durationMS: Int?
    /// Only populated when the Turn's status is failed.
    public let error: FluffyTurnError?
    /// Identifier for this turn. Codex-generated turn IDs are UUIDv7.
    public let id: String
    /// Thread items currently included in this turn payload.
    public let items: [FluffyThreadItem]
    /// Describes how much of `items` has been loaded for this turn.
    public let itemsView: TurnItemsView?
    /// Unix timestamp (in seconds) when the turn started.
    public let startedAt: Int?
    public let status: TurnStatus

    public enum CodingKeys: String, CodingKey {
        case completedAt
        case durationMS = "durationMs"
        case error, id, items, itemsView, startedAt, status
    }

    public init(completedAt: Int?, durationMS: Int?, error: FluffyTurnError?, id: String, items: [FluffyThreadItem], itemsView: TurnItemsView?, startedAt: Int?, status: TurnStatus) {
        self.completedAt = completedAt
        self.durationMS = durationMS
        self.error = error
        self.id = id
        self.items = items
        self.itemsView = itemsView
        self.startedAt = startedAt
        self.status = status
    }
}

// MARK: TurnStartedNotificationTurn convenience initializers and mutators

public extension TurnStartedNotificationTurn {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnStartedNotificationTurn.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        completedAt: Int?? = nil,
        durationMS: Int?? = nil,
        error: FluffyTurnError?? = nil,
        id: String? = nil,
        items: [FluffyThreadItem]? = nil,
        itemsView: TurnItemsView?? = nil,
        startedAt: Int?? = nil,
        status: TurnStatus? = nil
    ) -> TurnStartedNotificationTurn {
        return TurnStartedNotificationTurn(
            completedAt: completedAt ?? self.completedAt,
            durationMS: durationMS ?? self.durationMS,
            error: error ?? self.error,
            id: id ?? self.id,
            items: items ?? self.items,
            itemsView: itemsView ?? self.itemsView,
            startedAt: startedAt ?? self.startedAt,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyTurnError
public struct FluffyTurnError: Codable {
    public let additionalDetails: String?
    public let codexErrorInfo: IndecentCodexErrorInfo?
    public let message: String

    public init(additionalDetails: String?, codexErrorInfo: IndecentCodexErrorInfo?, message: String) {
        self.additionalDetails = additionalDetails
        self.codexErrorInfo = codexErrorInfo
        self.message = message
    }
}

// MARK: FluffyTurnError convenience initializers and mutators

public extension FluffyTurnError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyTurnError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        additionalDetails: String?? = nil,
        codexErrorInfo: IndecentCodexErrorInfo?? = nil,
        message: String? = nil
    ) -> FluffyTurnError {
        return FluffyTurnError(
            additionalDetails: additionalDetails ?? self.additionalDetails,
            codexErrorInfo: codexErrorInfo ?? self.codexErrorInfo,
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum IndecentCodexErrorInfo: Codable {
    case enumeration(CodexErrorInfoEnum)
    case fluffyCodexErrorInfo(FluffyCodexErrorInfo)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(CodexErrorInfoEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(FluffyCodexErrorInfo.self) {
            self = .fluffyCodexErrorInfo(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(IndecentCodexErrorInfo.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for IndecentCodexErrorInfo"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .fluffyCodexErrorInfo(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

/// Failed to connect to the response SSE stream.
///
/// The response SSE stream disconnected in the middle of a turn before completion.
///
/// Reached the retry limit for responses.
///
/// Returned when `turn/start` or `turn/steer` is submitted while the current active turn
/// cannot accept same-turn steering, for example `/review` or manual `/compact`.
// MARK: - FluffyCodexErrorInfo
public struct FluffyCodexErrorInfo: Codable {
    public let httpConnectionFailed: FluffyHTTPConnectionFailed?
    public let responseStreamConnectionFailed: FluffyResponseStreamConnectionFailed?
    public let responseStreamDisconnected: FluffyResponseStreamDisconnected?
    public let responseTooManyFailedAttempts: FluffyResponseTooManyFailedAttempts?
    public let activeTurnNotSteerable: FluffyActiveTurnNotSteerable?

    public init(httpConnectionFailed: FluffyHTTPConnectionFailed?, responseStreamConnectionFailed: FluffyResponseStreamConnectionFailed?, responseStreamDisconnected: FluffyResponseStreamDisconnected?, responseTooManyFailedAttempts: FluffyResponseTooManyFailedAttempts?, activeTurnNotSteerable: FluffyActiveTurnNotSteerable?) {
        self.httpConnectionFailed = httpConnectionFailed
        self.responseStreamConnectionFailed = responseStreamConnectionFailed
        self.responseStreamDisconnected = responseStreamDisconnected
        self.responseTooManyFailedAttempts = responseTooManyFailedAttempts
        self.activeTurnNotSteerable = activeTurnNotSteerable
    }
}

// MARK: FluffyCodexErrorInfo convenience initializers and mutators

public extension FluffyCodexErrorInfo {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyCodexErrorInfo.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpConnectionFailed: FluffyHTTPConnectionFailed?? = nil,
        responseStreamConnectionFailed: FluffyResponseStreamConnectionFailed?? = nil,
        responseStreamDisconnected: FluffyResponseStreamDisconnected?? = nil,
        responseTooManyFailedAttempts: FluffyResponseTooManyFailedAttempts?? = nil,
        activeTurnNotSteerable: FluffyActiveTurnNotSteerable?? = nil
    ) -> FluffyCodexErrorInfo {
        return FluffyCodexErrorInfo(
            httpConnectionFailed: httpConnectionFailed ?? self.httpConnectionFailed,
            responseStreamConnectionFailed: responseStreamConnectionFailed ?? self.responseStreamConnectionFailed,
            responseStreamDisconnected: responseStreamDisconnected ?? self.responseStreamDisconnected,
            responseTooManyFailedAttempts: responseTooManyFailedAttempts ?? self.responseTooManyFailedAttempts,
            activeTurnNotSteerable: activeTurnNotSteerable ?? self.activeTurnNotSteerable
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyActiveTurnNotSteerable
public struct FluffyActiveTurnNotSteerable: Codable {
    public let turnKind: NonSteerableTurnKind

    public init(turnKind: NonSteerableTurnKind) {
        self.turnKind = turnKind
    }
}

// MARK: FluffyActiveTurnNotSteerable convenience initializers and mutators

public extension FluffyActiveTurnNotSteerable {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyActiveTurnNotSteerable.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        turnKind: NonSteerableTurnKind? = nil
    ) -> FluffyActiveTurnNotSteerable {
        return FluffyActiveTurnNotSteerable(
            turnKind: turnKind ?? self.turnKind
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyHTTPConnectionFailed
public struct FluffyHTTPConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: FluffyHTTPConnectionFailed convenience initializers and mutators

public extension FluffyHTTPConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyHTTPConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> FluffyHTTPConnectionFailed {
        return FluffyHTTPConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyResponseStreamConnectionFailed
public struct FluffyResponseStreamConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: FluffyResponseStreamConnectionFailed convenience initializers and mutators

public extension FluffyResponseStreamConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyResponseStreamConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> FluffyResponseStreamConnectionFailed {
        return FluffyResponseStreamConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyResponseStreamDisconnected
public struct FluffyResponseStreamDisconnected: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: FluffyResponseStreamDisconnected convenience initializers and mutators

public extension FluffyResponseStreamDisconnected {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyResponseStreamDisconnected.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> FluffyResponseStreamDisconnected {
        return FluffyResponseStreamDisconnected(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyResponseTooManyFailedAttempts
public struct FluffyResponseTooManyFailedAttempts: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: FluffyResponseTooManyFailedAttempts convenience initializers and mutators

public extension FluffyResponseTooManyFailedAttempts {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyResponseTooManyFailedAttempts.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> FluffyResponseTooManyFailedAttempts {
        return FluffyResponseTooManyFailedAttempts(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// EXPERIMENTAL - proposed plan item content. The completed plan item is authoritative and
/// may not match the concatenation of `PlanDelta` text.
///
/// Display item emitted by the interruptible `clock.sleep` tool.
// MARK: - FluffyThreadItem
public struct FluffyThreadItem: Codable {
    public let clientID: String?
    public let content: [HilariousUserInput]?
    /// Unique identifier for this collab tool call.
    public let id: String
    public let type: ThreadItemType
    public let fragments: [FluffyHookPromptFragment]?
    public let memoryCitation: FluffyMemoryCitation?
    public let phase: MessagePhase?
    public let text: String?
    public let summary: [String]?
    /// The command's output, aggregated from stdout and stderr.
    public let aggregatedOutput: String?
    /// The command to be executed.
    public let command: String?
    /// A best-effort parsing of the command to understand the action(s) it will perform. This
    /// returns a list of CommandAction objects because a single shell command may be composed of
    /// many commands piped together.
    public let commandActions: [FluffyCommandAction]?
    /// The command's working directory.
    public let cwd: String?
    /// The duration of the command execution in milliseconds.
    ///
    /// The duration of the MCP tool call in milliseconds.
    ///
    /// The duration of the dynamic tool call in milliseconds.
    public let durationMS: Int?
    /// The command's exit code.
    public let exitCode: Int?
    /// Trusted first-party plugin id when this command resolves to one plugin script.
    public let pluginID: String?
    /// Identifier for the underlying PTY process (when available).
    public let processID: String?
    /// Safe plugin-relative path when this command resolves to one plugin script.
    public let scriptPath: String?
    public let source: CommandExecutionSource?
    /// Current status of the collab tool call.
    public let status: String?
    public let changes: [FluffyFileUpdateChange]?
    public let appContext: FluffyMCPToolCallAppContext?
    public let arguments: JSONAny?
    public let error: FluffyMCPToolCallError?
    /// Deprecated: use `appContext.resourceUri` instead.
    public let mcpAppResourceURI: String?
    public let readOnlyHint: Bool?
    public let result: FluffyResult?
    public let server: String?
    /// Name of the collab tool that was invoked.
    public let tool: String?
    public let contentItems: [FluffyDynamicToolCallOutputContentItem]?
    public let namespace: String?
    public let success: Bool?
    /// Last known status of the target agents, when available.
    public let agentsStates: [String: FluffyCollabAgentState]?
    /// Model requested for the spawned agent, when applicable.
    public let model: String?
    /// Prompt text sent as part of the collab tool call, when available.
    public let prompt: String?
    /// Reasoning effort requested for the spawned agent, when applicable.
    public let reasoningEffort: String?
    /// Thread ID of the receiving agent, when applicable. In case of spawn operation, this
    /// corresponds to the newly spawned agent.
    public let receiverThreadIDS: [String]?
    /// Thread ID of the agent issuing the collab request.
    public let senderThreadID: String?
    public let agentPath, agentThreadID: String?
    public let kind: SubAgentActivityKind?
    public let action: FluffyWebSearchAction?
    public let query: String?
    /// Structured search results returned out-of-band by standalone web search.
    ///
    /// These stay as opaque JSON at the extension/app-server boundary so new result fields and
    /// result types can pass through without a Codex release.
    public let results: [JSONAny]?
    public let path: String?
    public let revisedPrompt, savedPath: String?
    public let review: String?

    public enum CodingKeys: String, CodingKey {
        case clientID = "clientId"
        case content, id, type, fragments, memoryCitation, phase, text, summary, aggregatedOutput, command, commandActions, cwd
        case durationMS = "durationMs"
        case exitCode
        case pluginID = "pluginId"
        case processID = "processId"
        case scriptPath, source, status, changes, appContext, arguments, error
        case mcpAppResourceURI = "mcpAppResourceUri"
        case readOnlyHint, result, server, tool, contentItems, namespace, success, agentsStates, model, prompt, reasoningEffort
        case receiverThreadIDS = "receiverThreadIds"
        case senderThreadID = "senderThreadId"
        case agentPath
        case agentThreadID = "agentThreadId"
        case kind, action, query, results, path, revisedPrompt, savedPath, review
    }

    public init(clientID: String?, content: [HilariousUserInput]?, id: String, type: ThreadItemType, fragments: [FluffyHookPromptFragment]?, memoryCitation: FluffyMemoryCitation?, phase: MessagePhase?, text: String?, summary: [String]?, aggregatedOutput: String?, command: String?, commandActions: [FluffyCommandAction]?, cwd: String?, durationMS: Int?, exitCode: Int?, pluginID: String?, processID: String?, scriptPath: String?, source: CommandExecutionSource?, status: String?, changes: [FluffyFileUpdateChange]?, appContext: FluffyMCPToolCallAppContext?, arguments: JSONAny?, error: FluffyMCPToolCallError?, mcpAppResourceURI: String?, readOnlyHint: Bool?, result: FluffyResult?, server: String?, tool: String?, contentItems: [FluffyDynamicToolCallOutputContentItem]?, namespace: String?, success: Bool?, agentsStates: [String: FluffyCollabAgentState]?, model: String?, prompt: String?, reasoningEffort: String?, receiverThreadIDS: [String]?, senderThreadID: String?, agentPath: String?, agentThreadID: String?, kind: SubAgentActivityKind?, action: FluffyWebSearchAction?, query: String?, results: [JSONAny]?, path: String?, revisedPrompt: String?, savedPath: String?, review: String?) {
        self.clientID = clientID
        self.content = content
        self.id = id
        self.type = type
        self.fragments = fragments
        self.memoryCitation = memoryCitation
        self.phase = phase
        self.text = text
        self.summary = summary
        self.aggregatedOutput = aggregatedOutput
        self.command = command
        self.commandActions = commandActions
        self.cwd = cwd
        self.durationMS = durationMS
        self.exitCode = exitCode
        self.pluginID = pluginID
        self.processID = processID
        self.scriptPath = scriptPath
        self.source = source
        self.status = status
        self.changes = changes
        self.appContext = appContext
        self.arguments = arguments
        self.error = error
        self.mcpAppResourceURI = mcpAppResourceURI
        self.readOnlyHint = readOnlyHint
        self.result = result
        self.server = server
        self.tool = tool
        self.contentItems = contentItems
        self.namespace = namespace
        self.success = success
        self.agentsStates = agentsStates
        self.model = model
        self.prompt = prompt
        self.reasoningEffort = reasoningEffort
        self.receiverThreadIDS = receiverThreadIDS
        self.senderThreadID = senderThreadID
        self.agentPath = agentPath
        self.agentThreadID = agentThreadID
        self.kind = kind
        self.action = action
        self.query = query
        self.results = results
        self.path = path
        self.revisedPrompt = revisedPrompt
        self.savedPath = savedPath
        self.review = review
    }
}

// MARK: FluffyThreadItem convenience initializers and mutators

public extension FluffyThreadItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyThreadItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        clientID: String?? = nil,
        content: [HilariousUserInput]?? = nil,
        id: String? = nil,
        type: ThreadItemType? = nil,
        fragments: [FluffyHookPromptFragment]?? = nil,
        memoryCitation: FluffyMemoryCitation?? = nil,
        phase: MessagePhase?? = nil,
        text: String?? = nil,
        summary: [String]?? = nil,
        aggregatedOutput: String?? = nil,
        command: String?? = nil,
        commandActions: [FluffyCommandAction]?? = nil,
        cwd: String?? = nil,
        durationMS: Int?? = nil,
        exitCode: Int?? = nil,
        pluginID: String?? = nil,
        processID: String?? = nil,
        scriptPath: String?? = nil,
        source: CommandExecutionSource?? = nil,
        status: String?? = nil,
        changes: [FluffyFileUpdateChange]?? = nil,
        appContext: FluffyMCPToolCallAppContext?? = nil,
        arguments: JSONAny?? = nil,
        error: FluffyMCPToolCallError?? = nil,
        mcpAppResourceURI: String?? = nil,
        readOnlyHint: Bool?? = nil,
        result: FluffyResult?? = nil,
        server: String?? = nil,
        tool: String?? = nil,
        contentItems: [FluffyDynamicToolCallOutputContentItem]?? = nil,
        namespace: String?? = nil,
        success: Bool?? = nil,
        agentsStates: [String: FluffyCollabAgentState]?? = nil,
        model: String?? = nil,
        prompt: String?? = nil,
        reasoningEffort: String?? = nil,
        receiverThreadIDS: [String]?? = nil,
        senderThreadID: String?? = nil,
        agentPath: String?? = nil,
        agentThreadID: String?? = nil,
        kind: SubAgentActivityKind?? = nil,
        action: FluffyWebSearchAction?? = nil,
        query: String?? = nil,
        results: [JSONAny]?? = nil,
        path: String?? = nil,
        revisedPrompt: String?? = nil,
        savedPath: String?? = nil,
        review: String?? = nil
    ) -> FluffyThreadItem {
        return FluffyThreadItem(
            clientID: clientID ?? self.clientID,
            content: content ?? self.content,
            id: id ?? self.id,
            type: type ?? self.type,
            fragments: fragments ?? self.fragments,
            memoryCitation: memoryCitation ?? self.memoryCitation,
            phase: phase ?? self.phase,
            text: text ?? self.text,
            summary: summary ?? self.summary,
            aggregatedOutput: aggregatedOutput ?? self.aggregatedOutput,
            command: command ?? self.command,
            commandActions: commandActions ?? self.commandActions,
            cwd: cwd ?? self.cwd,
            durationMS: durationMS ?? self.durationMS,
            exitCode: exitCode ?? self.exitCode,
            pluginID: pluginID ?? self.pluginID,
            processID: processID ?? self.processID,
            scriptPath: scriptPath ?? self.scriptPath,
            source: source ?? self.source,
            status: status ?? self.status,
            changes: changes ?? self.changes,
            appContext: appContext ?? self.appContext,
            arguments: arguments ?? self.arguments,
            error: error ?? self.error,
            mcpAppResourceURI: mcpAppResourceURI ?? self.mcpAppResourceURI,
            readOnlyHint: readOnlyHint ?? self.readOnlyHint,
            result: result ?? self.result,
            server: server ?? self.server,
            tool: tool ?? self.tool,
            contentItems: contentItems ?? self.contentItems,
            namespace: namespace ?? self.namespace,
            success: success ?? self.success,
            agentsStates: agentsStates ?? self.agentsStates,
            model: model ?? self.model,
            prompt: prompt ?? self.prompt,
            reasoningEffort: reasoningEffort ?? self.reasoningEffort,
            receiverThreadIDS: receiverThreadIDS ?? self.receiverThreadIDS,
            senderThreadID: senderThreadID ?? self.senderThreadID,
            agentPath: agentPath ?? self.agentPath,
            agentThreadID: agentThreadID ?? self.agentThreadID,
            kind: kind ?? self.kind,
            action: action ?? self.action,
            query: query ?? self.query,
            results: results ?? self.results,
            path: path ?? self.path,
            revisedPrompt: revisedPrompt ?? self.revisedPrompt,
            savedPath: savedPath ?? self.savedPath,
            review: review ?? self.review
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyWebSearchAction
public struct FluffyWebSearchAction: Codable {
    public let queries: [String]?
    public let query: String?
    public let type: WebSearchActionType
    public let url, pattern: String?

    public init(queries: [String]?, query: String?, type: WebSearchActionType, url: String?, pattern: String?) {
        self.queries = queries
        self.query = query
        self.type = type
        self.url = url
        self.pattern = pattern
    }
}

// MARK: FluffyWebSearchAction convenience initializers and mutators

public extension FluffyWebSearchAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyWebSearchAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        queries: [String]?? = nil,
        query: String?? = nil,
        type: WebSearchActionType? = nil,
        url: String?? = nil,
        pattern: String?? = nil
    ) -> FluffyWebSearchAction {
        return FluffyWebSearchAction(
            queries: queries ?? self.queries,
            query: query ?? self.query,
            type: type ?? self.type,
            url: url ?? self.url,
            pattern: pattern ?? self.pattern
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyCollabAgentState
public struct FluffyCollabAgentState: Codable {
    public let message: String?
    public let status: CollabAgentStatus

    public init(message: String?, status: CollabAgentStatus) {
        self.message = message
        self.status = status
    }
}

// MARK: FluffyCollabAgentState convenience initializers and mutators

public extension FluffyCollabAgentState {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyCollabAgentState.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String?? = nil,
        status: CollabAgentStatus? = nil
    ) -> FluffyCollabAgentState {
        return FluffyCollabAgentState(
            message: message ?? self.message,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyMCPToolCallAppContext
public struct FluffyMCPToolCallAppContext: Codable {
    public let actionName, appName: String?
    public let connectorID: String
    public let linkID, resourceURI: String?

    public enum CodingKeys: String, CodingKey {
        case actionName, appName
        case connectorID = "connectorId"
        case linkID = "linkId"
        case resourceURI = "resourceUri"
    }

    public init(actionName: String?, appName: String?, connectorID: String, linkID: String?, resourceURI: String?) {
        self.actionName = actionName
        self.appName = appName
        self.connectorID = connectorID
        self.linkID = linkID
        self.resourceURI = resourceURI
    }
}

// MARK: FluffyMCPToolCallAppContext convenience initializers and mutators

public extension FluffyMCPToolCallAppContext {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyMCPToolCallAppContext.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        actionName: String?? = nil,
        appName: String?? = nil,
        connectorID: String? = nil,
        linkID: String?? = nil,
        resourceURI: String?? = nil
    ) -> FluffyMCPToolCallAppContext {
        return FluffyMCPToolCallAppContext(
            actionName: actionName ?? self.actionName,
            appName: appName ?? self.appName,
            connectorID: connectorID ?? self.connectorID,
            linkID: linkID ?? self.linkID,
            resourceURI: resourceURI ?? self.resourceURI
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyFileUpdateChange
public struct FluffyFileUpdateChange: Codable {
    public let diff: String
    public let kind: FluffyPatchChangeKind
    public let path: String

    public init(diff: String, kind: FluffyPatchChangeKind, path: String) {
        self.diff = diff
        self.kind = kind
        self.path = path
    }
}

// MARK: FluffyFileUpdateChange convenience initializers and mutators

public extension FluffyFileUpdateChange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyFileUpdateChange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        diff: String? = nil,
        kind: FluffyPatchChangeKind? = nil,
        path: String? = nil
    ) -> FluffyFileUpdateChange {
        return FluffyFileUpdateChange(
            diff: diff ?? self.diff,
            kind: kind ?? self.kind,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyPatchChangeKind
public struct FluffyPatchChangeKind: Codable {
    public let type: PatchChangeKindType
    public let movePath: String?

    public enum CodingKeys: String, CodingKey {
        case type
        case movePath = "move_path"
    }

    public init(type: PatchChangeKindType, movePath: String?) {
        self.type = type
        self.movePath = movePath
    }
}

// MARK: FluffyPatchChangeKind convenience initializers and mutators

public extension FluffyPatchChangeKind {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyPatchChangeKind.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: PatchChangeKindType? = nil,
        movePath: String?? = nil
    ) -> FluffyPatchChangeKind {
        return FluffyPatchChangeKind(
            type: type ?? self.type,
            movePath: movePath ?? self.movePath
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyCommandAction
public struct FluffyCommandAction: Codable {
    public let command: String
    public let name: String?
    public let path: String?
    public let type: CommandActionType
    public let query: String?

    public init(command: String, name: String?, path: String?, type: CommandActionType, query: String?) {
        self.command = command
        self.name = name
        self.path = path
        self.type = type
        self.query = query
    }
}

// MARK: FluffyCommandAction convenience initializers and mutators

public extension FluffyCommandAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyCommandAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String? = nil,
        name: String?? = nil,
        path: String?? = nil,
        type: CommandActionType? = nil,
        query: String?? = nil
    ) -> FluffyCommandAction {
        return FluffyCommandAction(
            command: command ?? self.command,
            name: name ?? self.name,
            path: path ?? self.path,
            type: type ?? self.type,
            query: query ?? self.query
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum HilariousUserInput: Codable {
    case fluffyUserInput(FluffyUserInput)
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(FluffyUserInput.self) {
            self = .fluffyUserInput(x)
            return
        }
        throw DecodingError.typeMismatch(HilariousUserInput.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for HilariousUserInput"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .fluffyUserInput(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

// MARK: - FluffyUserInput
public struct FluffyUserInput: Codable {
    public let text: String?
    /// UI-defined spans within `text` used to render or persist special elements.
    public let textElements: [FluffyTextElement]?
    public let type: UserInputType
    public let detail: ImageDetail?
    public let url, path, name: String?

    public enum CodingKeys: String, CodingKey {
        case text
        case textElements = "text_elements"
        case type, detail, url, path, name
    }

    public init(text: String?, textElements: [FluffyTextElement]?, type: UserInputType, detail: ImageDetail?, url: String?, path: String?, name: String?) {
        self.text = text
        self.textElements = textElements
        self.type = type
        self.detail = detail
        self.url = url
        self.path = path
        self.name = name
    }
}

// MARK: FluffyUserInput convenience initializers and mutators

public extension FluffyUserInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyUserInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        textElements: [FluffyTextElement]?? = nil,
        type: UserInputType? = nil,
        detail: ImageDetail?? = nil,
        url: String?? = nil,
        path: String?? = nil,
        name: String?? = nil
    ) -> FluffyUserInput {
        return FluffyUserInput(
            text: text ?? self.text,
            textElements: textElements ?? self.textElements,
            type: type ?? self.type,
            detail: detail ?? self.detail,
            url: url ?? self.url,
            path: path ?? self.path,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyTextElement
public struct FluffyTextElement: Codable {
    /// Byte range in the parent `text` buffer that this element occupies.
    public let byteRange: TentacledByteRange
    /// Optional human-readable placeholder for the element, displayed in the UI.
    public let placeholder: String?

    public init(byteRange: TentacledByteRange, placeholder: String?) {
        self.byteRange = byteRange
        self.placeholder = placeholder
    }
}

// MARK: FluffyTextElement convenience initializers and mutators

public extension FluffyTextElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyTextElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byteRange: TentacledByteRange? = nil,
        placeholder: String?? = nil
    ) -> FluffyTextElement {
        return FluffyTextElement(
            byteRange: byteRange ?? self.byteRange,
            placeholder: placeholder ?? self.placeholder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Byte range in the parent `text` buffer that this element occupies.
// MARK: - TentacledByteRange
public struct TentacledByteRange: Codable {
    public let end, start: Int

    public init(end: Int, start: Int) {
        self.end = end
        self.start = start
    }
}

// MARK: TentacledByteRange convenience initializers and mutators

public extension TentacledByteRange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledByteRange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        end: Int? = nil,
        start: Int? = nil
    ) -> TentacledByteRange {
        return TentacledByteRange(
            end: end ?? self.end,
            start: start ?? self.start
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyDynamicToolCallOutputContentItem
public struct FluffyDynamicToolCallOutputContentItem: Codable {
    public let text: String?
    public let type: InputDynamicToolCallOutputContentItemType
    public let imageURL, audioURL: String?

    public enum CodingKeys: String, CodingKey {
        case text, type
        case imageURL = "imageUrl"
        case audioURL = "audioUrl"
    }

    public init(text: String?, type: InputDynamicToolCallOutputContentItemType, imageURL: String?, audioURL: String?) {
        self.text = text
        self.type = type
        self.imageURL = imageURL
        self.audioURL = audioURL
    }
}

// MARK: FluffyDynamicToolCallOutputContentItem convenience initializers and mutators

public extension FluffyDynamicToolCallOutputContentItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyDynamicToolCallOutputContentItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        type: InputDynamicToolCallOutputContentItemType? = nil,
        imageURL: String?? = nil,
        audioURL: String?? = nil
    ) -> FluffyDynamicToolCallOutputContentItem {
        return FluffyDynamicToolCallOutputContentItem(
            text: text ?? self.text,
            type: type ?? self.type,
            imageURL: imageURL ?? self.imageURL,
            audioURL: audioURL ?? self.audioURL
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyMCPToolCallError
public struct FluffyMCPToolCallError: Codable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// MARK: FluffyMCPToolCallError convenience initializers and mutators

public extension FluffyMCPToolCallError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyMCPToolCallError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String? = nil
    ) -> FluffyMCPToolCallError {
        return FluffyMCPToolCallError(
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyHookPromptFragment
public struct FluffyHookPromptFragment: Codable {
    public let hookRunID, text: String

    public enum CodingKeys: String, CodingKey {
        case hookRunID = "hookRunId"
        case text
    }

    public init(hookRunID: String, text: String) {
        self.hookRunID = hookRunID
        self.text = text
    }
}

// MARK: FluffyHookPromptFragment convenience initializers and mutators

public extension FluffyHookPromptFragment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyHookPromptFragment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hookRunID: String? = nil,
        text: String? = nil
    ) -> FluffyHookPromptFragment {
        return FluffyHookPromptFragment(
            hookRunID: hookRunID ?? self.hookRunID,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyMemoryCitation
public struct FluffyMemoryCitation: Codable {
    public let entries: [FluffyMemoryCitationEntry]
    public let threadIDS: [String]

    public enum CodingKeys: String, CodingKey {
        case entries
        case threadIDS = "threadIds"
    }

    public init(entries: [FluffyMemoryCitationEntry], threadIDS: [String]) {
        self.entries = entries
        self.threadIDS = threadIDS
    }
}

// MARK: FluffyMemoryCitation convenience initializers and mutators

public extension FluffyMemoryCitation {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyMemoryCitation.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        entries: [FluffyMemoryCitationEntry]? = nil,
        threadIDS: [String]? = nil
    ) -> FluffyMemoryCitation {
        return FluffyMemoryCitation(
            entries: entries ?? self.entries,
            threadIDS: threadIDS ?? self.threadIDS
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - FluffyMemoryCitationEntry
public struct FluffyMemoryCitationEntry: Codable {
    public let lineEnd, lineStart: Int
    public let note, path: String

    public init(lineEnd: Int, lineStart: Int, note: String, path: String) {
        self.lineEnd = lineEnd
        self.lineStart = lineStart
        self.note = note
        self.path = path
    }
}

// MARK: FluffyMemoryCitationEntry convenience initializers and mutators

public extension FluffyMemoryCitationEntry {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyMemoryCitationEntry.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        lineEnd: Int? = nil,
        lineStart: Int? = nil,
        note: String? = nil,
        path: String? = nil
    ) -> FluffyMemoryCitationEntry {
        return FluffyMemoryCitationEntry(
            lineEnd: lineEnd ?? self.lineEnd,
            lineStart: lineStart ?? self.lineStart,
            note: note ?? self.note,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum FluffyResult: Codable {
    case fluffyMCPToolCallResult(FluffyMCPToolCallResult)
    case string(String)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(FluffyMCPToolCallResult.self) {
            self = .fluffyMCPToolCallResult(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(FluffyResult.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for FluffyResult"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .fluffyMCPToolCallResult(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - FluffyMCPToolCallResult
public struct FluffyMCPToolCallResult: Codable {
    public let meta: JSONAny?
    public let content: [JSONAny]
    public let structuredContent: JSONAny?

    public enum CodingKeys: String, CodingKey {
        case meta = "_meta"
        case content, structuredContent
    }

    public init(meta: JSONAny?, content: [JSONAny], structuredContent: JSONAny?) {
        self.meta = meta
        self.content = content
        self.structuredContent = structuredContent
    }
}

// MARK: FluffyMCPToolCallResult convenience initializers and mutators

public extension FluffyMCPToolCallResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FluffyMCPToolCallResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        meta: JSONAny?? = nil,
        content: [JSONAny]? = nil,
        structuredContent: JSONAny?? = nil
    ) -> FluffyMCPToolCallResult {
        return FluffyMCPToolCallResult(
            meta: meta ?? self.meta,
            content: content ?? self.content,
            structuredContent: structuredContent ?? self.structuredContent
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnCompletedNotification
public struct TurnCompletedNotification: Codable {
    public let threadID: String
    public let turn: TurnCompletedNotificationTurn

    public enum CodingKeys: String, CodingKey {
        case threadID = "threadId"
        case turn
    }

    public init(threadID: String, turn: TurnCompletedNotificationTurn) {
        self.threadID = threadID
        self.turn = turn
    }
}

// MARK: TurnCompletedNotification convenience initializers and mutators

public extension TurnCompletedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnCompletedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        threadID: String? = nil,
        turn: TurnCompletedNotificationTurn? = nil
    ) -> TurnCompletedNotification {
        return TurnCompletedNotification(
            threadID: threadID ?? self.threadID,
            turn: turn ?? self.turn
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnCompletedNotificationTurn
public struct TurnCompletedNotificationTurn: Codable {
    /// Unix timestamp (in seconds) when the turn completed.
    public let completedAt: Int?
    /// Duration between turn start and completion in milliseconds, if known.
    public let durationMS: Int?
    /// Only populated when the Turn's status is failed.
    public let error: TentacledTurnError?
    /// Identifier for this turn. Codex-generated turn IDs are UUIDv7.
    public let id: String
    /// Thread items currently included in this turn payload.
    public let items: [TentacledThreadItem]
    /// Describes how much of `items` has been loaded for this turn.
    public let itemsView: TurnItemsView?
    /// Unix timestamp (in seconds) when the turn started.
    public let startedAt: Int?
    public let status: TurnStatus

    public enum CodingKeys: String, CodingKey {
        case completedAt
        case durationMS = "durationMs"
        case error, id, items, itemsView, startedAt, status
    }

    public init(completedAt: Int?, durationMS: Int?, error: TentacledTurnError?, id: String, items: [TentacledThreadItem], itemsView: TurnItemsView?, startedAt: Int?, status: TurnStatus) {
        self.completedAt = completedAt
        self.durationMS = durationMS
        self.error = error
        self.id = id
        self.items = items
        self.itemsView = itemsView
        self.startedAt = startedAt
        self.status = status
    }
}

// MARK: TurnCompletedNotificationTurn convenience initializers and mutators

public extension TurnCompletedNotificationTurn {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnCompletedNotificationTurn.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        completedAt: Int?? = nil,
        durationMS: Int?? = nil,
        error: TentacledTurnError?? = nil,
        id: String? = nil,
        items: [TentacledThreadItem]? = nil,
        itemsView: TurnItemsView?? = nil,
        startedAt: Int?? = nil,
        status: TurnStatus? = nil
    ) -> TurnCompletedNotificationTurn {
        return TurnCompletedNotificationTurn(
            completedAt: completedAt ?? self.completedAt,
            durationMS: durationMS ?? self.durationMS,
            error: error ?? self.error,
            id: id ?? self.id,
            items: items ?? self.items,
            itemsView: itemsView ?? self.itemsView,
            startedAt: startedAt ?? self.startedAt,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledTurnError
public struct TentacledTurnError: Codable {
    public let additionalDetails: String?
    public let codexErrorInfo: HilariousCodexErrorInfo?
    public let message: String

    public init(additionalDetails: String?, codexErrorInfo: HilariousCodexErrorInfo?, message: String) {
        self.additionalDetails = additionalDetails
        self.codexErrorInfo = codexErrorInfo
        self.message = message
    }
}

// MARK: TentacledTurnError convenience initializers and mutators

public extension TentacledTurnError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledTurnError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        additionalDetails: String?? = nil,
        codexErrorInfo: HilariousCodexErrorInfo?? = nil,
        message: String? = nil
    ) -> TentacledTurnError {
        return TentacledTurnError(
            additionalDetails: additionalDetails ?? self.additionalDetails,
            codexErrorInfo: codexErrorInfo ?? self.codexErrorInfo,
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum HilariousCodexErrorInfo: Codable {
    case enumeration(CodexErrorInfoEnum)
    case tentacledCodexErrorInfo(TentacledCodexErrorInfo)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(CodexErrorInfoEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(TentacledCodexErrorInfo.self) {
            self = .tentacledCodexErrorInfo(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(HilariousCodexErrorInfo.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for HilariousCodexErrorInfo"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .tentacledCodexErrorInfo(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

/// Failed to connect to the response SSE stream.
///
/// The response SSE stream disconnected in the middle of a turn before completion.
///
/// Reached the retry limit for responses.
///
/// Returned when `turn/start` or `turn/steer` is submitted while the current active turn
/// cannot accept same-turn steering, for example `/review` or manual `/compact`.
// MARK: - TentacledCodexErrorInfo
public struct TentacledCodexErrorInfo: Codable {
    public let httpConnectionFailed: TentacledHTTPConnectionFailed?
    public let responseStreamConnectionFailed: TentacledResponseStreamConnectionFailed?
    public let responseStreamDisconnected: TentacledResponseStreamDisconnected?
    public let responseTooManyFailedAttempts: TentacledResponseTooManyFailedAttempts?
    public let activeTurnNotSteerable: TentacledActiveTurnNotSteerable?

    public init(httpConnectionFailed: TentacledHTTPConnectionFailed?, responseStreamConnectionFailed: TentacledResponseStreamConnectionFailed?, responseStreamDisconnected: TentacledResponseStreamDisconnected?, responseTooManyFailedAttempts: TentacledResponseTooManyFailedAttempts?, activeTurnNotSteerable: TentacledActiveTurnNotSteerable?) {
        self.httpConnectionFailed = httpConnectionFailed
        self.responseStreamConnectionFailed = responseStreamConnectionFailed
        self.responseStreamDisconnected = responseStreamDisconnected
        self.responseTooManyFailedAttempts = responseTooManyFailedAttempts
        self.activeTurnNotSteerable = activeTurnNotSteerable
    }
}

// MARK: TentacledCodexErrorInfo convenience initializers and mutators

public extension TentacledCodexErrorInfo {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledCodexErrorInfo.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpConnectionFailed: TentacledHTTPConnectionFailed?? = nil,
        responseStreamConnectionFailed: TentacledResponseStreamConnectionFailed?? = nil,
        responseStreamDisconnected: TentacledResponseStreamDisconnected?? = nil,
        responseTooManyFailedAttempts: TentacledResponseTooManyFailedAttempts?? = nil,
        activeTurnNotSteerable: TentacledActiveTurnNotSteerable?? = nil
    ) -> TentacledCodexErrorInfo {
        return TentacledCodexErrorInfo(
            httpConnectionFailed: httpConnectionFailed ?? self.httpConnectionFailed,
            responseStreamConnectionFailed: responseStreamConnectionFailed ?? self.responseStreamConnectionFailed,
            responseStreamDisconnected: responseStreamDisconnected ?? self.responseStreamDisconnected,
            responseTooManyFailedAttempts: responseTooManyFailedAttempts ?? self.responseTooManyFailedAttempts,
            activeTurnNotSteerable: activeTurnNotSteerable ?? self.activeTurnNotSteerable
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledActiveTurnNotSteerable
public struct TentacledActiveTurnNotSteerable: Codable {
    public let turnKind: NonSteerableTurnKind

    public init(turnKind: NonSteerableTurnKind) {
        self.turnKind = turnKind
    }
}

// MARK: TentacledActiveTurnNotSteerable convenience initializers and mutators

public extension TentacledActiveTurnNotSteerable {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledActiveTurnNotSteerable.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        turnKind: NonSteerableTurnKind? = nil
    ) -> TentacledActiveTurnNotSteerable {
        return TentacledActiveTurnNotSteerable(
            turnKind: turnKind ?? self.turnKind
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledHTTPConnectionFailed
public struct TentacledHTTPConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: TentacledHTTPConnectionFailed convenience initializers and mutators

public extension TentacledHTTPConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledHTTPConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> TentacledHTTPConnectionFailed {
        return TentacledHTTPConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledResponseStreamConnectionFailed
public struct TentacledResponseStreamConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: TentacledResponseStreamConnectionFailed convenience initializers and mutators

public extension TentacledResponseStreamConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledResponseStreamConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> TentacledResponseStreamConnectionFailed {
        return TentacledResponseStreamConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledResponseStreamDisconnected
public struct TentacledResponseStreamDisconnected: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: TentacledResponseStreamDisconnected convenience initializers and mutators

public extension TentacledResponseStreamDisconnected {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledResponseStreamDisconnected.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> TentacledResponseStreamDisconnected {
        return TentacledResponseStreamDisconnected(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledResponseTooManyFailedAttempts
public struct TentacledResponseTooManyFailedAttempts: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: TentacledResponseTooManyFailedAttempts convenience initializers and mutators

public extension TentacledResponseTooManyFailedAttempts {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledResponseTooManyFailedAttempts.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> TentacledResponseTooManyFailedAttempts {
        return TentacledResponseTooManyFailedAttempts(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// EXPERIMENTAL - proposed plan item content. The completed plan item is authoritative and
/// may not match the concatenation of `PlanDelta` text.
///
/// Display item emitted by the interruptible `clock.sleep` tool.
// MARK: - TentacledThreadItem
public struct TentacledThreadItem: Codable {
    public let clientID: String?
    public let content: [AmbitiousUserInput]?
    /// Unique identifier for this collab tool call.
    public let id: String
    public let type: ThreadItemType
    public let fragments: [TentacledHookPromptFragment]?
    public let memoryCitation: TentacledMemoryCitation?
    public let phase: MessagePhase?
    public let text: String?
    public let summary: [String]?
    /// The command's output, aggregated from stdout and stderr.
    public let aggregatedOutput: String?
    /// The command to be executed.
    public let command: String?
    /// A best-effort parsing of the command to understand the action(s) it will perform. This
    /// returns a list of CommandAction objects because a single shell command may be composed of
    /// many commands piped together.
    public let commandActions: [TentacledCommandAction]?
    /// The command's working directory.
    public let cwd: String?
    /// The duration of the command execution in milliseconds.
    ///
    /// The duration of the MCP tool call in milliseconds.
    ///
    /// The duration of the dynamic tool call in milliseconds.
    public let durationMS: Int?
    /// The command's exit code.
    public let exitCode: Int?
    /// Trusted first-party plugin id when this command resolves to one plugin script.
    public let pluginID: String?
    /// Identifier for the underlying PTY process (when available).
    public let processID: String?
    /// Safe plugin-relative path when this command resolves to one plugin script.
    public let scriptPath: String?
    public let source: CommandExecutionSource?
    /// Current status of the collab tool call.
    public let status: String?
    public let changes: [TentacledFileUpdateChange]?
    public let appContext: TentacledMCPToolCallAppContext?
    public let arguments: JSONAny?
    public let error: TentacledMCPToolCallError?
    /// Deprecated: use `appContext.resourceUri` instead.
    public let mcpAppResourceURI: String?
    public let readOnlyHint: Bool?
    public let result: TentacledResult?
    public let server: String?
    /// Name of the collab tool that was invoked.
    public let tool: String?
    public let contentItems: [TentacledDynamicToolCallOutputContentItem]?
    public let namespace: String?
    public let success: Bool?
    /// Last known status of the target agents, when available.
    public let agentsStates: [String: TentacledCollabAgentState]?
    /// Model requested for the spawned agent, when applicable.
    public let model: String?
    /// Prompt text sent as part of the collab tool call, when available.
    public let prompt: String?
    /// Reasoning effort requested for the spawned agent, when applicable.
    public let reasoningEffort: String?
    /// Thread ID of the receiving agent, when applicable. In case of spawn operation, this
    /// corresponds to the newly spawned agent.
    public let receiverThreadIDS: [String]?
    /// Thread ID of the agent issuing the collab request.
    public let senderThreadID: String?
    public let agentPath, agentThreadID: String?
    public let kind: SubAgentActivityKind?
    public let action: TentacledWebSearchAction?
    public let query: String?
    /// Structured search results returned out-of-band by standalone web search.
    ///
    /// These stay as opaque JSON at the extension/app-server boundary so new result fields and
    /// result types can pass through without a Codex release.
    public let results: [JSONAny]?
    public let path: String?
    public let revisedPrompt, savedPath: String?
    public let review: String?

    public enum CodingKeys: String, CodingKey {
        case clientID = "clientId"
        case content, id, type, fragments, memoryCitation, phase, text, summary, aggregatedOutput, command, commandActions, cwd
        case durationMS = "durationMs"
        case exitCode
        case pluginID = "pluginId"
        case processID = "processId"
        case scriptPath, source, status, changes, appContext, arguments, error
        case mcpAppResourceURI = "mcpAppResourceUri"
        case readOnlyHint, result, server, tool, contentItems, namespace, success, agentsStates, model, prompt, reasoningEffort
        case receiverThreadIDS = "receiverThreadIds"
        case senderThreadID = "senderThreadId"
        case agentPath
        case agentThreadID = "agentThreadId"
        case kind, action, query, results, path, revisedPrompt, savedPath, review
    }

    public init(clientID: String?, content: [AmbitiousUserInput]?, id: String, type: ThreadItemType, fragments: [TentacledHookPromptFragment]?, memoryCitation: TentacledMemoryCitation?, phase: MessagePhase?, text: String?, summary: [String]?, aggregatedOutput: String?, command: String?, commandActions: [TentacledCommandAction]?, cwd: String?, durationMS: Int?, exitCode: Int?, pluginID: String?, processID: String?, scriptPath: String?, source: CommandExecutionSource?, status: String?, changes: [TentacledFileUpdateChange]?, appContext: TentacledMCPToolCallAppContext?, arguments: JSONAny?, error: TentacledMCPToolCallError?, mcpAppResourceURI: String?, readOnlyHint: Bool?, result: TentacledResult?, server: String?, tool: String?, contentItems: [TentacledDynamicToolCallOutputContentItem]?, namespace: String?, success: Bool?, agentsStates: [String: TentacledCollabAgentState]?, model: String?, prompt: String?, reasoningEffort: String?, receiverThreadIDS: [String]?, senderThreadID: String?, agentPath: String?, agentThreadID: String?, kind: SubAgentActivityKind?, action: TentacledWebSearchAction?, query: String?, results: [JSONAny]?, path: String?, revisedPrompt: String?, savedPath: String?, review: String?) {
        self.clientID = clientID
        self.content = content
        self.id = id
        self.type = type
        self.fragments = fragments
        self.memoryCitation = memoryCitation
        self.phase = phase
        self.text = text
        self.summary = summary
        self.aggregatedOutput = aggregatedOutput
        self.command = command
        self.commandActions = commandActions
        self.cwd = cwd
        self.durationMS = durationMS
        self.exitCode = exitCode
        self.pluginID = pluginID
        self.processID = processID
        self.scriptPath = scriptPath
        self.source = source
        self.status = status
        self.changes = changes
        self.appContext = appContext
        self.arguments = arguments
        self.error = error
        self.mcpAppResourceURI = mcpAppResourceURI
        self.readOnlyHint = readOnlyHint
        self.result = result
        self.server = server
        self.tool = tool
        self.contentItems = contentItems
        self.namespace = namespace
        self.success = success
        self.agentsStates = agentsStates
        self.model = model
        self.prompt = prompt
        self.reasoningEffort = reasoningEffort
        self.receiverThreadIDS = receiverThreadIDS
        self.senderThreadID = senderThreadID
        self.agentPath = agentPath
        self.agentThreadID = agentThreadID
        self.kind = kind
        self.action = action
        self.query = query
        self.results = results
        self.path = path
        self.revisedPrompt = revisedPrompt
        self.savedPath = savedPath
        self.review = review
    }
}

// MARK: TentacledThreadItem convenience initializers and mutators

public extension TentacledThreadItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledThreadItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        clientID: String?? = nil,
        content: [AmbitiousUserInput]?? = nil,
        id: String? = nil,
        type: ThreadItemType? = nil,
        fragments: [TentacledHookPromptFragment]?? = nil,
        memoryCitation: TentacledMemoryCitation?? = nil,
        phase: MessagePhase?? = nil,
        text: String?? = nil,
        summary: [String]?? = nil,
        aggregatedOutput: String?? = nil,
        command: String?? = nil,
        commandActions: [TentacledCommandAction]?? = nil,
        cwd: String?? = nil,
        durationMS: Int?? = nil,
        exitCode: Int?? = nil,
        pluginID: String?? = nil,
        processID: String?? = nil,
        scriptPath: String?? = nil,
        source: CommandExecutionSource?? = nil,
        status: String?? = nil,
        changes: [TentacledFileUpdateChange]?? = nil,
        appContext: TentacledMCPToolCallAppContext?? = nil,
        arguments: JSONAny?? = nil,
        error: TentacledMCPToolCallError?? = nil,
        mcpAppResourceURI: String?? = nil,
        readOnlyHint: Bool?? = nil,
        result: TentacledResult?? = nil,
        server: String?? = nil,
        tool: String?? = nil,
        contentItems: [TentacledDynamicToolCallOutputContentItem]?? = nil,
        namespace: String?? = nil,
        success: Bool?? = nil,
        agentsStates: [String: TentacledCollabAgentState]?? = nil,
        model: String?? = nil,
        prompt: String?? = nil,
        reasoningEffort: String?? = nil,
        receiverThreadIDS: [String]?? = nil,
        senderThreadID: String?? = nil,
        agentPath: String?? = nil,
        agentThreadID: String?? = nil,
        kind: SubAgentActivityKind?? = nil,
        action: TentacledWebSearchAction?? = nil,
        query: String?? = nil,
        results: [JSONAny]?? = nil,
        path: String?? = nil,
        revisedPrompt: String?? = nil,
        savedPath: String?? = nil,
        review: String?? = nil
    ) -> TentacledThreadItem {
        return TentacledThreadItem(
            clientID: clientID ?? self.clientID,
            content: content ?? self.content,
            id: id ?? self.id,
            type: type ?? self.type,
            fragments: fragments ?? self.fragments,
            memoryCitation: memoryCitation ?? self.memoryCitation,
            phase: phase ?? self.phase,
            text: text ?? self.text,
            summary: summary ?? self.summary,
            aggregatedOutput: aggregatedOutput ?? self.aggregatedOutput,
            command: command ?? self.command,
            commandActions: commandActions ?? self.commandActions,
            cwd: cwd ?? self.cwd,
            durationMS: durationMS ?? self.durationMS,
            exitCode: exitCode ?? self.exitCode,
            pluginID: pluginID ?? self.pluginID,
            processID: processID ?? self.processID,
            scriptPath: scriptPath ?? self.scriptPath,
            source: source ?? self.source,
            status: status ?? self.status,
            changes: changes ?? self.changes,
            appContext: appContext ?? self.appContext,
            arguments: arguments ?? self.arguments,
            error: error ?? self.error,
            mcpAppResourceURI: mcpAppResourceURI ?? self.mcpAppResourceURI,
            readOnlyHint: readOnlyHint ?? self.readOnlyHint,
            result: result ?? self.result,
            server: server ?? self.server,
            tool: tool ?? self.tool,
            contentItems: contentItems ?? self.contentItems,
            namespace: namespace ?? self.namespace,
            success: success ?? self.success,
            agentsStates: agentsStates ?? self.agentsStates,
            model: model ?? self.model,
            prompt: prompt ?? self.prompt,
            reasoningEffort: reasoningEffort ?? self.reasoningEffort,
            receiverThreadIDS: receiverThreadIDS ?? self.receiverThreadIDS,
            senderThreadID: senderThreadID ?? self.senderThreadID,
            agentPath: agentPath ?? self.agentPath,
            agentThreadID: agentThreadID ?? self.agentThreadID,
            kind: kind ?? self.kind,
            action: action ?? self.action,
            query: query ?? self.query,
            results: results ?? self.results,
            path: path ?? self.path,
            revisedPrompt: revisedPrompt ?? self.revisedPrompt,
            savedPath: savedPath ?? self.savedPath,
            review: review ?? self.review
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledWebSearchAction
public struct TentacledWebSearchAction: Codable {
    public let queries: [String]?
    public let query: String?
    public let type: WebSearchActionType
    public let url, pattern: String?

    public init(queries: [String]?, query: String?, type: WebSearchActionType, url: String?, pattern: String?) {
        self.queries = queries
        self.query = query
        self.type = type
        self.url = url
        self.pattern = pattern
    }
}

// MARK: TentacledWebSearchAction convenience initializers and mutators

public extension TentacledWebSearchAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledWebSearchAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        queries: [String]?? = nil,
        query: String?? = nil,
        type: WebSearchActionType? = nil,
        url: String?? = nil,
        pattern: String?? = nil
    ) -> TentacledWebSearchAction {
        return TentacledWebSearchAction(
            queries: queries ?? self.queries,
            query: query ?? self.query,
            type: type ?? self.type,
            url: url ?? self.url,
            pattern: pattern ?? self.pattern
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledCollabAgentState
public struct TentacledCollabAgentState: Codable {
    public let message: String?
    public let status: CollabAgentStatus

    public init(message: String?, status: CollabAgentStatus) {
        self.message = message
        self.status = status
    }
}

// MARK: TentacledCollabAgentState convenience initializers and mutators

public extension TentacledCollabAgentState {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledCollabAgentState.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String?? = nil,
        status: CollabAgentStatus? = nil
    ) -> TentacledCollabAgentState {
        return TentacledCollabAgentState(
            message: message ?? self.message,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledMCPToolCallAppContext
public struct TentacledMCPToolCallAppContext: Codable {
    public let actionName, appName: String?
    public let connectorID: String
    public let linkID, resourceURI: String?

    public enum CodingKeys: String, CodingKey {
        case actionName, appName
        case connectorID = "connectorId"
        case linkID = "linkId"
        case resourceURI = "resourceUri"
    }

    public init(actionName: String?, appName: String?, connectorID: String, linkID: String?, resourceURI: String?) {
        self.actionName = actionName
        self.appName = appName
        self.connectorID = connectorID
        self.linkID = linkID
        self.resourceURI = resourceURI
    }
}

// MARK: TentacledMCPToolCallAppContext convenience initializers and mutators

public extension TentacledMCPToolCallAppContext {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledMCPToolCallAppContext.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        actionName: String?? = nil,
        appName: String?? = nil,
        connectorID: String? = nil,
        linkID: String?? = nil,
        resourceURI: String?? = nil
    ) -> TentacledMCPToolCallAppContext {
        return TentacledMCPToolCallAppContext(
            actionName: actionName ?? self.actionName,
            appName: appName ?? self.appName,
            connectorID: connectorID ?? self.connectorID,
            linkID: linkID ?? self.linkID,
            resourceURI: resourceURI ?? self.resourceURI
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledFileUpdateChange
public struct TentacledFileUpdateChange: Codable {
    public let diff: String
    public let kind: TentacledPatchChangeKind
    public let path: String

    public init(diff: String, kind: TentacledPatchChangeKind, path: String) {
        self.diff = diff
        self.kind = kind
        self.path = path
    }
}

// MARK: TentacledFileUpdateChange convenience initializers and mutators

public extension TentacledFileUpdateChange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledFileUpdateChange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        diff: String? = nil,
        kind: TentacledPatchChangeKind? = nil,
        path: String? = nil
    ) -> TentacledFileUpdateChange {
        return TentacledFileUpdateChange(
            diff: diff ?? self.diff,
            kind: kind ?? self.kind,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledPatchChangeKind
public struct TentacledPatchChangeKind: Codable {
    public let type: PatchChangeKindType
    public let movePath: String?

    public enum CodingKeys: String, CodingKey {
        case type
        case movePath = "move_path"
    }

    public init(type: PatchChangeKindType, movePath: String?) {
        self.type = type
        self.movePath = movePath
    }
}

// MARK: TentacledPatchChangeKind convenience initializers and mutators

public extension TentacledPatchChangeKind {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledPatchChangeKind.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: PatchChangeKindType? = nil,
        movePath: String?? = nil
    ) -> TentacledPatchChangeKind {
        return TentacledPatchChangeKind(
            type: type ?? self.type,
            movePath: movePath ?? self.movePath
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledCommandAction
public struct TentacledCommandAction: Codable {
    public let command: String
    public let name: String?
    public let path: String?
    public let type: CommandActionType
    public let query: String?

    public init(command: String, name: String?, path: String?, type: CommandActionType, query: String?) {
        self.command = command
        self.name = name
        self.path = path
        self.type = type
        self.query = query
    }
}

// MARK: TentacledCommandAction convenience initializers and mutators

public extension TentacledCommandAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledCommandAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String? = nil,
        name: String?? = nil,
        path: String?? = nil,
        type: CommandActionType? = nil,
        query: String?? = nil
    ) -> TentacledCommandAction {
        return TentacledCommandAction(
            command: command ?? self.command,
            name: name ?? self.name,
            path: path ?? self.path,
            type: type ?? self.type,
            query: query ?? self.query
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum AmbitiousUserInput: Codable {
    case string(String)
    case tentacledUserInput(TentacledUserInput)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(TentacledUserInput.self) {
            self = .tentacledUserInput(x)
            return
        }
        throw DecodingError.typeMismatch(AmbitiousUserInput.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for AmbitiousUserInput"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let x):
            try container.encode(x)
        case .tentacledUserInput(let x):
            try container.encode(x)
        }
    }
}

// MARK: - TentacledUserInput
public struct TentacledUserInput: Codable {
    public let text: String?
    /// UI-defined spans within `text` used to render or persist special elements.
    public let textElements: [TentacledTextElement]?
    public let type: UserInputType
    public let detail: ImageDetail?
    public let url, path, name: String?

    public enum CodingKeys: String, CodingKey {
        case text
        case textElements = "text_elements"
        case type, detail, url, path, name
    }

    public init(text: String?, textElements: [TentacledTextElement]?, type: UserInputType, detail: ImageDetail?, url: String?, path: String?, name: String?) {
        self.text = text
        self.textElements = textElements
        self.type = type
        self.detail = detail
        self.url = url
        self.path = path
        self.name = name
    }
}

// MARK: TentacledUserInput convenience initializers and mutators

public extension TentacledUserInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledUserInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        textElements: [TentacledTextElement]?? = nil,
        type: UserInputType? = nil,
        detail: ImageDetail?? = nil,
        url: String?? = nil,
        path: String?? = nil,
        name: String?? = nil
    ) -> TentacledUserInput {
        return TentacledUserInput(
            text: text ?? self.text,
            textElements: textElements ?? self.textElements,
            type: type ?? self.type,
            detail: detail ?? self.detail,
            url: url ?? self.url,
            path: path ?? self.path,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledTextElement
public struct TentacledTextElement: Codable {
    /// Byte range in the parent `text` buffer that this element occupies.
    public let byteRange: StickyByteRange
    /// Optional human-readable placeholder for the element, displayed in the UI.
    public let placeholder: String?

    public init(byteRange: StickyByteRange, placeholder: String?) {
        self.byteRange = byteRange
        self.placeholder = placeholder
    }
}

// MARK: TentacledTextElement convenience initializers and mutators

public extension TentacledTextElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledTextElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byteRange: StickyByteRange? = nil,
        placeholder: String?? = nil
    ) -> TentacledTextElement {
        return TentacledTextElement(
            byteRange: byteRange ?? self.byteRange,
            placeholder: placeholder ?? self.placeholder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Byte range in the parent `text` buffer that this element occupies.
// MARK: - StickyByteRange
public struct StickyByteRange: Codable {
    public let end, start: Int

    public init(end: Int, start: Int) {
        self.end = end
        self.start = start
    }
}

// MARK: StickyByteRange convenience initializers and mutators

public extension StickyByteRange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyByteRange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        end: Int? = nil,
        start: Int? = nil
    ) -> StickyByteRange {
        return StickyByteRange(
            end: end ?? self.end,
            start: start ?? self.start
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledDynamicToolCallOutputContentItem
public struct TentacledDynamicToolCallOutputContentItem: Codable {
    public let text: String?
    public let type: InputDynamicToolCallOutputContentItemType
    public let imageURL, audioURL: String?

    public enum CodingKeys: String, CodingKey {
        case text, type
        case imageURL = "imageUrl"
        case audioURL = "audioUrl"
    }

    public init(text: String?, type: InputDynamicToolCallOutputContentItemType, imageURL: String?, audioURL: String?) {
        self.text = text
        self.type = type
        self.imageURL = imageURL
        self.audioURL = audioURL
    }
}

// MARK: TentacledDynamicToolCallOutputContentItem convenience initializers and mutators

public extension TentacledDynamicToolCallOutputContentItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledDynamicToolCallOutputContentItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        type: InputDynamicToolCallOutputContentItemType? = nil,
        imageURL: String?? = nil,
        audioURL: String?? = nil
    ) -> TentacledDynamicToolCallOutputContentItem {
        return TentacledDynamicToolCallOutputContentItem(
            text: text ?? self.text,
            type: type ?? self.type,
            imageURL: imageURL ?? self.imageURL,
            audioURL: audioURL ?? self.audioURL
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledMCPToolCallError
public struct TentacledMCPToolCallError: Codable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// MARK: TentacledMCPToolCallError convenience initializers and mutators

public extension TentacledMCPToolCallError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledMCPToolCallError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String? = nil
    ) -> TentacledMCPToolCallError {
        return TentacledMCPToolCallError(
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledHookPromptFragment
public struct TentacledHookPromptFragment: Codable {
    public let hookRunID, text: String

    public enum CodingKeys: String, CodingKey {
        case hookRunID = "hookRunId"
        case text
    }

    public init(hookRunID: String, text: String) {
        self.hookRunID = hookRunID
        self.text = text
    }
}

// MARK: TentacledHookPromptFragment convenience initializers and mutators

public extension TentacledHookPromptFragment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledHookPromptFragment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hookRunID: String? = nil,
        text: String? = nil
    ) -> TentacledHookPromptFragment {
        return TentacledHookPromptFragment(
            hookRunID: hookRunID ?? self.hookRunID,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledMemoryCitation
public struct TentacledMemoryCitation: Codable {
    public let entries: [TentacledMemoryCitationEntry]
    public let threadIDS: [String]

    public enum CodingKeys: String, CodingKey {
        case entries
        case threadIDS = "threadIds"
    }

    public init(entries: [TentacledMemoryCitationEntry], threadIDS: [String]) {
        self.entries = entries
        self.threadIDS = threadIDS
    }
}

// MARK: TentacledMemoryCitation convenience initializers and mutators

public extension TentacledMemoryCitation {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledMemoryCitation.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        entries: [TentacledMemoryCitationEntry]? = nil,
        threadIDS: [String]? = nil
    ) -> TentacledMemoryCitation {
        return TentacledMemoryCitation(
            entries: entries ?? self.entries,
            threadIDS: threadIDS ?? self.threadIDS
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TentacledMemoryCitationEntry
public struct TentacledMemoryCitationEntry: Codable {
    public let lineEnd, lineStart: Int
    public let note, path: String

    public init(lineEnd: Int, lineStart: Int, note: String, path: String) {
        self.lineEnd = lineEnd
        self.lineStart = lineStart
        self.note = note
        self.path = path
    }
}

// MARK: TentacledMemoryCitationEntry convenience initializers and mutators

public extension TentacledMemoryCitationEntry {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledMemoryCitationEntry.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        lineEnd: Int? = nil,
        lineStart: Int? = nil,
        note: String? = nil,
        path: String? = nil
    ) -> TentacledMemoryCitationEntry {
        return TentacledMemoryCitationEntry(
            lineEnd: lineEnd ?? self.lineEnd,
            lineStart: lineStart ?? self.lineStart,
            note: note ?? self.note,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum TentacledResult: Codable {
    case string(String)
    case tentacledMCPToolCallResult(TentacledMCPToolCallResult)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(TentacledMCPToolCallResult.self) {
            self = .tentacledMCPToolCallResult(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(TentacledResult.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for TentacledResult"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let x):
            try container.encode(x)
        case .tentacledMCPToolCallResult(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - TentacledMCPToolCallResult
public struct TentacledMCPToolCallResult: Codable {
    public let meta: JSONAny?
    public let content: [JSONAny]
    public let structuredContent: JSONAny?

    public enum CodingKeys: String, CodingKey {
        case meta = "_meta"
        case content, structuredContent
    }

    public init(meta: JSONAny?, content: [JSONAny], structuredContent: JSONAny?) {
        self.meta = meta
        self.content = content
        self.structuredContent = structuredContent
    }
}

// MARK: TentacledMCPToolCallResult convenience initializers and mutators

public extension TentacledMCPToolCallResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TentacledMCPToolCallResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        meta: JSONAny?? = nil,
        content: [JSONAny]? = nil,
        structuredContent: JSONAny?? = nil
    ) -> TentacledMCPToolCallResult {
        return TentacledMCPToolCallResult(
            meta: meta ?? self.meta,
            content: content ?? self.content,
            structuredContent: structuredContent ?? self.structuredContent
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnInterruptParams
public struct TurnInterruptParams: Codable {
    public let threadID, turnID: String

    public enum CodingKeys: String, CodingKey {
        case threadID = "threadId"
        case turnID = "turnId"
    }

    public init(threadID: String, turnID: String) {
        self.threadID = threadID
        self.turnID = turnID
    }
}

// MARK: TurnInterruptParams convenience initializers and mutators

public extension TurnInterruptParams {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnInterruptParams.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        threadID: String? = nil,
        turnID: String? = nil
    ) -> TurnInterruptParams {
        return TurnInterruptParams(
            threadID: threadID ?? self.threadID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - AgentMessageDeltaNotification
public struct AgentMessageDeltaNotification: Codable {
    public let delta, itemID, threadID, turnID: String

    public enum CodingKeys: String, CodingKey {
        case delta
        case itemID = "itemId"
        case threadID = "threadId"
        case turnID = "turnId"
    }

    public init(delta: String, itemID: String, threadID: String, turnID: String) {
        self.delta = delta
        self.itemID = itemID
        self.threadID = threadID
        self.turnID = turnID
    }
}

// MARK: AgentMessageDeltaNotification convenience initializers and mutators

public extension AgentMessageDeltaNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AgentMessageDeltaNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        delta: String? = nil,
        itemID: String? = nil,
        threadID: String? = nil,
        turnID: String? = nil
    ) -> AgentMessageDeltaNotification {
        return AgentMessageDeltaNotification(
            delta: delta ?? self.delta,
            itemID: itemID ?? self.itemID,
            threadID: threadID ?? self.threadID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ItemStartedNotification
public struct ItemStartedNotification: Codable {
    public let item: ItemStartedNotificationThreadItem
    /// Unix timestamp (in milliseconds) when this item lifecycle started.
    public let startedAtMS: Int
    public let threadID, turnID: String

    public enum CodingKeys: String, CodingKey {
        case item
        case startedAtMS = "startedAtMs"
        case threadID = "threadId"
        case turnID = "turnId"
    }

    public init(item: ItemStartedNotificationThreadItem, startedAtMS: Int, threadID: String, turnID: String) {
        self.item = item
        self.startedAtMS = startedAtMS
        self.threadID = threadID
        self.turnID = turnID
    }
}

// MARK: ItemStartedNotification convenience initializers and mutators

public extension ItemStartedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ItemStartedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        item: ItemStartedNotificationThreadItem? = nil,
        startedAtMS: Int? = nil,
        threadID: String? = nil,
        turnID: String? = nil
    ) -> ItemStartedNotification {
        return ItemStartedNotification(
            item: item ?? self.item,
            startedAtMS: startedAtMS ?? self.startedAtMS,
            threadID: threadID ?? self.threadID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// EXPERIMENTAL - proposed plan item content. The completed plan item is authoritative and
/// may not match the concatenation of `PlanDelta` text.
///
/// Display item emitted by the interruptible `clock.sleep` tool.
// MARK: - ItemStartedNotificationThreadItem
public struct ItemStartedNotificationThreadItem: Codable {
    public let clientID: String?
    public let content: [CunningUserInput]?
    /// Unique identifier for this collab tool call.
    public let id: String
    public let type: ThreadItemType
    public let fragments: [StickyHookPromptFragment]?
    public let memoryCitation: StickyMemoryCitation?
    public let phase: MessagePhase?
    public let text: String?
    public let summary: [String]?
    /// The command's output, aggregated from stdout and stderr.
    public let aggregatedOutput: String?
    /// The command to be executed.
    public let command: String?
    /// A best-effort parsing of the command to understand the action(s) it will perform. This
    /// returns a list of CommandAction objects because a single shell command may be composed of
    /// many commands piped together.
    public let commandActions: [StickyCommandAction]?
    /// The command's working directory.
    public let cwd: String?
    /// The duration of the command execution in milliseconds.
    ///
    /// The duration of the MCP tool call in milliseconds.
    ///
    /// The duration of the dynamic tool call in milliseconds.
    public let durationMS: Int?
    /// The command's exit code.
    public let exitCode: Int?
    /// Trusted first-party plugin id when this command resolves to one plugin script.
    public let pluginID: String?
    /// Identifier for the underlying PTY process (when available).
    public let processID: String?
    /// Safe plugin-relative path when this command resolves to one plugin script.
    public let scriptPath: String?
    public let source: CommandExecutionSource?
    /// Current status of the collab tool call.
    public let status: String?
    public let changes: [StickyFileUpdateChange]?
    public let appContext: StickyMCPToolCallAppContext?
    public let arguments: JSONAny?
    public let error: StickyMCPToolCallError?
    /// Deprecated: use `appContext.resourceUri` instead.
    public let mcpAppResourceURI: String?
    public let readOnlyHint: Bool?
    public let result: StickyResult?
    public let server: String?
    /// Name of the collab tool that was invoked.
    public let tool: String?
    public let contentItems: [StickyDynamicToolCallOutputContentItem]?
    public let namespace: String?
    public let success: Bool?
    /// Last known status of the target agents, when available.
    public let agentsStates: [String: StickyCollabAgentState]?
    /// Model requested for the spawned agent, when applicable.
    public let model: String?
    /// Prompt text sent as part of the collab tool call, when available.
    public let prompt: String?
    /// Reasoning effort requested for the spawned agent, when applicable.
    public let reasoningEffort: String?
    /// Thread ID of the receiving agent, when applicable. In case of spawn operation, this
    /// corresponds to the newly spawned agent.
    public let receiverThreadIDS: [String]?
    /// Thread ID of the agent issuing the collab request.
    public let senderThreadID: String?
    public let agentPath, agentThreadID: String?
    public let kind: SubAgentActivityKind?
    public let action: StickyWebSearchAction?
    public let query: String?
    /// Structured search results returned out-of-band by standalone web search.
    ///
    /// These stay as opaque JSON at the extension/app-server boundary so new result fields and
    /// result types can pass through without a Codex release.
    public let results: [JSONAny]?
    public let path: String?
    public let revisedPrompt, savedPath: String?
    public let review: String?

    public enum CodingKeys: String, CodingKey {
        case clientID = "clientId"
        case content, id, type, fragments, memoryCitation, phase, text, summary, aggregatedOutput, command, commandActions, cwd
        case durationMS = "durationMs"
        case exitCode
        case pluginID = "pluginId"
        case processID = "processId"
        case scriptPath, source, status, changes, appContext, arguments, error
        case mcpAppResourceURI = "mcpAppResourceUri"
        case readOnlyHint, result, server, tool, contentItems, namespace, success, agentsStates, model, prompt, reasoningEffort
        case receiverThreadIDS = "receiverThreadIds"
        case senderThreadID = "senderThreadId"
        case agentPath
        case agentThreadID = "agentThreadId"
        case kind, action, query, results, path, revisedPrompt, savedPath, review
    }

    public init(clientID: String?, content: [CunningUserInput]?, id: String, type: ThreadItemType, fragments: [StickyHookPromptFragment]?, memoryCitation: StickyMemoryCitation?, phase: MessagePhase?, text: String?, summary: [String]?, aggregatedOutput: String?, command: String?, commandActions: [StickyCommandAction]?, cwd: String?, durationMS: Int?, exitCode: Int?, pluginID: String?, processID: String?, scriptPath: String?, source: CommandExecutionSource?, status: String?, changes: [StickyFileUpdateChange]?, appContext: StickyMCPToolCallAppContext?, arguments: JSONAny?, error: StickyMCPToolCallError?, mcpAppResourceURI: String?, readOnlyHint: Bool?, result: StickyResult?, server: String?, tool: String?, contentItems: [StickyDynamicToolCallOutputContentItem]?, namespace: String?, success: Bool?, agentsStates: [String: StickyCollabAgentState]?, model: String?, prompt: String?, reasoningEffort: String?, receiverThreadIDS: [String]?, senderThreadID: String?, agentPath: String?, agentThreadID: String?, kind: SubAgentActivityKind?, action: StickyWebSearchAction?, query: String?, results: [JSONAny]?, path: String?, revisedPrompt: String?, savedPath: String?, review: String?) {
        self.clientID = clientID
        self.content = content
        self.id = id
        self.type = type
        self.fragments = fragments
        self.memoryCitation = memoryCitation
        self.phase = phase
        self.text = text
        self.summary = summary
        self.aggregatedOutput = aggregatedOutput
        self.command = command
        self.commandActions = commandActions
        self.cwd = cwd
        self.durationMS = durationMS
        self.exitCode = exitCode
        self.pluginID = pluginID
        self.processID = processID
        self.scriptPath = scriptPath
        self.source = source
        self.status = status
        self.changes = changes
        self.appContext = appContext
        self.arguments = arguments
        self.error = error
        self.mcpAppResourceURI = mcpAppResourceURI
        self.readOnlyHint = readOnlyHint
        self.result = result
        self.server = server
        self.tool = tool
        self.contentItems = contentItems
        self.namespace = namespace
        self.success = success
        self.agentsStates = agentsStates
        self.model = model
        self.prompt = prompt
        self.reasoningEffort = reasoningEffort
        self.receiverThreadIDS = receiverThreadIDS
        self.senderThreadID = senderThreadID
        self.agentPath = agentPath
        self.agentThreadID = agentThreadID
        self.kind = kind
        self.action = action
        self.query = query
        self.results = results
        self.path = path
        self.revisedPrompt = revisedPrompt
        self.savedPath = savedPath
        self.review = review
    }
}

// MARK: ItemStartedNotificationThreadItem convenience initializers and mutators

public extension ItemStartedNotificationThreadItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ItemStartedNotificationThreadItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        clientID: String?? = nil,
        content: [CunningUserInput]?? = nil,
        id: String? = nil,
        type: ThreadItemType? = nil,
        fragments: [StickyHookPromptFragment]?? = nil,
        memoryCitation: StickyMemoryCitation?? = nil,
        phase: MessagePhase?? = nil,
        text: String?? = nil,
        summary: [String]?? = nil,
        aggregatedOutput: String?? = nil,
        command: String?? = nil,
        commandActions: [StickyCommandAction]?? = nil,
        cwd: String?? = nil,
        durationMS: Int?? = nil,
        exitCode: Int?? = nil,
        pluginID: String?? = nil,
        processID: String?? = nil,
        scriptPath: String?? = nil,
        source: CommandExecutionSource?? = nil,
        status: String?? = nil,
        changes: [StickyFileUpdateChange]?? = nil,
        appContext: StickyMCPToolCallAppContext?? = nil,
        arguments: JSONAny?? = nil,
        error: StickyMCPToolCallError?? = nil,
        mcpAppResourceURI: String?? = nil,
        readOnlyHint: Bool?? = nil,
        result: StickyResult?? = nil,
        server: String?? = nil,
        tool: String?? = nil,
        contentItems: [StickyDynamicToolCallOutputContentItem]?? = nil,
        namespace: String?? = nil,
        success: Bool?? = nil,
        agentsStates: [String: StickyCollabAgentState]?? = nil,
        model: String?? = nil,
        prompt: String?? = nil,
        reasoningEffort: String?? = nil,
        receiverThreadIDS: [String]?? = nil,
        senderThreadID: String?? = nil,
        agentPath: String?? = nil,
        agentThreadID: String?? = nil,
        kind: SubAgentActivityKind?? = nil,
        action: StickyWebSearchAction?? = nil,
        query: String?? = nil,
        results: [JSONAny]?? = nil,
        path: String?? = nil,
        revisedPrompt: String?? = nil,
        savedPath: String?? = nil,
        review: String?? = nil
    ) -> ItemStartedNotificationThreadItem {
        return ItemStartedNotificationThreadItem(
            clientID: clientID ?? self.clientID,
            content: content ?? self.content,
            id: id ?? self.id,
            type: type ?? self.type,
            fragments: fragments ?? self.fragments,
            memoryCitation: memoryCitation ?? self.memoryCitation,
            phase: phase ?? self.phase,
            text: text ?? self.text,
            summary: summary ?? self.summary,
            aggregatedOutput: aggregatedOutput ?? self.aggregatedOutput,
            command: command ?? self.command,
            commandActions: commandActions ?? self.commandActions,
            cwd: cwd ?? self.cwd,
            durationMS: durationMS ?? self.durationMS,
            exitCode: exitCode ?? self.exitCode,
            pluginID: pluginID ?? self.pluginID,
            processID: processID ?? self.processID,
            scriptPath: scriptPath ?? self.scriptPath,
            source: source ?? self.source,
            status: status ?? self.status,
            changes: changes ?? self.changes,
            appContext: appContext ?? self.appContext,
            arguments: arguments ?? self.arguments,
            error: error ?? self.error,
            mcpAppResourceURI: mcpAppResourceURI ?? self.mcpAppResourceURI,
            readOnlyHint: readOnlyHint ?? self.readOnlyHint,
            result: result ?? self.result,
            server: server ?? self.server,
            tool: tool ?? self.tool,
            contentItems: contentItems ?? self.contentItems,
            namespace: namespace ?? self.namespace,
            success: success ?? self.success,
            agentsStates: agentsStates ?? self.agentsStates,
            model: model ?? self.model,
            prompt: prompt ?? self.prompt,
            reasoningEffort: reasoningEffort ?? self.reasoningEffort,
            receiverThreadIDS: receiverThreadIDS ?? self.receiverThreadIDS,
            senderThreadID: senderThreadID ?? self.senderThreadID,
            agentPath: agentPath ?? self.agentPath,
            agentThreadID: agentThreadID ?? self.agentThreadID,
            kind: kind ?? self.kind,
            action: action ?? self.action,
            query: query ?? self.query,
            results: results ?? self.results,
            path: path ?? self.path,
            revisedPrompt: revisedPrompt ?? self.revisedPrompt,
            savedPath: savedPath ?? self.savedPath,
            review: review ?? self.review
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyWebSearchAction
public struct StickyWebSearchAction: Codable {
    public let queries: [String]?
    public let query: String?
    public let type: WebSearchActionType
    public let url, pattern: String?

    public init(queries: [String]?, query: String?, type: WebSearchActionType, url: String?, pattern: String?) {
        self.queries = queries
        self.query = query
        self.type = type
        self.url = url
        self.pattern = pattern
    }
}

// MARK: StickyWebSearchAction convenience initializers and mutators

public extension StickyWebSearchAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyWebSearchAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        queries: [String]?? = nil,
        query: String?? = nil,
        type: WebSearchActionType? = nil,
        url: String?? = nil,
        pattern: String?? = nil
    ) -> StickyWebSearchAction {
        return StickyWebSearchAction(
            queries: queries ?? self.queries,
            query: query ?? self.query,
            type: type ?? self.type,
            url: url ?? self.url,
            pattern: pattern ?? self.pattern
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyCollabAgentState
public struct StickyCollabAgentState: Codable {
    public let message: String?
    public let status: CollabAgentStatus

    public init(message: String?, status: CollabAgentStatus) {
        self.message = message
        self.status = status
    }
}

// MARK: StickyCollabAgentState convenience initializers and mutators

public extension StickyCollabAgentState {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyCollabAgentState.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String?? = nil,
        status: CollabAgentStatus? = nil
    ) -> StickyCollabAgentState {
        return StickyCollabAgentState(
            message: message ?? self.message,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyMCPToolCallAppContext
public struct StickyMCPToolCallAppContext: Codable {
    public let actionName, appName: String?
    public let connectorID: String
    public let linkID, resourceURI: String?

    public enum CodingKeys: String, CodingKey {
        case actionName, appName
        case connectorID = "connectorId"
        case linkID = "linkId"
        case resourceURI = "resourceUri"
    }

    public init(actionName: String?, appName: String?, connectorID: String, linkID: String?, resourceURI: String?) {
        self.actionName = actionName
        self.appName = appName
        self.connectorID = connectorID
        self.linkID = linkID
        self.resourceURI = resourceURI
    }
}

// MARK: StickyMCPToolCallAppContext convenience initializers and mutators

public extension StickyMCPToolCallAppContext {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyMCPToolCallAppContext.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        actionName: String?? = nil,
        appName: String?? = nil,
        connectorID: String? = nil,
        linkID: String?? = nil,
        resourceURI: String?? = nil
    ) -> StickyMCPToolCallAppContext {
        return StickyMCPToolCallAppContext(
            actionName: actionName ?? self.actionName,
            appName: appName ?? self.appName,
            connectorID: connectorID ?? self.connectorID,
            linkID: linkID ?? self.linkID,
            resourceURI: resourceURI ?? self.resourceURI
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyFileUpdateChange
public struct StickyFileUpdateChange: Codable {
    public let diff: String
    public let kind: StickyPatchChangeKind
    public let path: String

    public init(diff: String, kind: StickyPatchChangeKind, path: String) {
        self.diff = diff
        self.kind = kind
        self.path = path
    }
}

// MARK: StickyFileUpdateChange convenience initializers and mutators

public extension StickyFileUpdateChange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyFileUpdateChange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        diff: String? = nil,
        kind: StickyPatchChangeKind? = nil,
        path: String? = nil
    ) -> StickyFileUpdateChange {
        return StickyFileUpdateChange(
            diff: diff ?? self.diff,
            kind: kind ?? self.kind,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyPatchChangeKind
public struct StickyPatchChangeKind: Codable {
    public let type: PatchChangeKindType
    public let movePath: String?

    public enum CodingKeys: String, CodingKey {
        case type
        case movePath = "move_path"
    }

    public init(type: PatchChangeKindType, movePath: String?) {
        self.type = type
        self.movePath = movePath
    }
}

// MARK: StickyPatchChangeKind convenience initializers and mutators

public extension StickyPatchChangeKind {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyPatchChangeKind.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: PatchChangeKindType? = nil,
        movePath: String?? = nil
    ) -> StickyPatchChangeKind {
        return StickyPatchChangeKind(
            type: type ?? self.type,
            movePath: movePath ?? self.movePath
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyCommandAction
public struct StickyCommandAction: Codable {
    public let command: String
    public let name: String?
    public let path: String?
    public let type: CommandActionType
    public let query: String?

    public init(command: String, name: String?, path: String?, type: CommandActionType, query: String?) {
        self.command = command
        self.name = name
        self.path = path
        self.type = type
        self.query = query
    }
}

// MARK: StickyCommandAction convenience initializers and mutators

public extension StickyCommandAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyCommandAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String? = nil,
        name: String?? = nil,
        path: String?? = nil,
        type: CommandActionType? = nil,
        query: String?? = nil
    ) -> StickyCommandAction {
        return StickyCommandAction(
            command: command ?? self.command,
            name: name ?? self.name,
            path: path ?? self.path,
            type: type ?? self.type,
            query: query ?? self.query
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum CunningUserInput: Codable {
    case stickyUserInput(StickyUserInput)
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(StickyUserInput.self) {
            self = .stickyUserInput(x)
            return
        }
        throw DecodingError.typeMismatch(CunningUserInput.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for CunningUserInput"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .stickyUserInput(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

// MARK: - StickyUserInput
public struct StickyUserInput: Codable {
    public let text: String?
    /// UI-defined spans within `text` used to render or persist special elements.
    public let textElements: [StickyTextElement]?
    public let type: UserInputType
    public let detail: ImageDetail?
    public let url, path, name: String?

    public enum CodingKeys: String, CodingKey {
        case text
        case textElements = "text_elements"
        case type, detail, url, path, name
    }

    public init(text: String?, textElements: [StickyTextElement]?, type: UserInputType, detail: ImageDetail?, url: String?, path: String?, name: String?) {
        self.text = text
        self.textElements = textElements
        self.type = type
        self.detail = detail
        self.url = url
        self.path = path
        self.name = name
    }
}

// MARK: StickyUserInput convenience initializers and mutators

public extension StickyUserInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyUserInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        textElements: [StickyTextElement]?? = nil,
        type: UserInputType? = nil,
        detail: ImageDetail?? = nil,
        url: String?? = nil,
        path: String?? = nil,
        name: String?? = nil
    ) -> StickyUserInput {
        return StickyUserInput(
            text: text ?? self.text,
            textElements: textElements ?? self.textElements,
            type: type ?? self.type,
            detail: detail ?? self.detail,
            url: url ?? self.url,
            path: path ?? self.path,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyTextElement
public struct StickyTextElement: Codable {
    /// Byte range in the parent `text` buffer that this element occupies.
    public let byteRange: IndigoByteRange
    /// Optional human-readable placeholder for the element, displayed in the UI.
    public let placeholder: String?

    public init(byteRange: IndigoByteRange, placeholder: String?) {
        self.byteRange = byteRange
        self.placeholder = placeholder
    }
}

// MARK: StickyTextElement convenience initializers and mutators

public extension StickyTextElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyTextElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byteRange: IndigoByteRange? = nil,
        placeholder: String?? = nil
    ) -> StickyTextElement {
        return StickyTextElement(
            byteRange: byteRange ?? self.byteRange,
            placeholder: placeholder ?? self.placeholder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Byte range in the parent `text` buffer that this element occupies.
// MARK: - IndigoByteRange
public struct IndigoByteRange: Codable {
    public let end, start: Int

    public init(end: Int, start: Int) {
        self.end = end
        self.start = start
    }
}

// MARK: IndigoByteRange convenience initializers and mutators

public extension IndigoByteRange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoByteRange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        end: Int? = nil,
        start: Int? = nil
    ) -> IndigoByteRange {
        return IndigoByteRange(
            end: end ?? self.end,
            start: start ?? self.start
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyDynamicToolCallOutputContentItem
public struct StickyDynamicToolCallOutputContentItem: Codable {
    public let text: String?
    public let type: InputDynamicToolCallOutputContentItemType
    public let imageURL, audioURL: String?

    public enum CodingKeys: String, CodingKey {
        case text, type
        case imageURL = "imageUrl"
        case audioURL = "audioUrl"
    }

    public init(text: String?, type: InputDynamicToolCallOutputContentItemType, imageURL: String?, audioURL: String?) {
        self.text = text
        self.type = type
        self.imageURL = imageURL
        self.audioURL = audioURL
    }
}

// MARK: StickyDynamicToolCallOutputContentItem convenience initializers and mutators

public extension StickyDynamicToolCallOutputContentItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyDynamicToolCallOutputContentItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        type: InputDynamicToolCallOutputContentItemType? = nil,
        imageURL: String?? = nil,
        audioURL: String?? = nil
    ) -> StickyDynamicToolCallOutputContentItem {
        return StickyDynamicToolCallOutputContentItem(
            text: text ?? self.text,
            type: type ?? self.type,
            imageURL: imageURL ?? self.imageURL,
            audioURL: audioURL ?? self.audioURL
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyMCPToolCallError
public struct StickyMCPToolCallError: Codable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// MARK: StickyMCPToolCallError convenience initializers and mutators

public extension StickyMCPToolCallError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyMCPToolCallError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String? = nil
    ) -> StickyMCPToolCallError {
        return StickyMCPToolCallError(
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyHookPromptFragment
public struct StickyHookPromptFragment: Codable {
    public let hookRunID, text: String

    public enum CodingKeys: String, CodingKey {
        case hookRunID = "hookRunId"
        case text
    }

    public init(hookRunID: String, text: String) {
        self.hookRunID = hookRunID
        self.text = text
    }
}

// MARK: StickyHookPromptFragment convenience initializers and mutators

public extension StickyHookPromptFragment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyHookPromptFragment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hookRunID: String? = nil,
        text: String? = nil
    ) -> StickyHookPromptFragment {
        return StickyHookPromptFragment(
            hookRunID: hookRunID ?? self.hookRunID,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyMemoryCitation
public struct StickyMemoryCitation: Codable {
    public let entries: [StickyMemoryCitationEntry]
    public let threadIDS: [String]

    public enum CodingKeys: String, CodingKey {
        case entries
        case threadIDS = "threadIds"
    }

    public init(entries: [StickyMemoryCitationEntry], threadIDS: [String]) {
        self.entries = entries
        self.threadIDS = threadIDS
    }
}

// MARK: StickyMemoryCitation convenience initializers and mutators

public extension StickyMemoryCitation {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyMemoryCitation.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        entries: [StickyMemoryCitationEntry]? = nil,
        threadIDS: [String]? = nil
    ) -> StickyMemoryCitation {
        return StickyMemoryCitation(
            entries: entries ?? self.entries,
            threadIDS: threadIDS ?? self.threadIDS
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyMemoryCitationEntry
public struct StickyMemoryCitationEntry: Codable {
    public let lineEnd, lineStart: Int
    public let note, path: String

    public init(lineEnd: Int, lineStart: Int, note: String, path: String) {
        self.lineEnd = lineEnd
        self.lineStart = lineStart
        self.note = note
        self.path = path
    }
}

// MARK: StickyMemoryCitationEntry convenience initializers and mutators

public extension StickyMemoryCitationEntry {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyMemoryCitationEntry.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        lineEnd: Int? = nil,
        lineStart: Int? = nil,
        note: String? = nil,
        path: String? = nil
    ) -> StickyMemoryCitationEntry {
        return StickyMemoryCitationEntry(
            lineEnd: lineEnd ?? self.lineEnd,
            lineStart: lineStart ?? self.lineStart,
            note: note ?? self.note,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum StickyResult: Codable {
    case stickyMCPToolCallResult(StickyMCPToolCallResult)
    case string(String)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(StickyMCPToolCallResult.self) {
            self = .stickyMCPToolCallResult(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(StickyResult.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for StickyResult"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .stickyMCPToolCallResult(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - StickyMCPToolCallResult
public struct StickyMCPToolCallResult: Codable {
    public let meta: JSONAny?
    public let content: [JSONAny]
    public let structuredContent: JSONAny?

    public enum CodingKeys: String, CodingKey {
        case meta = "_meta"
        case content, structuredContent
    }

    public init(meta: JSONAny?, content: [JSONAny], structuredContent: JSONAny?) {
        self.meta = meta
        self.content = content
        self.structuredContent = structuredContent
    }
}

// MARK: StickyMCPToolCallResult convenience initializers and mutators

public extension StickyMCPToolCallResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyMCPToolCallResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        meta: JSONAny?? = nil,
        content: [JSONAny]? = nil,
        structuredContent: JSONAny?? = nil
    ) -> StickyMCPToolCallResult {
        return StickyMCPToolCallResult(
            meta: meta ?? self.meta,
            content: content ?? self.content,
            structuredContent: structuredContent ?? self.structuredContent
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ItemCompletedNotification
public struct ItemCompletedNotification: Codable {
    /// Unix timestamp (in milliseconds) when this item lifecycle completed.
    public let completedAtMS: Int
    public let item: ItemCompletedNotificationThreadItem
    public let threadID, turnID: String

    public enum CodingKeys: String, CodingKey {
        case completedAtMS = "completedAtMs"
        case item
        case threadID = "threadId"
        case turnID = "turnId"
    }

    public init(completedAtMS: Int, item: ItemCompletedNotificationThreadItem, threadID: String, turnID: String) {
        self.completedAtMS = completedAtMS
        self.item = item
        self.threadID = threadID
        self.turnID = turnID
    }
}

// MARK: ItemCompletedNotification convenience initializers and mutators

public extension ItemCompletedNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ItemCompletedNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        completedAtMS: Int? = nil,
        item: ItemCompletedNotificationThreadItem? = nil,
        threadID: String? = nil,
        turnID: String? = nil
    ) -> ItemCompletedNotification {
        return ItemCompletedNotification(
            completedAtMS: completedAtMS ?? self.completedAtMS,
            item: item ?? self.item,
            threadID: threadID ?? self.threadID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// EXPERIMENTAL - proposed plan item content. The completed plan item is authoritative and
/// may not match the concatenation of `PlanDelta` text.
///
/// Display item emitted by the interruptible `clock.sleep` tool.
// MARK: - ItemCompletedNotificationThreadItem
public struct ItemCompletedNotificationThreadItem: Codable {
    public let clientID: String?
    public let content: [MagentaUserInput]?
    /// Unique identifier for this collab tool call.
    public let id: String
    public let type: ThreadItemType
    public let fragments: [IndigoHookPromptFragment]?
    public let memoryCitation: IndigoMemoryCitation?
    public let phase: MessagePhase?
    public let text: String?
    public let summary: [String]?
    /// The command's output, aggregated from stdout and stderr.
    public let aggregatedOutput: String?
    /// The command to be executed.
    public let command: String?
    /// A best-effort parsing of the command to understand the action(s) it will perform. This
    /// returns a list of CommandAction objects because a single shell command may be composed of
    /// many commands piped together.
    public let commandActions: [IndigoCommandAction]?
    /// The command's working directory.
    public let cwd: String?
    /// The duration of the command execution in milliseconds.
    ///
    /// The duration of the MCP tool call in milliseconds.
    ///
    /// The duration of the dynamic tool call in milliseconds.
    public let durationMS: Int?
    /// The command's exit code.
    public let exitCode: Int?
    /// Trusted first-party plugin id when this command resolves to one plugin script.
    public let pluginID: String?
    /// Identifier for the underlying PTY process (when available).
    public let processID: String?
    /// Safe plugin-relative path when this command resolves to one plugin script.
    public let scriptPath: String?
    public let source: CommandExecutionSource?
    /// Current status of the collab tool call.
    public let status: String?
    public let changes: [IndigoFileUpdateChange]?
    public let appContext: IndigoMCPToolCallAppContext?
    public let arguments: JSONAny?
    public let error: IndigoMCPToolCallError?
    /// Deprecated: use `appContext.resourceUri` instead.
    public let mcpAppResourceURI: String?
    public let readOnlyHint: Bool?
    public let result: IndigoResult?
    public let server: String?
    /// Name of the collab tool that was invoked.
    public let tool: String?
    public let contentItems: [IndigoDynamicToolCallOutputContentItem]?
    public let namespace: String?
    public let success: Bool?
    /// Last known status of the target agents, when available.
    public let agentsStates: [String: IndigoCollabAgentState]?
    /// Model requested for the spawned agent, when applicable.
    public let model: String?
    /// Prompt text sent as part of the collab tool call, when available.
    public let prompt: String?
    /// Reasoning effort requested for the spawned agent, when applicable.
    public let reasoningEffort: String?
    /// Thread ID of the receiving agent, when applicable. In case of spawn operation, this
    /// corresponds to the newly spawned agent.
    public let receiverThreadIDS: [String]?
    /// Thread ID of the agent issuing the collab request.
    public let senderThreadID: String?
    public let agentPath, agentThreadID: String?
    public let kind: SubAgentActivityKind?
    public let action: IndigoWebSearchAction?
    public let query: String?
    /// Structured search results returned out-of-band by standalone web search.
    ///
    /// These stay as opaque JSON at the extension/app-server boundary so new result fields and
    /// result types can pass through without a Codex release.
    public let results: [JSONAny]?
    public let path: String?
    public let revisedPrompt, savedPath: String?
    public let review: String?

    public enum CodingKeys: String, CodingKey {
        case clientID = "clientId"
        case content, id, type, fragments, memoryCitation, phase, text, summary, aggregatedOutput, command, commandActions, cwd
        case durationMS = "durationMs"
        case exitCode
        case pluginID = "pluginId"
        case processID = "processId"
        case scriptPath, source, status, changes, appContext, arguments, error
        case mcpAppResourceURI = "mcpAppResourceUri"
        case readOnlyHint, result, server, tool, contentItems, namespace, success, agentsStates, model, prompt, reasoningEffort
        case receiverThreadIDS = "receiverThreadIds"
        case senderThreadID = "senderThreadId"
        case agentPath
        case agentThreadID = "agentThreadId"
        case kind, action, query, results, path, revisedPrompt, savedPath, review
    }

    public init(clientID: String?, content: [MagentaUserInput]?, id: String, type: ThreadItemType, fragments: [IndigoHookPromptFragment]?, memoryCitation: IndigoMemoryCitation?, phase: MessagePhase?, text: String?, summary: [String]?, aggregatedOutput: String?, command: String?, commandActions: [IndigoCommandAction]?, cwd: String?, durationMS: Int?, exitCode: Int?, pluginID: String?, processID: String?, scriptPath: String?, source: CommandExecutionSource?, status: String?, changes: [IndigoFileUpdateChange]?, appContext: IndigoMCPToolCallAppContext?, arguments: JSONAny?, error: IndigoMCPToolCallError?, mcpAppResourceURI: String?, readOnlyHint: Bool?, result: IndigoResult?, server: String?, tool: String?, contentItems: [IndigoDynamicToolCallOutputContentItem]?, namespace: String?, success: Bool?, agentsStates: [String: IndigoCollabAgentState]?, model: String?, prompt: String?, reasoningEffort: String?, receiverThreadIDS: [String]?, senderThreadID: String?, agentPath: String?, agentThreadID: String?, kind: SubAgentActivityKind?, action: IndigoWebSearchAction?, query: String?, results: [JSONAny]?, path: String?, revisedPrompt: String?, savedPath: String?, review: String?) {
        self.clientID = clientID
        self.content = content
        self.id = id
        self.type = type
        self.fragments = fragments
        self.memoryCitation = memoryCitation
        self.phase = phase
        self.text = text
        self.summary = summary
        self.aggregatedOutput = aggregatedOutput
        self.command = command
        self.commandActions = commandActions
        self.cwd = cwd
        self.durationMS = durationMS
        self.exitCode = exitCode
        self.pluginID = pluginID
        self.processID = processID
        self.scriptPath = scriptPath
        self.source = source
        self.status = status
        self.changes = changes
        self.appContext = appContext
        self.arguments = arguments
        self.error = error
        self.mcpAppResourceURI = mcpAppResourceURI
        self.readOnlyHint = readOnlyHint
        self.result = result
        self.server = server
        self.tool = tool
        self.contentItems = contentItems
        self.namespace = namespace
        self.success = success
        self.agentsStates = agentsStates
        self.model = model
        self.prompt = prompt
        self.reasoningEffort = reasoningEffort
        self.receiverThreadIDS = receiverThreadIDS
        self.senderThreadID = senderThreadID
        self.agentPath = agentPath
        self.agentThreadID = agentThreadID
        self.kind = kind
        self.action = action
        self.query = query
        self.results = results
        self.path = path
        self.revisedPrompt = revisedPrompt
        self.savedPath = savedPath
        self.review = review
    }
}

// MARK: ItemCompletedNotificationThreadItem convenience initializers and mutators

public extension ItemCompletedNotificationThreadItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ItemCompletedNotificationThreadItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        clientID: String?? = nil,
        content: [MagentaUserInput]?? = nil,
        id: String? = nil,
        type: ThreadItemType? = nil,
        fragments: [IndigoHookPromptFragment]?? = nil,
        memoryCitation: IndigoMemoryCitation?? = nil,
        phase: MessagePhase?? = nil,
        text: String?? = nil,
        summary: [String]?? = nil,
        aggregatedOutput: String?? = nil,
        command: String?? = nil,
        commandActions: [IndigoCommandAction]?? = nil,
        cwd: String?? = nil,
        durationMS: Int?? = nil,
        exitCode: Int?? = nil,
        pluginID: String?? = nil,
        processID: String?? = nil,
        scriptPath: String?? = nil,
        source: CommandExecutionSource?? = nil,
        status: String?? = nil,
        changes: [IndigoFileUpdateChange]?? = nil,
        appContext: IndigoMCPToolCallAppContext?? = nil,
        arguments: JSONAny?? = nil,
        error: IndigoMCPToolCallError?? = nil,
        mcpAppResourceURI: String?? = nil,
        readOnlyHint: Bool?? = nil,
        result: IndigoResult?? = nil,
        server: String?? = nil,
        tool: String?? = nil,
        contentItems: [IndigoDynamicToolCallOutputContentItem]?? = nil,
        namespace: String?? = nil,
        success: Bool?? = nil,
        agentsStates: [String: IndigoCollabAgentState]?? = nil,
        model: String?? = nil,
        prompt: String?? = nil,
        reasoningEffort: String?? = nil,
        receiverThreadIDS: [String]?? = nil,
        senderThreadID: String?? = nil,
        agentPath: String?? = nil,
        agentThreadID: String?? = nil,
        kind: SubAgentActivityKind?? = nil,
        action: IndigoWebSearchAction?? = nil,
        query: String?? = nil,
        results: [JSONAny]?? = nil,
        path: String?? = nil,
        revisedPrompt: String?? = nil,
        savedPath: String?? = nil,
        review: String?? = nil
    ) -> ItemCompletedNotificationThreadItem {
        return ItemCompletedNotificationThreadItem(
            clientID: clientID ?? self.clientID,
            content: content ?? self.content,
            id: id ?? self.id,
            type: type ?? self.type,
            fragments: fragments ?? self.fragments,
            memoryCitation: memoryCitation ?? self.memoryCitation,
            phase: phase ?? self.phase,
            text: text ?? self.text,
            summary: summary ?? self.summary,
            aggregatedOutput: aggregatedOutput ?? self.aggregatedOutput,
            command: command ?? self.command,
            commandActions: commandActions ?? self.commandActions,
            cwd: cwd ?? self.cwd,
            durationMS: durationMS ?? self.durationMS,
            exitCode: exitCode ?? self.exitCode,
            pluginID: pluginID ?? self.pluginID,
            processID: processID ?? self.processID,
            scriptPath: scriptPath ?? self.scriptPath,
            source: source ?? self.source,
            status: status ?? self.status,
            changes: changes ?? self.changes,
            appContext: appContext ?? self.appContext,
            arguments: arguments ?? self.arguments,
            error: error ?? self.error,
            mcpAppResourceURI: mcpAppResourceURI ?? self.mcpAppResourceURI,
            readOnlyHint: readOnlyHint ?? self.readOnlyHint,
            result: result ?? self.result,
            server: server ?? self.server,
            tool: tool ?? self.tool,
            contentItems: contentItems ?? self.contentItems,
            namespace: namespace ?? self.namespace,
            success: success ?? self.success,
            agentsStates: agentsStates ?? self.agentsStates,
            model: model ?? self.model,
            prompt: prompt ?? self.prompt,
            reasoningEffort: reasoningEffort ?? self.reasoningEffort,
            receiverThreadIDS: receiverThreadIDS ?? self.receiverThreadIDS,
            senderThreadID: senderThreadID ?? self.senderThreadID,
            agentPath: agentPath ?? self.agentPath,
            agentThreadID: agentThreadID ?? self.agentThreadID,
            kind: kind ?? self.kind,
            action: action ?? self.action,
            query: query ?? self.query,
            results: results ?? self.results,
            path: path ?? self.path,
            revisedPrompt: revisedPrompt ?? self.revisedPrompt,
            savedPath: savedPath ?? self.savedPath,
            review: review ?? self.review
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoWebSearchAction
public struct IndigoWebSearchAction: Codable {
    public let queries: [String]?
    public let query: String?
    public let type: WebSearchActionType
    public let url, pattern: String?

    public init(queries: [String]?, query: String?, type: WebSearchActionType, url: String?, pattern: String?) {
        self.queries = queries
        self.query = query
        self.type = type
        self.url = url
        self.pattern = pattern
    }
}

// MARK: IndigoWebSearchAction convenience initializers and mutators

public extension IndigoWebSearchAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoWebSearchAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        queries: [String]?? = nil,
        query: String?? = nil,
        type: WebSearchActionType? = nil,
        url: String?? = nil,
        pattern: String?? = nil
    ) -> IndigoWebSearchAction {
        return IndigoWebSearchAction(
            queries: queries ?? self.queries,
            query: query ?? self.query,
            type: type ?? self.type,
            url: url ?? self.url,
            pattern: pattern ?? self.pattern
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoCollabAgentState
public struct IndigoCollabAgentState: Codable {
    public let message: String?
    public let status: CollabAgentStatus

    public init(message: String?, status: CollabAgentStatus) {
        self.message = message
        self.status = status
    }
}

// MARK: IndigoCollabAgentState convenience initializers and mutators

public extension IndigoCollabAgentState {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoCollabAgentState.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String?? = nil,
        status: CollabAgentStatus? = nil
    ) -> IndigoCollabAgentState {
        return IndigoCollabAgentState(
            message: message ?? self.message,
            status: status ?? self.status
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoMCPToolCallAppContext
public struct IndigoMCPToolCallAppContext: Codable {
    public let actionName, appName: String?
    public let connectorID: String
    public let linkID, resourceURI: String?

    public enum CodingKeys: String, CodingKey {
        case actionName, appName
        case connectorID = "connectorId"
        case linkID = "linkId"
        case resourceURI = "resourceUri"
    }

    public init(actionName: String?, appName: String?, connectorID: String, linkID: String?, resourceURI: String?) {
        self.actionName = actionName
        self.appName = appName
        self.connectorID = connectorID
        self.linkID = linkID
        self.resourceURI = resourceURI
    }
}

// MARK: IndigoMCPToolCallAppContext convenience initializers and mutators

public extension IndigoMCPToolCallAppContext {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoMCPToolCallAppContext.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        actionName: String?? = nil,
        appName: String?? = nil,
        connectorID: String? = nil,
        linkID: String?? = nil,
        resourceURI: String?? = nil
    ) -> IndigoMCPToolCallAppContext {
        return IndigoMCPToolCallAppContext(
            actionName: actionName ?? self.actionName,
            appName: appName ?? self.appName,
            connectorID: connectorID ?? self.connectorID,
            linkID: linkID ?? self.linkID,
            resourceURI: resourceURI ?? self.resourceURI
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoFileUpdateChange
public struct IndigoFileUpdateChange: Codable {
    public let diff: String
    public let kind: IndigoPatchChangeKind
    public let path: String

    public init(diff: String, kind: IndigoPatchChangeKind, path: String) {
        self.diff = diff
        self.kind = kind
        self.path = path
    }
}

// MARK: IndigoFileUpdateChange convenience initializers and mutators

public extension IndigoFileUpdateChange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoFileUpdateChange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        diff: String? = nil,
        kind: IndigoPatchChangeKind? = nil,
        path: String? = nil
    ) -> IndigoFileUpdateChange {
        return IndigoFileUpdateChange(
            diff: diff ?? self.diff,
            kind: kind ?? self.kind,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoPatchChangeKind
public struct IndigoPatchChangeKind: Codable {
    public let type: PatchChangeKindType
    public let movePath: String?

    public enum CodingKeys: String, CodingKey {
        case type
        case movePath = "move_path"
    }

    public init(type: PatchChangeKindType, movePath: String?) {
        self.type = type
        self.movePath = movePath
    }
}

// MARK: IndigoPatchChangeKind convenience initializers and mutators

public extension IndigoPatchChangeKind {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoPatchChangeKind.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        type: PatchChangeKindType? = nil,
        movePath: String?? = nil
    ) -> IndigoPatchChangeKind {
        return IndigoPatchChangeKind(
            type: type ?? self.type,
            movePath: movePath ?? self.movePath
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoCommandAction
public struct IndigoCommandAction: Codable {
    public let command: String
    public let name: String?
    public let path: String?
    public let type: CommandActionType
    public let query: String?

    public init(command: String, name: String?, path: String?, type: CommandActionType, query: String?) {
        self.command = command
        self.name = name
        self.path = path
        self.type = type
        self.query = query
    }
}

// MARK: IndigoCommandAction convenience initializers and mutators

public extension IndigoCommandAction {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoCommandAction.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        command: String? = nil,
        name: String?? = nil,
        path: String?? = nil,
        type: CommandActionType? = nil,
        query: String?? = nil
    ) -> IndigoCommandAction {
        return IndigoCommandAction(
            command: command ?? self.command,
            name: name ?? self.name,
            path: path ?? self.path,
            type: type ?? self.type,
            query: query ?? self.query
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum MagentaUserInput: Codable {
    case indigoUserInput(IndigoUserInput)
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(IndigoUserInput.self) {
            self = .indigoUserInput(x)
            return
        }
        throw DecodingError.typeMismatch(MagentaUserInput.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for MagentaUserInput"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .indigoUserInput(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

// MARK: - IndigoUserInput
public struct IndigoUserInput: Codable {
    public let text: String?
    /// UI-defined spans within `text` used to render or persist special elements.
    public let textElements: [IndigoTextElement]?
    public let type: UserInputType
    public let detail: ImageDetail?
    public let url, path, name: String?

    public enum CodingKeys: String, CodingKey {
        case text
        case textElements = "text_elements"
        case type, detail, url, path, name
    }

    public init(text: String?, textElements: [IndigoTextElement]?, type: UserInputType, detail: ImageDetail?, url: String?, path: String?, name: String?) {
        self.text = text
        self.textElements = textElements
        self.type = type
        self.detail = detail
        self.url = url
        self.path = path
        self.name = name
    }
}

// MARK: IndigoUserInput convenience initializers and mutators

public extension IndigoUserInput {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoUserInput.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        textElements: [IndigoTextElement]?? = nil,
        type: UserInputType? = nil,
        detail: ImageDetail?? = nil,
        url: String?? = nil,
        path: String?? = nil,
        name: String?? = nil
    ) -> IndigoUserInput {
        return IndigoUserInput(
            text: text ?? self.text,
            textElements: textElements ?? self.textElements,
            type: type ?? self.type,
            detail: detail ?? self.detail,
            url: url ?? self.url,
            path: path ?? self.path,
            name: name ?? self.name
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoTextElement
public struct IndigoTextElement: Codable {
    /// Byte range in the parent `text` buffer that this element occupies.
    public let byteRange: IndecentByteRange
    /// Optional human-readable placeholder for the element, displayed in the UI.
    public let placeholder: String?

    public init(byteRange: IndecentByteRange, placeholder: String?) {
        self.byteRange = byteRange
        self.placeholder = placeholder
    }
}

// MARK: IndigoTextElement convenience initializers and mutators

public extension IndigoTextElement {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoTextElement.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byteRange: IndecentByteRange? = nil,
        placeholder: String?? = nil
    ) -> IndigoTextElement {
        return IndigoTextElement(
            byteRange: byteRange ?? self.byteRange,
            placeholder: placeholder ?? self.placeholder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Byte range in the parent `text` buffer that this element occupies.
// MARK: - IndecentByteRange
public struct IndecentByteRange: Codable {
    public let end, start: Int

    public init(end: Int, start: Int) {
        self.end = end
        self.start = start
    }
}

// MARK: IndecentByteRange convenience initializers and mutators

public extension IndecentByteRange {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndecentByteRange.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        end: Int? = nil,
        start: Int? = nil
    ) -> IndecentByteRange {
        return IndecentByteRange(
            end: end ?? self.end,
            start: start ?? self.start
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoDynamicToolCallOutputContentItem
public struct IndigoDynamicToolCallOutputContentItem: Codable {
    public let text: String?
    public let type: InputDynamicToolCallOutputContentItemType
    public let imageURL, audioURL: String?

    public enum CodingKeys: String, CodingKey {
        case text, type
        case imageURL = "imageUrl"
        case audioURL = "audioUrl"
    }

    public init(text: String?, type: InputDynamicToolCallOutputContentItemType, imageURL: String?, audioURL: String?) {
        self.text = text
        self.type = type
        self.imageURL = imageURL
        self.audioURL = audioURL
    }
}

// MARK: IndigoDynamicToolCallOutputContentItem convenience initializers and mutators

public extension IndigoDynamicToolCallOutputContentItem {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoDynamicToolCallOutputContentItem.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        type: InputDynamicToolCallOutputContentItemType? = nil,
        imageURL: String?? = nil,
        audioURL: String?? = nil
    ) -> IndigoDynamicToolCallOutputContentItem {
        return IndigoDynamicToolCallOutputContentItem(
            text: text ?? self.text,
            type: type ?? self.type,
            imageURL: imageURL ?? self.imageURL,
            audioURL: audioURL ?? self.audioURL
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoMCPToolCallError
public struct IndigoMCPToolCallError: Codable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// MARK: IndigoMCPToolCallError convenience initializers and mutators

public extension IndigoMCPToolCallError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoMCPToolCallError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        message: String? = nil
    ) -> IndigoMCPToolCallError {
        return IndigoMCPToolCallError(
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoHookPromptFragment
public struct IndigoHookPromptFragment: Codable {
    public let hookRunID, text: String

    public enum CodingKeys: String, CodingKey {
        case hookRunID = "hookRunId"
        case text
    }

    public init(hookRunID: String, text: String) {
        self.hookRunID = hookRunID
        self.text = text
    }
}

// MARK: IndigoHookPromptFragment convenience initializers and mutators

public extension IndigoHookPromptFragment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoHookPromptFragment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hookRunID: String? = nil,
        text: String? = nil
    ) -> IndigoHookPromptFragment {
        return IndigoHookPromptFragment(
            hookRunID: hookRunID ?? self.hookRunID,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoMemoryCitation
public struct IndigoMemoryCitation: Codable {
    public let entries: [IndigoMemoryCitationEntry]
    public let threadIDS: [String]

    public enum CodingKeys: String, CodingKey {
        case entries
        case threadIDS = "threadIds"
    }

    public init(entries: [IndigoMemoryCitationEntry], threadIDS: [String]) {
        self.entries = entries
        self.threadIDS = threadIDS
    }
}

// MARK: IndigoMemoryCitation convenience initializers and mutators

public extension IndigoMemoryCitation {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoMemoryCitation.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        entries: [IndigoMemoryCitationEntry]? = nil,
        threadIDS: [String]? = nil
    ) -> IndigoMemoryCitation {
        return IndigoMemoryCitation(
            entries: entries ?? self.entries,
            threadIDS: threadIDS ?? self.threadIDS
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - IndigoMemoryCitationEntry
public struct IndigoMemoryCitationEntry: Codable {
    public let lineEnd, lineStart: Int
    public let note, path: String

    public init(lineEnd: Int, lineStart: Int, note: String, path: String) {
        self.lineEnd = lineEnd
        self.lineStart = lineStart
        self.note = note
        self.path = path
    }
}

// MARK: IndigoMemoryCitationEntry convenience initializers and mutators

public extension IndigoMemoryCitationEntry {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoMemoryCitationEntry.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        lineEnd: Int? = nil,
        lineStart: Int? = nil,
        note: String? = nil,
        path: String? = nil
    ) -> IndigoMemoryCitationEntry {
        return IndigoMemoryCitationEntry(
            lineEnd: lineEnd ?? self.lineEnd,
            lineStart: lineStart ?? self.lineStart,
            note: note ?? self.note,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum IndigoResult: Codable {
    case indigoMCPToolCallResult(IndigoMCPToolCallResult)
    case string(String)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if let x = try? container.decode(IndigoMCPToolCallResult.self) {
            self = .indigoMCPToolCallResult(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(IndigoResult.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for IndigoResult"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .indigoMCPToolCallResult(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - IndigoMCPToolCallResult
public struct IndigoMCPToolCallResult: Codable {
    public let meta: JSONAny?
    public let content: [JSONAny]
    public let structuredContent: JSONAny?

    public enum CodingKeys: String, CodingKey {
        case meta = "_meta"
        case content, structuredContent
    }

    public init(meta: JSONAny?, content: [JSONAny], structuredContent: JSONAny?) {
        self.meta = meta
        self.content = content
        self.structuredContent = structuredContent
    }
}

// MARK: IndigoMCPToolCallResult convenience initializers and mutators

public extension IndigoMCPToolCallResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IndigoMCPToolCallResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        meta: JSONAny?? = nil,
        content: [JSONAny]? = nil,
        structuredContent: JSONAny?? = nil
    ) -> IndigoMCPToolCallResult {
        return IndigoMCPToolCallResult(
            meta: meta ?? self.meta,
            content: content ?? self.content,
            structuredContent: structuredContent ?? self.structuredContent
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ReasoningSummaryTextDeltaNotification
public struct ReasoningSummaryTextDeltaNotification: Codable {
    public let delta, itemID: String
    public let summaryIndex: Int
    public let threadID, turnID: String

    public enum CodingKeys: String, CodingKey {
        case delta
        case itemID = "itemId"
        case summaryIndex
        case threadID = "threadId"
        case turnID = "turnId"
    }

    public init(delta: String, itemID: String, summaryIndex: Int, threadID: String, turnID: String) {
        self.delta = delta
        self.itemID = itemID
        self.summaryIndex = summaryIndex
        self.threadID = threadID
        self.turnID = turnID
    }
}

// MARK: ReasoningSummaryTextDeltaNotification convenience initializers and mutators

public extension ReasoningSummaryTextDeltaNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ReasoningSummaryTextDeltaNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        delta: String? = nil,
        itemID: String? = nil,
        summaryIndex: Int? = nil,
        threadID: String? = nil,
        turnID: String? = nil
    ) -> ReasoningSummaryTextDeltaNotification {
        return ReasoningSummaryTextDeltaNotification(
            delta: delta ?? self.delta,
            itemID: itemID ?? self.itemID,
            summaryIndex: summaryIndex ?? self.summaryIndex,
            threadID: threadID ?? self.threadID,
            turnID: turnID ?? self.turnID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - ErrorNotification
public struct ErrorNotification: Codable {
    public let error: TurnError
    public let threadID, turnID: String
    public let willRetry: Bool

    public enum CodingKeys: String, CodingKey {
        case error
        case threadID = "threadId"
        case turnID = "turnId"
        case willRetry
    }

    public init(error: TurnError, threadID: String, turnID: String, willRetry: Bool) {
        self.error = error
        self.threadID = threadID
        self.turnID = turnID
        self.willRetry = willRetry
    }
}

// MARK: ErrorNotification convenience initializers and mutators

public extension ErrorNotification {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ErrorNotification.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        error: TurnError? = nil,
        threadID: String? = nil,
        turnID: String? = nil,
        willRetry: Bool? = nil
    ) -> ErrorNotification {
        return ErrorNotification(
            error: error ?? self.error,
            threadID: threadID ?? self.threadID,
            turnID: turnID ?? self.turnID,
            willRetry: willRetry ?? self.willRetry
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - TurnError
public struct TurnError: Codable {
    public let additionalDetails: String?
    public let codexErrorInfo: ErrorCodexErrorInfo?
    public let message: String

    public init(additionalDetails: String?, codexErrorInfo: ErrorCodexErrorInfo?, message: String) {
        self.additionalDetails = additionalDetails
        self.codexErrorInfo = codexErrorInfo
        self.message = message
    }
}

// MARK: TurnError convenience initializers and mutators

public extension TurnError {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TurnError.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        additionalDetails: String?? = nil,
        codexErrorInfo: ErrorCodexErrorInfo?? = nil,
        message: String? = nil
    ) -> TurnError {
        return TurnError(
            additionalDetails: additionalDetails ?? self.additionalDetails,
            codexErrorInfo: codexErrorInfo ?? self.codexErrorInfo,
            message: message ?? self.message
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ErrorCodexErrorInfo: Codable {
    case enumeration(CodexErrorInfoEnum)
    case stickyCodexErrorInfo(StickyCodexErrorInfo)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(CodexErrorInfoEnum.self) {
            self = .enumeration(x)
            return
        }
        if let x = try? container.decode(StickyCodexErrorInfo.self) {
            self = .stickyCodexErrorInfo(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(ErrorCodexErrorInfo.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for ErrorCodexErrorInfo"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .enumeration(let x):
            try container.encode(x)
        case .stickyCodexErrorInfo(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

/// Failed to connect to the response SSE stream.
///
/// The response SSE stream disconnected in the middle of a turn before completion.
///
/// Reached the retry limit for responses.
///
/// Returned when `turn/start` or `turn/steer` is submitted while the current active turn
/// cannot accept same-turn steering, for example `/review` or manual `/compact`.
// MARK: - StickyCodexErrorInfo
public struct StickyCodexErrorInfo: Codable {
    public let httpConnectionFailed: StickyHTTPConnectionFailed?
    public let responseStreamConnectionFailed: StickyResponseStreamConnectionFailed?
    public let responseStreamDisconnected: StickyResponseStreamDisconnected?
    public let responseTooManyFailedAttempts: StickyResponseTooManyFailedAttempts?
    public let activeTurnNotSteerable: StickyActiveTurnNotSteerable?

    public init(httpConnectionFailed: StickyHTTPConnectionFailed?, responseStreamConnectionFailed: StickyResponseStreamConnectionFailed?, responseStreamDisconnected: StickyResponseStreamDisconnected?, responseTooManyFailedAttempts: StickyResponseTooManyFailedAttempts?, activeTurnNotSteerable: StickyActiveTurnNotSteerable?) {
        self.httpConnectionFailed = httpConnectionFailed
        self.responseStreamConnectionFailed = responseStreamConnectionFailed
        self.responseStreamDisconnected = responseStreamDisconnected
        self.responseTooManyFailedAttempts = responseTooManyFailedAttempts
        self.activeTurnNotSteerable = activeTurnNotSteerable
    }
}

// MARK: StickyCodexErrorInfo convenience initializers and mutators

public extension StickyCodexErrorInfo {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyCodexErrorInfo.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpConnectionFailed: StickyHTTPConnectionFailed?? = nil,
        responseStreamConnectionFailed: StickyResponseStreamConnectionFailed?? = nil,
        responseStreamDisconnected: StickyResponseStreamDisconnected?? = nil,
        responseTooManyFailedAttempts: StickyResponseTooManyFailedAttempts?? = nil,
        activeTurnNotSteerable: StickyActiveTurnNotSteerable?? = nil
    ) -> StickyCodexErrorInfo {
        return StickyCodexErrorInfo(
            httpConnectionFailed: httpConnectionFailed ?? self.httpConnectionFailed,
            responseStreamConnectionFailed: responseStreamConnectionFailed ?? self.responseStreamConnectionFailed,
            responseStreamDisconnected: responseStreamDisconnected ?? self.responseStreamDisconnected,
            responseTooManyFailedAttempts: responseTooManyFailedAttempts ?? self.responseTooManyFailedAttempts,
            activeTurnNotSteerable: activeTurnNotSteerable ?? self.activeTurnNotSteerable
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyActiveTurnNotSteerable
public struct StickyActiveTurnNotSteerable: Codable {
    public let turnKind: NonSteerableTurnKind

    public init(turnKind: NonSteerableTurnKind) {
        self.turnKind = turnKind
    }
}

// MARK: StickyActiveTurnNotSteerable convenience initializers and mutators

public extension StickyActiveTurnNotSteerable {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyActiveTurnNotSteerable.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        turnKind: NonSteerableTurnKind? = nil
    ) -> StickyActiveTurnNotSteerable {
        return StickyActiveTurnNotSteerable(
            turnKind: turnKind ?? self.turnKind
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyHTTPConnectionFailed
public struct StickyHTTPConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: StickyHTTPConnectionFailed convenience initializers and mutators

public extension StickyHTTPConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyHTTPConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> StickyHTTPConnectionFailed {
        return StickyHTTPConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyResponseStreamConnectionFailed
public struct StickyResponseStreamConnectionFailed: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: StickyResponseStreamConnectionFailed convenience initializers and mutators

public extension StickyResponseStreamConnectionFailed {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyResponseStreamConnectionFailed.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> StickyResponseStreamConnectionFailed {
        return StickyResponseStreamConnectionFailed(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyResponseStreamDisconnected
public struct StickyResponseStreamDisconnected: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: StickyResponseStreamDisconnected convenience initializers and mutators

public extension StickyResponseStreamDisconnected {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyResponseStreamDisconnected.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> StickyResponseStreamDisconnected {
        return StickyResponseStreamDisconnected(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - StickyResponseTooManyFailedAttempts
public struct StickyResponseTooManyFailedAttempts: Codable {
    public let httpStatusCode: Int?

    public init(httpStatusCode: Int?) {
        self.httpStatusCode = httpStatusCode
    }
}

// MARK: StickyResponseTooManyFailedAttempts convenience initializers and mutators

public extension StickyResponseTooManyFailedAttempts {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(StickyResponseTooManyFailedAttempts.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        httpStatusCode: Int?? = nil
    ) -> StickyResponseTooManyFailedAttempts {
        return StickyResponseTooManyFailedAttempts(
            httpStatusCode: httpStatusCode ?? self.httpStatusCode
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Helper functions for creating encoders and decoders

func newJSONDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        decoder.dateDecodingStrategy = .iso8601
    }
    return decoder
}

func newJSONEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        encoder.dateEncodingStrategy = .iso8601
    }
    return encoder
}

// MARK: - Encode/decode helpers

public class JSONNull: Codable, Hashable {

    public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
        return true
    }

    public var hashValue: Int {
        return 0
    }

    public func hash(into hasher: inout Hasher) {
        // No-op
    }

    public init() {}

    public required init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if !container.decodeNil() {
            throw DecodingError.typeMismatch(JSONNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for JSONNull"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encodeNil()
    }
}

class JSONCodingKey: CodingKey {
    let key: String

    required init?(intValue: Int) {
        return nil
    }

    required init?(stringValue: String) {
        key = stringValue
    }

    var intValue: Int? {
        return nil
    }

    var stringValue: String {
        return key
    }
}

public class JSONAny: Codable {

    public let value: Any

    static func decodingError(forCodingPath codingPath: [CodingKey]) -> DecodingError {
        let context = DecodingError.Context(codingPath: codingPath, debugDescription: "Cannot decode JSONAny")
        return DecodingError.typeMismatch(JSONAny.self, context)
    }

    static func encodingError(forValue value: Any, codingPath: [CodingKey]) -> EncodingError {
        let context = EncodingError.Context(codingPath: codingPath, debugDescription: "Cannot encode JSONAny")
        return EncodingError.invalidValue(value, context)
    }

    static func decode(from container: SingleValueDecodingContainer) throws -> Any {
        if let value = try? container.decode(Bool.self) {
            return value
        }
        if let value = try? container.decode(Int64.self) {
            return value
        }
        if let value = try? container.decode(Double.self) {
            return value
        }
        if let value = try? container.decode(String.self) {
            return value
        }
        if container.decodeNil() {
            return JSONNull()
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout UnkeyedDecodingContainer) throws -> Any {
        if let value = try? container.decode(Bool.self) {
            return value
        }
        if let value = try? container.decode(Int64.self) {
            return value
        }
        if let value = try? container.decode(Double.self) {
            return value
        }
        if let value = try? container.decode(String.self) {
            return value
        }
        if let value = try? container.decodeNil() {
            if value {
                return JSONNull()
            }
        }
        if var container = try? container.nestedUnkeyedContainer() {
            return try decodeArray(from: &container)
        }
        if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self) {
            return try decodeDictionary(from: &container)
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout KeyedDecodingContainer<JSONCodingKey>, forKey key: JSONCodingKey) throws -> Any {
        if let value = try? container.decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Int64.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Double.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(String.self, forKey: key) {
            return value
        }
        if let value = try? container.decodeNil(forKey: key) {
            if value {
                return JSONNull()
            }
        }
        if var container = try? container.nestedUnkeyedContainer(forKey: key) {
            return try decodeArray(from: &container)
        }
        if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key) {
            return try decodeDictionary(from: &container)
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decodeArray(from container: inout UnkeyedDecodingContainer) throws -> [Any] {
        var arr: [Any] = []
        while !container.isAtEnd {
            let value = try decode(from: &container)
            arr.append(value)
        }
        return arr
    }

    static func decodeDictionary(from container: inout KeyedDecodingContainer<JSONCodingKey>) throws -> [String: Any] {
        var dict = [String: Any]()
        for key in container.allKeys {
            let value = try decode(from: &container, forKey: key)
            dict[key.stringValue] = value
        }
        return dict
    }

    static func encode(to container: inout UnkeyedEncodingContainer, array: [Any]) throws {
        for value in array {
            if let value = value as? Bool {
                try container.encode(value)
            } else if let value = value as? Int64 {
                try container.encode(value)
            } else if let value = value as? Double {
                try container.encode(value)
            } else if let value = value as? String {
                try container.encode(value)
            } else if value is JSONNull {
                try container.encodeNil()
            } else if let value = value as? [Any] {
                var container = container.nestedUnkeyedContainer()
                try encode(to: &container, array: value)
            } else if let value = value as? [String: Any] {
                var container = container.nestedContainer(keyedBy: JSONCodingKey.self)
                try encode(to: &container, dictionary: value)
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }
    }

    static func encode(to container: inout KeyedEncodingContainer<JSONCodingKey>, dictionary: [String: Any]) throws {
        for (key, value) in dictionary {
            let key = JSONCodingKey(stringValue: key)!
            if let value = value as? Bool {
                try container.encode(value, forKey: key)
            } else if let value = value as? Int64 {
                try container.encode(value, forKey: key)
            } else if let value = value as? Double {
                try container.encode(value, forKey: key)
            } else if let value = value as? String {
                try container.encode(value, forKey: key)
            } else if value is JSONNull {
                try container.encodeNil(forKey: key)
            } else if let value = value as? [Any] {
                var container = container.nestedUnkeyedContainer(forKey: key)
                try encode(to: &container, array: value)
            } else if let value = value as? [String: Any] {
                var container = container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key)
                try encode(to: &container, dictionary: value)
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }
    }

    static func encode(to container: inout SingleValueEncodingContainer, value: Any) throws {
        if let value = value as? Bool {
            try container.encode(value)
        } else if let value = value as? Int64 {
            try container.encode(value)
        } else if let value = value as? Double {
            try container.encode(value)
        } else if let value = value as? String {
            try container.encode(value)
        } else if value is JSONNull {
            try container.encodeNil()
        } else {
            throw encodingError(forValue: value, codingPath: container.codingPath)
        }
    }

    public required init(from decoder: Decoder) throws {
        if var arrayContainer = try? decoder.unkeyedContainer() {
            self.value = try JSONAny.decodeArray(from: &arrayContainer)
        } else if var container = try? decoder.container(keyedBy: JSONCodingKey.self) {
            self.value = try JSONAny.decodeDictionary(from: &container)
        } else {
            let container = try decoder.singleValueContainer()
            self.value = try JSONAny.decode(from: container)
        }
    }

    public func encode(to encoder: Encoder) throws {
        if let arr = self.value as? [Any] {
            var container = encoder.unkeyedContainer()
            try JSONAny.encode(to: &container, array: arr)
        } else if let dict = self.value as? [String: Any] {
            var container = encoder.container(keyedBy: JSONCodingKey.self)
            try JSONAny.encode(to: &container, dictionary: dict)
        } else {
            var container = encoder.singleValueContainer()
            try JSONAny.encode(to: &container, value: self.value)
        }
    }
}
