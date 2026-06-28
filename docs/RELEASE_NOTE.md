## What's New in v0.37.0

### 🚀 New Features
* **Language Auto-Detection:** Added an auto-detect locale option to the language settings.
* **MCP Tool Integration:** Implemented the `McpToolCallItem` component and integrated it into the EventItem renderer.
* **Action Streaming:** Tracked command group completion status to support streaming visibility for active actions.

### 🎨 Improvements & Refactoring
* **Privacy & Settings:** Implemented `PrivacySettings` to replace `QuoteSettings`, and fully internationalized the settings menu, sidebar, and composer components.
* **UI & Experience:** Upgraded `AccessModePopover` to a sleek `DropdownMenu` and added a `useWindowFocus` hook to improve focus handling and UI responsiveness.
* **Codebase Optimization:** Reorganized Codex components, migrated thread management to Tauri commands, and streamlined platform detection logic.

### 🐛 Bug Fixes
* **Environment Variables:** Fixed incorrect error returns and suppressed unused variable warnings for unsupported platforms in `set_var`.

### 📦 Maintenance
* Dependency updates and centralized workspace management.