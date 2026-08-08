import SwiftUI

/// Adds a desktop by its tailnet hostname and device token.
///
/// Both values come from the desktop's Settings → Remote Access screen. There
/// is deliberately no discovery step: MagicDNS names are stable, so this is a
/// one-time entry rather than something the user repeats.
public struct PairingView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var host = ""
    @State private var port = "7420"
    @State private var token = ""
    @State private var isVerifying = false
    @State private var verificationError: String?

    public init() {}

    private var canSave: Bool {
        !host.trimmingCharacters(in: .whitespaces).isEmpty
            && !token.trimmingCharacters(in: .whitespaces).isEmpty
            && !isVerifying
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                    TextField("Hostname", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                } header: {
                    Text("Desktop")
                } footer: {
                    Text("Use the Tailscale name shown on the desktop, e.g. codexia-mac.tail1234.ts.net")
                }

                Section {
                    SecureField("Token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Device token")
                } footer: {
                    Text("The token grants full access to that machine. Treat it like an SSH key.")
                }

                if let verificationError {
                    Section {
                        Label(verificationError, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Pair desktop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isVerifying ? "Checking…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    /// ATS exceptions can name a domain but not an address range, so the
    /// tailnet's 100.64.0.0/10 addresses cannot be reached over plain HTTP.
    private func isTailnetIP(_ host: String) -> Bool {
        let parts = host.split(separator: ".")
        guard parts.count == 4, let first = Int(parts[0]), let second = Int(parts[1]) else {
            return false
        }
        return first == 100 && (64...127).contains(second)
    }

    private func save() async {
        let trimmedHost = host.trimmingCharacters(in: .whitespaces)

        guard !isTailnetIP(trimmedHost) else {
            verificationError = "Use the Tailscale hostname ending in .ts.net instead of the tailnet IP; iOS blocks plain HTTP to raw addresses."
            return
        }

        let desktop = Desktop(
            name: name.isEmpty ? trimmedHost : name,
            host: trimmedHost,
            port: Int(port) ?? 7420,
            token: token.trimmingCharacters(in: .whitespaces)
        )

        isVerifying = true
        defer { isVerifying = false }

        // Verify before saving: a typo'd hostname otherwise shows up much later
        // as an unexplained empty session list.
        if let failure = await app.pair(desktop) {
            verificationError = failure
            return
        }

        dismiss()
    }
}
