## What's New in v0.42.0

### 🧩 Plugin System & Marketplace
- Plugin Detail View: Added full detail view for plugins with install/uninstall functionality and marketplace integration.
- Marketplace UI: Integrated backend services for browsing, installing, and managing plugins directly in the UI.
- Layout Enhancements: Added a sidebar toggle to the plugins header and refined component spacing.

### 🎙️ AI & Voice Features
- On-Device Dictation: Implemented local voice dictation with dedicated model management and UI integration.
- OpenAI Integration: Added API key authentication support to CodexAuth and exposed status in the AgentView.

### 🛠️ Architecture & Maintenance
- Code Base Refactoring: Modularized PluginsView into feature-based components, added a dedicated hook-driven context, and updated imports to use the @/features alias.