## 🎉 What's New

### 🔌 Agent Client Protocol Support
Codexia now speaks ACP! Connect external agents over the Agent Client Protocol, with sessions persisted across restarts and live tool call updates rendered right in the thread.

### 📱 iOS Remote Control
Drive Codexia from your phone. A new iOS app connects to the desktop through an authenticated web server, and remote clients now share the same ACP state as the desktop.

### ⚙️ Model & Settings Improvements
- Grok approval toggle added.
- Model and reasoning effort settings consolidated into one place.

### 🔄 Git Diff Panel Cleanup
Git diff panel state moved into a dedicated `useGitDiffStore` for smoother, more predictable diff interactions.

### 🐛 Fixes & Polish
- Keyboard focus styles restored on Select components.
- React types pinned to a single copy, fixing type mismatches.
- Codebase formatted with biome, with husky + lint-staged keeping commits clean.
