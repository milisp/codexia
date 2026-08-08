import Foundation

/// Rebuilds a transcript from a codex `thread/resume` response.
///
/// Resume is the only place the desktop hands back what already happened; the
/// live event stream starts at the next turn. Without this the phone opens an
/// existing thread on a blank screen.
enum CodexHistoryDecoder {
    static func decode(_ response: JSONValue) -> [TranscriptItem] {
        let turns = response.path("thread", "turns")?.arrayValue
            ?? response["turns"]?.arrayValue
            ?? []
        return turns.flatMap { turn in
            (turn["items"]?.arrayValue ?? []).compactMap(item(from:))
        }
    }

    private static func item(from raw: JSONValue) -> TranscriptItem? {
        guard let id = raw["id"]?.stringValue, let type = raw["type"]?.stringValue else {
            return nil
        }

        switch type {
        case "userMessage":
            let text = (raw["content"]?.arrayValue ?? [])
                .compactMap { $0["text"]?.stringValue }
                .joined(separator: "\n")
            return text.isEmpty ? nil : TranscriptItem(id: id, role: .user, text: text)

        case "agentMessage", "plan":
            guard let text = raw["text"]?.stringValue, !text.isEmpty else { return nil }
            return TranscriptItem(id: id, role: .assistant, text: text)

        case "reasoning":
            let summary = (raw["summary"]?.arrayValue ?? [])
                .compactMap(\.stringValue)
                .joined(separator: "\n")
            return summary.isEmpty ? nil : TranscriptItem(id: id, role: .reasoning, text: summary)

        case "commandExecution":
            return TranscriptItem(
                id: id,
                role: .tool,
                text: raw["command"]?.stringValue ?? "command",
                detail: raw["status"]?.stringValue
            )

        case "fileChange":
            return TranscriptItem(
                id: id,
                role: .tool,
                text: "Edited files",
                detail: raw["status"]?.stringValue
            )

        case "mcpToolCall":
            let tool = raw["tool"]?.stringValue ?? "tool"
            return TranscriptItem(
                id: id,
                role: .tool,
                text: "\(raw["server"]?.stringValue ?? "mcp") · \(tool)",
                detail: raw["status"]?.stringValue
            )

        default:
            return nil
        }
    }
}

/// Rebuilds a transcript from `/api/cc/session-messages`.
///
/// cc stores history as raw Anthropic messages, so one stored message can carry
/// several displayable blocks; each becomes its own row keyed by the message
/// uuid plus its block index.
enum CCHistoryDecoder {
    static func decode(_ response: JSONValue) -> [TranscriptItem] {
        (response.arrayValue ?? []).flatMap(items(from:))
    }

    private static func items(from raw: JSONValue) -> [TranscriptItem] {
        guard let uuid = raw["uuid"]?.stringValue,
              let type = raw["type"]?.stringValue,
              let message = raw["message"]
        else { return [] }

        let role: TranscriptItem.Role = type == "user" ? .user : .assistant
        return blocks(in: message, role: role, idPrefix: uuid)
    }

    /// Flattens a message's `content` — which may be a plain string or an array
    /// of typed blocks — into transcript rows.
    static func blocks(
        in message: JSONValue,
        role: TranscriptItem.Role,
        idPrefix: String
    ) -> [TranscriptItem] {
        guard let content = message["content"] else { return [] }

        if let text = content.stringValue {
            return text.isEmpty ? [] : [TranscriptItem(id: idPrefix, role: role, text: text)]
        }

        return (content.arrayValue ?? []).enumerated().compactMap { index, block in
            item(from: block, role: role, id: "\(idPrefix)-\(index)")
        }
    }

    private static func item(
        from block: JSONValue,
        role: TranscriptItem.Role,
        id: String
    ) -> TranscriptItem? {
        switch block["type"]?.stringValue {
        case "text":
            guard let text = block["text"]?.stringValue, !text.isEmpty else { return nil }
            return TranscriptItem(id: id, role: role, text: text)

        case "thinking":
            guard let text = block["thinking"]?.stringValue, !text.isEmpty else { return nil }
            return TranscriptItem(id: id, role: .reasoning, text: text)

        case "tool_use":
            let name = block["name"]?.stringValue ?? "tool"
            let input = block["input"]
            // Show the argument that identifies the call; the rest is noise on a phone.
            let detail = input?["command"]?.stringValue
                ?? input?["file_path"]?.stringValue
                ?? input?["pattern"]?.stringValue
            return TranscriptItem(id: id, role: .tool, text: name, detail: detail)

        default:
            // tool_result and images are dropped: the phone shows what ran, not its output.
            return nil
        }
    }
}
