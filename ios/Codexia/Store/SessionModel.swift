import Foundation
import Observation

/// Drives one open session: streams events and maintains its transcript.
@MainActor
@Observable
public final class SessionModel {
    public let session: AgentSession
    public private(set) var transcript = Transcript()
    public private(set) var isStreaming = false
    public private(set) var isConnected = false
    public private(set) var errorMessage: String?
    /// Set when the desktop asks the user to approve a command or file change.
    /// Writable so the alert's binding can clear it on dismiss.
    public var pendingApproval: PendingApproval?
    /// Settings this session runs under, seeded from the agent's defaults.
    public private(set) var options: AgentOptions

    private let client: APIClient
    private let stream: EventStream

    public struct PendingApproval: Identifiable, Sendable {
        public enum Kind: Sendable { case command, fileChange, ccPermission }
        /// Codex numbers its requests and cc uses opaque strings; the string form
        /// covers both and is converted back where codex needs the number.
        public let id: String
        public let kind: Kind
        public let summary: String
    }

    public init(session: AgentSession, desktop: Desktop, options: AgentOptions) {
        self.session = session
        self.options = options
        self.client = APIClient(desktop: desktop)
        self.stream = EventStream(desktop: desktop, agents: [session.agent])
    }

    /// Applies new settings to this session.
    ///
    /// cc can switch permission mode on a live session; codex fixes its approval
    /// policy when the thread starts, so there the change lands on the next
    /// resume. Model changes are applied on resume for both.
    public func update(_ newOptions: AgentOptions) async {
        let modeChanged = newOptions.mode != options.mode
        options = newOptions

        guard modeChanged, let ccMode = newOptions.ccMode else { return }
        do {
            try await client.setCCPermissionMode(sessionId: session.id, mode: ccMode)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Whether a permission change takes effect immediately for this agent.
    public var appliesPermissionLive: Bool {
        session.agent == .cc
    }

    public func connect() async {
        await stream.start { [weak self] envelope in
            await self?.handle(envelope)
        }
        isConnected = true

        do {
            // Resume returns what has already been said; without it the screen
            // opens blank on a thread that has hours of history behind it.
            for item in try await client.resume(session: session, options: options) {
                transcript.upsert(item)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func disconnect() async {
        await stream.stop()
        isConnected = false
    }

    public func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        // Echo immediately: waiting for the server round-trip makes the phone
        // feel unresponsive on a cellular link.
        transcript.upsert(
            TranscriptItem(id: "local-\(UUID().uuidString)", role: .user, text: trimmed)
        )
        isStreaming = true

        do {
            try await client.startTurn(session: session, text: trimmed)
        } catch {
            errorMessage = error.localizedDescription
            isStreaming = false
        }
    }

    public func interrupt() async {
        do {
            try await client.interrupt(session: session)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func resolve(_ approval: PendingApproval, approved: Bool) async {
        let decision: APIClient.ApprovalDecision = approved ? .approved : .denied
        do {
            switch approval.kind {
            case .command:
                guard let id = Int(approval.id) else { return }
                try await client.respondToCommandApproval(requestId: id, decision: decision)
            case .fileChange:
                guard let id = Int(approval.id) else { return }
                try await client.respondToFileChangeApproval(requestId: id, decision: decision)
            case .ccPermission:
                try await client.respondToCCPermission(requestId: approval.id, decision: decision)
            }
            pendingApproval = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Event handling

    private func handle(_ envelope: EventEnvelope) {
        if envelope.event == "cc-message" {
            handleCCMessage(envelope.payload)
            return
        }

        if envelope.event == "codex/approval-request" {
            handleApprovalRequest(envelope.payload)
            return
        }

        guard let notification = envelope.codexNotification else { return }
        // Notifications are broadcast for every thread on the desktop, so drop
        // anything belonging to a session this screen is not showing.
        if let threadId = notification.params["threadId"]?.stringValue, threadId != session.id {
            return
        }

        switch notification.method {
        case "turn/started":
            isStreaming = true

        case "turn/completed":
            isStreaming = false
            markCurrentItemsComplete()

        case "item/agentMessage/delta":
            appendDelta(notification.params, role: .assistant)

        case "item/reasoning/summaryTextDelta":
            appendDelta(notification.params, role: .reasoning)

        case "item/started", "item/completed":
            upsertItem(notification.params, complete: notification.method == "item/completed")

        case "error":
            let message = notification.params["message"]?.stringValue ?? "Unknown error"
            transcript.upsert(
                TranscriptItem(id: "error-\(UUID().uuidString)", role: .error, text: message)
            )
            isStreaming = false

        default:
            break
        }
    }

    private func appendDelta(_ params: JSONValue, role: TranscriptItem.Role) {
        guard let itemId = params["itemId"]?.stringValue ?? params.path("item", "id")?.stringValue,
              let delta = params["delta"]?.stringValue
        else { return }
        transcript.appendDelta(id: itemId, role: role, delta: delta)
    }

    private func upsertItem(_ params: JSONValue, complete: Bool) {
        guard let item = params["item"],
              let id = item["id"]?.stringValue
        else { return }

        let type = item["itemType"]?.stringValue ?? item["type"]?.stringValue ?? ""
        switch type {
        case "agentMessage", "assistantMessage":
            let text = item["text"]?.stringValue ?? ""
            if !text.isEmpty {
                transcript.upsert(
                    TranscriptItem(id: id, role: .assistant, text: text, isComplete: complete)
                )
            } else if complete {
                transcript.markComplete(id: id)
            }

        case "commandExecution":
            let command = item["command"]?.stringValue ?? "command"
            transcript.upsert(
                TranscriptItem(
                    id: id,
                    role: .tool,
                    text: command,
                    detail: item["status"]?.stringValue,
                    isComplete: complete
                )
            )

        case "fileChange":
            transcript.upsert(
                TranscriptItem(
                    id: id,
                    role: .tool,
                    text: "Edited files",
                    detail: item["status"]?.stringValue,
                    isComplete: complete
                )
            )

        default:
            if complete { transcript.markComplete(id: id) }
        }
    }

    private func markCurrentItemsComplete() {
        for item in transcript.items where !item.isComplete {
            transcript.markComplete(id: item.id)
        }
    }

    private func handleApprovalRequest(_ payload: JSONValue) {
        guard let requestId = payload["requestId"]?.intValue ?? payload["id"]?.intValue else {
            return
        }
        if let command = payload.path("params", "command")?.stringValue
            ?? payload["command"]?.stringValue {
            pendingApproval = PendingApproval(
                id: String(requestId),
                kind: .command,
                summary: command
            )
        } else {
            pendingApproval = PendingApproval(
                id: String(requestId),
                kind: .fileChange,
                summary: "Apply file changes?"
            )
        }
    }

    // MARK: - Claude Code events

    /// cc emits whole SDK messages rather than deltas, so each frame is either a
    /// complete block to append or a lifecycle marker.
    private func handleCCMessage(_ payload: JSONValue) {
        // The desktop stamps every frame with the caller's session id.
        if let sessionId = payload["session_id"]?.stringValue, sessionId != session.id {
            return
        }

        switch payload["type"]?.stringValue {
        case "assistant":
            guard let message = payload["message"] else { return }
            let prefix = payload["uuid"]?.stringValue ?? UUID().uuidString
            for item in CCHistoryDecoder.blocks(in: message, role: .assistant, idPrefix: prefix) {
                transcript.upsert(item)
            }

        case "result":
            isStreaming = false
            markCurrentItemsComplete()
            if payload["is_error"] == .bool(true) {
                let message = payload["result"]?.stringValue ?? "The session reported an error."
                transcript.upsert(
                    TranscriptItem(id: "error-\(UUID().uuidString)", role: .error, text: message)
                )
            }

        case "permission_request":
            guard let requestId = payload["requestId"]?.stringValue else { return }
            let tool = payload["toolName"]?.stringValue ?? "a tool"
            let detail = payload.path("toolInput", "command")?.stringValue
                ?? payload.path("toolInput", "file_path")?.stringValue
            pendingApproval = PendingApproval(
                id: requestId,
                kind: .ccPermission,
                summary: detail.map { "\(tool): \($0)" } ?? tool
            )

        default:
            break
        }
    }
}
