import Foundation
import Observation

/// Paired desktops and the currently selected one.
///
/// A phone is expected to drive several machines (laptop, desktop, work box),
/// so the selected desktop — not a global base URL — is what every request is
/// built from.
@MainActor
@Observable
public final class AppModel {
    public private(set) var desktops: [Desktop] = []
    public var selectedDesktopID: Desktop.ID?
    public private(set) var sessions: [AgentSession] = []
    public private(set) var isLoading = false
    public private(set) var errorMessage: String?
    public private(set) var isReachable: Bool?

    /// Which backend the session list is browsing. The two agents keep separate
    /// stores on the desktop, so this is a switch between lists rather than a
    /// filter over one.
    public private(set) var selectedAgent: AgentKind = .codex
    /// Project paths the user has folded away, kept across launches so a machine
    /// with many checkouts does not re-expand every time.
    public private(set) var collapsedProjects: Set<String> = []

    /// Session settings per agent, used for new sessions and reapplied on resume.
    public private(set) var options: [AgentKind: AgentOptions] = [:]
    /// Models the desktop offers, per agent. Empty until loaded.
    public private(set) var models: [AgentKind: [AgentModel]] = [:]

    private let storageKey = "codexia.desktops"
    private let selectionKey = "codexia.selectedDesktop"
    private let agentKey = "codexia.selectedAgent"
    private let collapsedKey = "codexia.collapsedProjects"
    private let optionsKey = "codexia.agentOptions"
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    public var selectedDesktop: Desktop? {
        desktops.first { $0.id == selectedDesktopID }
    }

    // MARK: - Projects

    /// Sessions grouped by working directory, most recently touched first.
    ///
    /// A desktop drives several checkouts at once, so a flat list buries the
    /// thread the user wants under unrelated projects.
    public var projects: [SessionProject] {
        let grouped = Dictionary(grouping: sessions) { $0.cwd ?? "" }
        return grouped
            .map { path, sessions in
                SessionProject(
                    path: path,
                    sessions: sessions.sorted { ($0.updatedAt ?? .distantPast) > ($1.updatedAt ?? .distantPast) }
                )
            }
            .sorted { ($0.lastActivity ?? .distantPast) > ($1.lastActivity ?? .distantPast) }
    }

    public func isCollapsed(_ project: SessionProject) -> Bool {
        collapsedProjects.contains(project.path)
    }

    public func toggleCollapsed(_ project: SessionProject) {
        if collapsedProjects.contains(project.path) {
            collapsedProjects.remove(project.path)
        } else {
            collapsedProjects.insert(project.path)
        }
        persist()
    }

    // MARK: - Pairing

    public func add(_ desktop: Desktop) {
        desktops.append(desktop)
        if selectedDesktopID == nil {
            selectedDesktopID = desktop.id
        }
        persist()
    }

    public func remove(at offsets: IndexSet) {
        let removed = offsets.map { desktops[$0].id }
        desktops.remove(atOffsets: offsets)
        if let selected = selectedDesktopID, removed.contains(selected) {
            selectedDesktopID = desktops.first?.id
            // Sessions belong to the desktop that is going away.
            sessions = []
        }
        persist()
    }

    public func select(_ desktop: Desktop) {
        guard desktop.id != selectedDesktopID else { return }
        selectedDesktopID = desktop.id
        // Clear state from the previous machine so its threads cannot leak into
        // the new one's list.
        sessions = []
        errorMessage = nil
        isReachable = nil
        // The model catalog belongs to the machine that served it.
        models = [:]
        persist()
    }

    // MARK: - Options

    public func options(for agent: AgentKind) -> AgentOptions {
        // Stored options carry their own agent, so a payload decoded from an
        // older build that disagrees is replaced rather than trusted.
        guard let stored = options[agent], stored.agent == agent else {
            return AgentOptions(agent: agent)
        }
        return stored
    }

    public var selectedOptions: AgentOptions {
        options(for: selectedAgent)
    }

    public func update(_ newOptions: AgentOptions, for agent: AgentKind) {
        options[agent] = newOptions
        persist()
    }

    public func availableModels(for agent: AgentKind) -> [AgentModel] {
        models[agent] ?? []
    }

    /// Loads the model catalog for `agent` once per desktop connection.
    ///
    /// Failure is silent: a missing catalog only means the model menu falls back
    /// to whatever the desktop defaults to, which is not worth an error banner.
    public func loadModels(for agent: AgentKind) async {
        guard models[agent] == nil, let desktop = selectedDesktop else { return }
        models[agent] = (try? await APIClient(desktop: desktop).listModels(agent: agent)) ?? []
    }

    // MARK: - Agents

    public func select(_ agent: AgentKind) async {
        guard agent != selectedAgent else { return }
        selectedAgent = agent
        // The lists come from different stores; showing the old one while the
        // new one loads would misattribute every row.
        sessions = []
        errorMessage = nil
        persist()
        await refreshSessions()
    }

    // MARK: - Sessions

    /// Starts a new session in `cwd` and returns it, so the caller can push it
    /// straight onto the navigation stack.
    public func createSession(cwd: String) async -> AgentSession? {
        guard let desktop = selectedDesktop else { return nil }
        do {
            let session = try await APIClient(desktop: desktop)
                .createSession(agent: selectedAgent, cwd: cwd, options: selectedOptions)
            sessions.insert(session, at: 0)
            errorMessage = nil
            return session
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    public func refreshSessions() async {
        guard let desktop = selectedDesktop else {
            sessions = []
            return
        }

        isLoading = true
        defer { isLoading = false }

        let client = APIClient(desktop: desktop)

        // Ask for the list directly rather than probing `/health` first. The
        // probe doubled the round trips on every refresh to buy an error message
        // that is only needed when something actually fails — so it is now paid
        // for on the failure path instead.
        do {
            sessions = try await client.listSessions(agent: selectedAgent)
            isReachable = true
            errorMessage = nil
        } catch {
            if let failure = await client.reachabilityFailure() {
                isReachable = false
                errorMessage = "Cannot reach \(desktop.host) — \(failure). Is the desktop awake and on the tailnet?"
            } else {
                isReachable = true
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Verifies a desktop, saves it, and adopts the session list the check
    /// already fetched.
    ///
    /// Pairing used to cost four round trips — a health probe and a list to
    /// verify, then both again to populate — which is what made the sheet sit on
    /// "Checking…". This is one, or two when it fails.
    /// Returns an error to show in the pairing sheet, or `nil` on success.
    public func pair(_ desktop: Desktop) async -> String? {
        let client = APIClient(desktop: desktop)
        do {
            let fetched = try await client.listSessions(agent: selectedAgent)
            add(desktop)
            // `add` only selects the first desktop paired; adopt the fetched list
            // just for the one now being shown.
            if selectedDesktopID == desktop.id {
                sessions = fetched
                isReachable = true
                errorMessage = nil
            }
            return nil
        } catch APIError.unauthorized {
            return "The desktop rejected this token."
        } catch {
            if let failure = await client.reachabilityFailure() {
                return "Could not reach \(desktop.host):\(desktop.port) — \(failure)"
            }
            return error.localizedDescription
        }
    }

    // MARK: - Persistence

    private func persist() {
        if let data = try? JSONEncoder().encode(desktops) {
            defaults.set(data, forKey: storageKey)
        }
        defaults.set(selectedDesktopID?.uuidString, forKey: selectionKey)
        defaults.set(selectedAgent.rawValue, forKey: agentKey)
        defaults.set(Array(collapsedProjects), forKey: collapsedKey)
        // Keyed by raw value: AgentKind is not a String in JSON dictionaries.
        let encodable = Dictionary(uniqueKeysWithValues: options.map { ($0.key.rawValue, $0.value) })
        if let data = try? JSONEncoder().encode(encodable) {
            defaults.set(data, forKey: optionsKey)
        }
    }

    private func load() {
        if let data = defaults.data(forKey: storageKey),
           let stored = try? JSONDecoder().decode([Desktop].self, from: data) {
            desktops = stored
        }
        if let raw = defaults.string(forKey: selectionKey), let id = UUID(uuidString: raw) {
            selectedDesktopID = id
        } else {
            selectedDesktopID = desktops.first?.id
        }
        if let raw = defaults.string(forKey: agentKey), let agent = AgentKind(rawValue: raw) {
            selectedAgent = agent
        }
        collapsedProjects = Set(defaults.stringArray(forKey: collapsedKey) ?? [])
        if let data = defaults.data(forKey: optionsKey),
           let stored = try? JSONDecoder().decode([String: AgentOptions].self, from: data) {
            options = Dictionary(uniqueKeysWithValues: stored.compactMap { key, value in
                AgentKind(rawValue: key).map { ($0, value) }
            })
        }
    }
}
