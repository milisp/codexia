## What's new

### ✨ New Features
- Agent Card View Modes: You can now toggle between grid, list, and single view modes for agent cards, allowing for a more customizable layout.
- Manual Card Resizing: AgentView now supports manual card resizing for better control over your workspace.
- Unarchive Threads: A new command to unarchive threads has been added, complete with optimistic UI updates in the ArchivedThreadSettings to make the interaction feel instantly responsive.

### 🎨 UI & UX Improvements
- AgentView Refinements: The layout logic for the AgentView has been updated, including better visibility conditions for card bodies and improved reliability for scrolling to the bottom of views.
- Cleaned Up Legacy Interfaces: The outdated legacy history view and its associated components have been completely removed to streamline the interface.

### 🛠️ Under the Hood (Refactoring & Maintenance)
- Event Handling Modularization: Server-Sent Events (SSE) and Tauri listener logic have been extracted into dedicated hooks, making the event handling system cleaner and more modular.
- Directory Watching Hook: File and Git monitoring logic has been consolidated into a reusable useDirWatch hook.
- Codex Commands Organization: Codex commands have been split into separate files for significantly better code maintainability.

### 📝 Documentation
- Zustand Migration Guide: Added new documentation covering the requirements for Zustand persist store migrations.