## 🎉 What's New

### 📱 The iOS App, Rebuilt
The hand-written SwiftUI client is gone. Codexia on iOS is now a Tauri target running the same React frontend as the desktop app, with a mobile shell for browsing projects, a new pairing view and proper keyboard handling.

### 🔗 Multiple Paired Desktops
Pair several machines and switch between them from a drawer, or unpair one you no longer use. Switching or unpairing the active desktop reloads the view, so threads from the previous machine never leak into the new one's lists.

### 🧵 Multiple ACP Sessions per Agent
One agent process can now host several sessions at once. Resuming a session from another project reuses the running process instead of starting a new one.

### 🐛 Fixes & Polish
- The first file opened after showing the right panel no longer stays blank.
- Focus mode keeps the right panel mounted, so the terminal and other long-lived views survive the toggle.
- Removed the Codex account panel from the thread view.
