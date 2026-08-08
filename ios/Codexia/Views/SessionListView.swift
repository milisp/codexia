import SwiftUI

public struct SessionListView: View {
    @Environment(AppModel.self) private var app
    /// Set after a create call succeeds, which pushes the new session's detail
    /// screen — a new thread is useless if the user has to find it in the list.
    @State private var openedSession: AgentSession?

    public init() {}

    public var body: some View {
        List {
            if let error = app.errorMessage {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                }
            }

            ForEach(app.projects) { project in
                Section {
                    if !app.isCollapsed(project) {
                        ForEach(project.sessions) { session in
                            if let desktop = app.selectedDesktop {
                                NavigationLink {
                                    SessionDetailView(
                    session: session,
                    desktop: desktop,
                    options: app.options(for: session.agent)
                )
                                } label: {
                                    SessionRow(session: session)
                                }
                            }
                        }
                    }
                } header: {
                    ProjectHeader(project: project) {
                        Task { openedSession = await app.createSession(cwd: project.path) }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(item: $openedSession) { session in
            if let desktop = app.selectedDesktop {
                SessionDetailView(
                    session: session,
                    desktop: desktop,
                    options: app.options(for: session.agent)
                )
            }
        }
        .overlay {
            if app.sessions.isEmpty && !app.isLoading && app.errorMessage == nil {
                ContentUnavailableView(
                    "No \(app.selectedAgent.displayName) sessions",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("Start a session on the desktop and it will appear here.")
                )
            }
        }
        .refreshable { await app.refreshSessions() }
        .task { await app.refreshSessions() }
    }
}

private struct ProjectHeader: View {
    @Environment(AppModel.self) private var app
    let project: SessionProject
    let onNewSession: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Button {
                app.toggleCollapsed(project)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: app.isCollapsed(project) ? "chevron.right" : "chevron.down")
                        .font(.caption2)
                    Text(project.name)
                        .lineLimit(1)
                    Text("\(project.sessions.count)")
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)

            Spacer()

            // A path the desktop never reported cannot be used as a cwd.
            if !project.path.isEmpty {
                Button(action: onNewSession) {
                    Image(systemName: "plus.circle")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("New session in \(project.name)")
            }
        }
        .textCase(nil)
        .font(.subheadline.weight(.semibold))
    }
}

private struct SessionRow: View {
    let session: AgentSession

    var body: some View {
        HStack(spacing: 6) {
            Text(session.title)
                .font(.body)
                .lineLimit(1)

            Spacer()

            if let updatedAt = session.updatedAt {
                Text(Self.compactRelative(from: updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private static func compactRelative(from date: Date) -> String {
        let seconds = max(0, Int(Date().timeIntervalSince(date)))
        let years = seconds / 31_536_000
        let months = (seconds % 31_536_000) / 2_592_000
        let days = (seconds % 2_592_000) / 86400
        let hours = (seconds % 86400) / 3600
        let minutes = (seconds % 3600) / 60

        if years > 0 {
            return "\(years)y\(months)mo"
        } else if months > 0 {
            return "\(months)mo\(days)d"
        } else if days > 0 {
            return "\(days)d\(hours)h"
        } else if hours > 0 {
            return "\(hours)h\(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m"
        } else {
            return "\(seconds)s"
        }
    }
}
