## 🎉 What's New

### 🎚️ Effort Levels for Claude Code
Claude Code now runs at the effort you choose — low, medium, high, xhigh or max. The model selector became a popover with a dedicated effort slider, shared between the codex and Claude Code selectors, and the `fable` model joined the list.

### 🔐 New Permission Modes
Three modes to match how much you want to be asked: `auto`, `dontAsk` and `manual`, each with matching hook behavior.

### 🔧 Claude Env Variables
Settings > Claude now edits the `env` block of `~/.claude/settings.json` directly, with one click to add the gateway keys — base URL, auth token and the per-model overrides.

### 🤖 Automation Runner
Automations run on a configurable worktree. Runs orphaned by a crash are marked failed on startup, and quitting asks for confirmation while a workspace still has active work.

### 🎨 Theme Backgrounds
Set your own background image, or turn on the starfield effect.

### 🪟 Windows Portable Build
A portable archive is now published with every release, and the Scoop install path is documented in the README.

### ⚡ Model Selector Improvements
- Reasoning effort moved into its own selector.
- Model lists are fetched once and shared across selectors.
- Providers you don't use can be hidden.
- Provider env status is read in a single batch instead of once per key.

### 🐛 Fixes & Polish
- Sessions can no longer be created or resumed without a working directory.
- Dropped the `codex-protocol` dependency in favor of local types, and upgraded claude-agent-sdk-rs to v0.8.0.
