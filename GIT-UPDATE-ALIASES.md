# Git Update Aliases

This repository includes a small helper to keep your fork in sync with the upstream project and two convenient Git aliases to run it.

Aliases are configured in your local repo (`.git/config`) and call the script at `scripts/update-from-upstream.sh`.

## Aliases

- `git update`: Rebase the current (or specified) branch on `upstream/<branch>` and push to `origin`.
- `git update-nopush`: Same as above but does not push. Useful to review before publishing.

Both aliases accept the script's flags and pass them through.

## Default Behavior

- Remote `upstream`: `git@github.com:milisp/codexia.git`
- Remote `origin`: your fork (e.g., `git@github.com:<you>/codexia.git`)
- Branch: current branch (falls back to `main`)
- Strategy: `rebase` with `rebase.autoStash=true`

## Common Usage

- Update current branch and push: `git update`
- Update a specific branch and push: `git update -b main`
- Update without pushing: `git update-nopush`
- Use merge (fast-forward only) instead of rebase: `git update --merge`
- Include tags during fetch/push: `git update --tags`
- Dry run (show commands only): `git update --dry-run`

## All Options (passed to the script)

- `-b, --branch <name>`: Branch to update (default: current or `main`).
- `-u, --upstream <name>`: Upstream remote (default: `upstream`).
- `-o, --origin <name>`: Origin remote (default: `origin`).
- `--rebase` / `--merge`: Rebase (default) or fast-forward merge strategy.
- `--autostash` / `--no-autostash`: Toggle rebase autostash (default: on).
- `--push`: Push updated branch (on for `git update`, off for `git update-nopush`).
- `--tags`: Include tags when fetching/pushing.
- `--dry-run`: Print intended commands without executing.

## Requirements

- Remotes set:
  - `upstream` points to the original repo.
  - `origin` points to your fork.
- The helper script is present and executable: `scripts/update-from-upstream.sh`.
- Clean working tree is required for `--merge`; `--rebase` supports autostash.

## Install Aliases (if needed)

If the aliases are missing (e.g., on a fresh clone), run these from the repo root:

```
git config --local alias.update '!f() { bash "$(git rev-parse --show-toplevel)/scripts/update-from-upstream.sh" --push "$@"; }; f'
git config --local alias.update-nopush '!f() { bash "$(git rev-parse --show-toplevel)/scripts/update-from-upstream.sh" "$@"; }; f'
```

## Troubleshooting

- "upstream remote not found": Add it, e.g., `git remote add upstream git@github.com:milisp/codexia.git`.
- "branch '<name>' not found on upstream": Ensure the branch exists upstream or specify one that does (e.g., `main`).
- Merge refused with uncommitted changes: Commit or stash, or use `--rebase` with autostash.

