import SwiftUI

public struct SessionDetailView: View {
    @Environment(AppModel.self) private var app
    @State private var model: SessionModel
    @State private var draft = ""
    @FocusState private var composerFocused: Bool

    public init(session: AgentSession, desktop: Desktop, options: AgentOptions) {
        _model = State(initialValue: SessionModel(session: session, desktop: desktop, options: options))
    }

    public var body: some View {
        VStack(spacing: 0) {
            transcript
            Divider()
            composer
        }
        .navigationTitle(model.session.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if model.isStreaming {
                    Button(role: .destructive) {
                        Task { await model.interrupt() }
                    } label: {
                        Label("Stop", systemImage: "stop.circle")
                    }
                }
            }
        }
        .task { await model.connect() }
        .onDisappear { Task { await model.disconnect() } }
        .alert(item: Binding(
            get: { model.pendingApproval },
            set: { model.pendingApproval = $0 }
        )) { approval in
            Alert(
                title: Text(approvalTitle(approval.kind)),
                message: Text(approval.summary),
                primaryButton: .default(Text("Approve")) {
                    Task { await model.resolve(approval, approved: true) }
                },
                secondaryButton: .cancel(Text("Deny")) {
                    Task { await model.resolve(approval, approved: false) }
                }
            )
        }
    }

    private func approvalTitle(_ kind: SessionModel.PendingApproval.Kind) -> String {
        switch kind {
        case .command: return "Run command?"
        case .fileChange: return "Apply changes?"
        case .ccPermission: return "Allow tool?"
        }
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(model.transcript.items) { item in
                        TranscriptRow(item: item, assistantLabel: model.session.agent.displayName)
                            .id(item.id)
                    }
                }
                .padding()
            }
            .onChange(of: model.transcript.items.count) {
                guard let last = model.transcript.items.last else { return }
                withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
            }
        }
    }

    /// Field and controls share one box: the mode and model belong to the message
    /// about to be sent, so they sit with it rather than in the navigation bar.
    private var composer: some View {
        VStack(spacing: 8) {
            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .focused($composerFocused)

            HStack(spacing: 8) {
                AgentOptionsMenu(
                    agent: model.session.agent,
                    models: app.availableModels(for: model.session.agent),
                    options: model.options
                ) { updated in Task { await model.update(updated) } }

                Spacer()

                Button {
                    let text = draft
                    draft = ""
                    Task { await model.send(text) }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

private struct TranscriptRow: View {
    let item: TranscriptItem
    let assistantLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(tint)
                Text(label)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                if !item.isComplete {
                    ProgressView().controlSize(.mini)
                }
            }

            Text(item.text)
                .font(item.role == .tool ? .system(.footnote, design: .monospaced) : .body)
                .foregroundStyle(item.role == .reasoning ? .secondary : .primary)
                .textSelection(.enabled)

            if let detail = item.detail {
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var label: String {
        switch item.role {
        case .user: return "You"
        case .assistant: return assistantLabel
        case .reasoning: return "Thinking"
        case .tool: return "Tool"
        case .error: return "Error"
        }
    }

    private var icon: String {
        switch item.role {
        case .user: return "person.circle"
        case .assistant: return "sparkles"
        case .reasoning: return "brain"
        case .tool: return "terminal"
        case .error: return "exclamationmark.triangle"
        }
    }

    private var tint: Color {
        switch item.role {
        case .error: return .red
        case .tool: return .orange
        case .reasoning: return .secondary
        default: return .accentColor
        }
    }
}
