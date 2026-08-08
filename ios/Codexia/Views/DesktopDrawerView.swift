import SwiftUI

/// Manages paired desktops: switch between them, remove one, or pair another.
///
/// A drawer rather than the old toolbar menu — a menu row cannot carry a delete
/// affordance, and removing a pairing is the one thing the menu could not do.
struct DesktopDrawerView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    let onPair: () -> Void

    @State private var pendingDeletion: Desktop?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(app.desktops) { desktop in
                        Button {
                            app.select(desktop)
                            Task { await app.refreshSessions() }
                            dismiss()
                        } label: {
                            DesktopRow(desktop: desktop, isSelected: desktop.id == app.selectedDesktopID)
                        }
                        .buttonStyle(.plain)
                        .swipeActions {
                            Button(role: .destructive) {
                                pendingDeletion = desktop
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                    }
                } footer: {
                    Text("Swipe a desktop to remove its pairing. The device token stays valid until you revoke it on that machine.")
                }

                Section {
                    Button {
                        dismiss()
                        onPair()
                    } label: {
                        Label("Pair a desktop", systemImage: "plus")
                    }
                }
            }
            .navigationTitle("Desktops")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Remove \(pendingDeletion?.name ?? "")?",
                isPresented: Binding(
                    get: { pendingDeletion != nil },
                    set: { if !$0 { pendingDeletion = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Remove", role: .destructive) {
                    guard let desktop = pendingDeletion,
                          let index = app.desktops.firstIndex(of: desktop) else { return }
                    app.remove(at: IndexSet(integer: index))
                    pendingDeletion = nil
                    Task { await app.refreshSessions() }
                }
                Button("Cancel", role: .cancel) { pendingDeletion = nil }
            } message: {
                Text("You will need the hostname and token again to pair it back.")
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct DesktopRow: View {
    let desktop: Desktop
    let isSelected: Bool

    var body: some View {
        HStack {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "desktopcomputer")
                .foregroundStyle(isSelected ? Color.accentColor : .secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(desktop.name)
                Text("\(desktop.host):\(desktop.port)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }
}
