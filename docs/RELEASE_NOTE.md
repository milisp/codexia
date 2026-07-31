## 🎉 What's New

### 🗂 Multi-Tabbed Right Panel
We’ve revamped the right panel! You can now open, select, and close multiple tabs dynamically, making multitasking within your workspace much smoother.
### 🔄 Enhanced File Changes & Git Revert Controls
- Compact Change Summaries: Inline diffs have been replaced with a cleaner ThreadFileChangesSummary.
- Hover Previews & Bulk Actions: Hover over file changes for a quick preview, and toggle expand/collapse across all files with new bulk controls.
- Undo & Revert: Revert file changes directly from the summary view—either per-file or in bulk.

### ⚡ Architecture & State Cleanups
- Decoupled Stores: useWorkspaceStore has been refactored and split into three modular stores (workspace, editor, and agent-settings) for improved maintainability and state performance.
- Protocol Update: Upgraded codex-app-server-protocol to 0.146.0 to bring in support for experimental bindings.