import SwiftUI

@main
struct CodexiaApp: App {
    @State private var app = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(app)
        }
    }
}
