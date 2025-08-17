# Agents Operating Guide

Purpose: Consistent, tool-driven workflow for memory, documentation lookup, and code indexing while working in this repository.

## Core Principles
- Be context-aware: retrieve past context before starting or switching tasks.
- Prefer current docs: fetch up-to-date references before technical work.
- Index first: ensure the project is indexed and use structured code tools.
- Leave breadcrumbs: persist important findings and decisions into memory.

## Memory (OpenMemory) Usage
- Search before work: Call `openmemory__search_memory` with a short query that summarizes the new task or the switch in focus. Use any relevant results to set context and constraints.
- During work: When you learn preferences, constraints, decisions, or notable findings, call `openmemory__add_memories` to capture them. Examples:
  - Project progress updates (what changed, where, why)
  - Important paths, commands, configs, and environment details
  - User preferences (formatting, runtimes, frameworks)
  - Known issues, TODOs, blocked items
- After work: Add a brief wrap-up memory summarizing outcomes, current status, and suggested next steps. Include changed files and any follow-up actions.
- Updating memory: If something supersedes a prior note, add a new memory entry that clearly states it “supersedes” the earlier one (there is no dedicated update API; add a new entry noting the replacement).
- Listing memories: Use `openmemory__list_memories` sparingly (only when you need a full picture). Avoid dumping large memory sets mid-task unless necessary.

Recommended memory formats (examples; choose fields supported by the API):
- Title + body style in `memory` or `content`: "[decision] Switch to ripgrep for search – faster on large trees."
- Tagging in-line: "project:code-index | status:initialized | path:/home/drj/projects/code-index"

## Documentation (Context7) Usage
Always consult up-to-date docs before any technical or coding task.
- Resolve library: Call `Context7__resolve-library-id` with the library/package name. If ambiguous, ask the user to clarify or proceed with the most relevant match and note the assumption.
- Fetch docs: Call `Context7__get-library-docs` with the resolved ID. Provide a focused `topic` where possible (e.g., "routing", "hooks", "CLI flags"). Keep `tokens` moderate to reduce noise.
- Apply: Use the retrieved docs to ground design and implementation choices; cite function/option names in rationale, not raw URLs.

## Code Index Usage
Use the Code Index MCP tools for code-aware actions.
- Initialization:
  - If not set, call `code_index__set_project_path` with the absolute project path.
  - Verify via `code_index__get_settings_info` and ensure the index exists.
- Discovery and analysis:
  - `code_index__find_files`: glob-based file discovery (e.g., `src/**/*.tsx`).
  - `code_index__search_code_advanced`: fast pattern/regex/fuzzy search across the project; scope with `file_pattern` when helpful.
  - `code_index__get_file_summary`: quick structure snapshot (functions, imports, complexity).
- Maintenance:
  - `code_index__get_file_watcher_status`: confirm auto-refresh is active.
  - `code_index__configure_file_watcher`: tune debounce/exclusions when needed.
  - `code_index__refresh_index`: rebuild after large changes or when results seem stale.

## Task Flow Checklist
1) Before starting/switching tasks
- Search memory for relevant context: `openmemory__search_memory`.
- Ensure project path is set and indexed: `code_index__set_project_path` (once), then `code_index__get_settings_info`.
- Identify libraries to reference and fetch docs: `Context7__resolve-library-id` → `Context7__get-library-docs`.

2) During execution
- Use Code Index tools for file discovery, search, and summaries.
- Persist key decisions, constraints, and findings: `openmemory__add_memories`.

3) After completion
- Summarize outcomes and next steps in memory: `openmemory__add_memories`.
- If indexing may be stale, run `code_index__refresh_index` and note file counts.

## Safety and Limits
- Prefer minimal, focused doc retrieval to avoid overload; refine `topic` when calling Context7.
- Do not overwrite past memory; append new entries noting superseded info.
- Avoid listing all memories unless you truly need the full set.
- Validate paths and existence before indexing; use absolute paths for `set_project_path`.

---
This guide is operational. Follow it by default for all technical work in this repo.
