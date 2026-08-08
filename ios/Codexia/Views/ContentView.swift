import SwiftUI

public struct ContentView: View {
    @Environment(AppModel.self) private var app
    @State private var showingPairing = false
    @State private var showingDesktops = false

    public init() {}

    public var body: some View {
        NavigationStack {
            Group {
                if app.desktops.isEmpty {
                    EmptyPairingView { showingPairing = true }
                } else {
                    SessionListView()
                }
            }
            .navigationTitle(app.selectedDesktop?.name ?? "Codexia")
            // The agent picker takes the principal slot, so the title bar shows
            // the desktop name through the leading picker's label instead.
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if !app.desktops.isEmpty {
                        DesktopButton { showingDesktops = true }
                    }
                }
                ToolbarItem(placement: .principal) {
                    if !app.desktops.isEmpty {
                        AgentPicker()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingPairing = true
                    } label: {
                        Label("Pair desktop", systemImage: "plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showingPairing) {
            PairingView()
        }
        .sheet(isPresented: $showingDesktops) {
            DesktopDrawerView { showingPairing = true }
        }
        // Keyed on the desktop too: the catalog comes from it, and on first launch
        // there is no desktop to ask until pairing finishes.
        .task(id: [app.selectedAgent.rawValue, app.selectedDesktopID?.uuidString ?? ""]) {
            await app.loadModels(for: app.selectedAgent)
        }
    }
}

/// Switches which agent's sessions the list shows. A segmented control rather
/// than a menu: there are only two backends and the current one has to stay
/// visible, since the two lists look alike.
private struct AgentPicker: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Picker("Agent", selection: Binding(
            get: { app.selectedAgent },
            set: { agent in Task { await app.select(agent) } }
        )) {
            ForEach(AgentKind.allCases, id: \.self) { agent in
                Text(agent.displayName).tag(agent)
            }
        }
        .pickerStyle(.segmented)
        .fixedSize()
    }
}

/// Opens the desktop drawer, where desktops can be switched, removed or added.
private struct DesktopButton: View {
    @Environment(AppModel.self) private var app

    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                Image(systemName: "desktopcomputer")
                Text(app.selectedDesktop?.name ?? "Codexia")
                    .lineLimit(1)
            }
            .font(.subheadline)
        }
    }
}

private struct EmptyPairingView: View {
    let onPair: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("No desktop paired", systemImage: "desktopcomputer.trianglebadge.exclamationmark")
        } description: {
            Text("Open Codexia on your computer, find its Tailscale hostname and device token in Settings, then pair here.")
        } actions: {
            Button("Pair a desktop", action: onPair)
                .buttonStyle(.borderedProminent)
        }
    }
}
