import SwiftUI

/// Mode and model pickers for one agent, sized to sit in a composer toolbar.
///
/// The same control serves the session list (where it sets what new sessions
/// start with) and an open session (where it changes that session), so the two
/// places cannot drift apart in wording or behaviour. The choices come from
/// `AgentMode.all(for:)`, so each agent shows only its own vocabulary.
public struct AgentOptionsMenu: View {
    let agent: AgentKind
    let models: [AgentModel]
    let options: AgentOptions
    let onChange: (AgentOptions) -> Void

    public init(
        agent: AgentKind,
        models: [AgentModel],
        options: AgentOptions,
        onChange: @escaping (AgentOptions) -> Void
    ) {
        self.agent = agent
        self.models = models
        self.options = options
        self.onChange = onChange
    }

    public var body: some View {
        HStack(spacing: 4) {
            modeMenu
            if !models.isEmpty {
                modelMenu
            }
        }
        .font(.caption)
        .buttonStyle(.plain)
    }

    private var modeMenu: some View {
        Menu {
            ForEach(AgentMode.all(for: agent), id: \.self) { mode in
                Button {
                    var updated = options
                    updated.mode = mode
                    onChange(updated)
                } label: {
                    Label(
                        mode.displayName,
                        systemImage: mode == options.mode ? "checkmark" : mode.icon
                    )
                }
            }
        } label: {
            // Icon only: the phone's composer has no room for four words, and the
            // menu spells the mode out as soon as it opens.
            chip(systemImage: options.mode.icon)
                .accessibilityLabel(options.mode.displayName)
        }
    }

    private var modelMenu: some View {
        Menu {
            Button {
                var updated = options
                updated.model = nil
                onChange(updated)
            } label: {
                Label(
                    "Desktop default",
                    systemImage: options.model == nil ? "checkmark" : "desktopcomputer"
                )
            }

            ForEach(models) { model in
                Button {
                    var updated = options
                    updated.model = model.id
                    onChange(updated)
                } label: {
                    Label(
                        model.displayName,
                        systemImage: options.model == model.id ? "checkmark" : "cpu"
                    )
                }
            }
        } label: {
            chip(modelLabel, systemImage: "cpu")
        }
    }

    private var modelLabel: String {
        guard let model = options.model else { return "Default" }
        return models.first { $0.id == model }?.displayName ?? model
    }

    private func chip(_ title: String? = nil, systemImage: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: systemImage)
            if let title {
                Text(title).lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.quaternary, in: Capsule())
        .foregroundStyle(.secondary)
    }
}
