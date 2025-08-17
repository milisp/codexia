#!/usr/bin/env bash
set -euo pipefail

# Easy updater for keeping a fork in sync with upstream
# Default behavior: rebase current branch onto upstream/<branch> and (optionally) push to origin

usage() {
  cat <<'EOF'
Usage: update-from-upstream.sh [options]

Options:
  -b, --branch <name>     Branch to update (default: current branch or 'main')
  -u, --upstream <name>   Upstream remote name (default: upstream)
  -o, --origin <name>     Origin remote name (default: origin)
      --rebase            Use rebase strategy (default)
      --merge             Use fast-forward merge strategy
      --autostash         Auto-stash for rebase (default)
      --no-autostash      Disable autostash
      --push              Push branch (and tags with --tags) to origin after update
      --tags              Include tags when fetching/pushing
      --dry-run           Print commands without executing
  -h, --help              Show this help

Examples:
  # Rebase current branch onto upstream and push to origin
  scripts/update-from-upstream.sh --push

  # Update a specific branch without pushing
  scripts/update-from-upstream.sh -b main
EOF
}

DRY_RUN=false
run() {
  echo "+ $*"
  if [ "$DRY_RUN" = false ]; then
    eval "$@"
  fi
}

# Defaults
BRANCH=""
UPSTREAM="upstream"
ORIGIN="origin"
METHOD="rebase"   # or merge
AUTOSTASH=true
DO_PUSH=false
WITH_TAGS=false

while [ $# -gt 0 ]; do
  case "$1" in
    -b|--branch) BRANCH=${2:?}; shift 2;;
    -u|--upstream) UPSTREAM=${2:?}; shift 2;;
    -o|--origin) ORIGIN=${2:?}; shift 2;;
    --rebase) METHOD="rebase"; shift;;
    --merge) METHOD="merge"; shift;;
    --autostash) AUTOSTASH=true; shift;;
    --no-autostash) AUTOSTASH=false; shift;;
    --push) DO_PUSH=true; shift;;
    --tags) WITH_TAGS=true; shift;;
    --dry-run) DRY_RUN=true; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown option: $1" >&2; usage; exit 1;;
  esac
done

# Ensure we are inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository" >&2
  exit 1
fi

# Determine branch
if [ -z "$BRANCH" ]; then
  BRANCH=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  if [ -z "$BRANCH" ]; then BRANCH="main"; fi
fi

# Validate remotes
if ! git remote get-url "$UPSTREAM" >/dev/null 2>&1; then
  echo "Error: upstream remote '$UPSTREAM' not found. Add it with: git remote add $UPSTREAM <url>" >&2
  exit 1
fi
if ! git remote get-url "$ORIGIN" >/dev/null 2>&1; then
  echo "Error: origin remote '$ORIGIN' not found. Add it with: git remote add $ORIGIN <url>" >&2
  exit 1
fi

# Fetch updates
FETCH_TAGS=""
if [ "$WITH_TAGS" = true ]; then FETCH_TAGS="--tags"; fi
run "git fetch $UPSTREAM --prune $FETCH_TAGS"
run "git fetch $ORIGIN --prune $FETCH_TAGS"

# Verify upstream branch exists
if ! git ls-remote --exit-code --heads "$UPSTREAM" "$BRANCH" >/dev/null 2>&1; then
  echo "Error: branch '$BRANCH' not found on upstream '$UPSTREAM'" >&2
  exit 1
fi

# Ensure on target branch
CURRENT=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
if [ "$CURRENT" != "$BRANCH" ]; then
  run "git checkout $BRANCH"
fi

# If merge method, require clean working tree
if [ "$METHOD" = "merge" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Error: working tree not clean. Commit or stash changes before merging." >&2
    exit 1
  fi
fi

# Update strategy
if [ "$METHOD" = "rebase" ]; then
  if [ "$AUTOSTASH" = true ]; then
    run "git -c rebase.autoStash=true rebase $UPSTREAM/$BRANCH"
  else
    run "git rebase $UPSTREAM/$BRANCH"
  fi
else
  run "git merge --ff-only $UPSTREAM/$BRANCH"
fi

# Ensure branch tracks origin/branch
if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  run "git branch --set-upstream-to=$ORIGIN/$BRANCH $BRANCH"
fi

# Push if requested
if [ "$DO_PUSH" = true ]; then
  PUSH_TAGS=""
  if [ "$WITH_TAGS" = true ]; then PUSH_TAGS="--tags"; fi
  run "git push $ORIGIN $BRANCH $PUSH_TAGS"
fi

echo "\nDone. $BRANCH is in sync with $UPSTREAM/$BRANCH";
if [ "$DO_PUSH" = true ]; then
  echo "Pushed to $ORIGIN/$BRANCH.";
else
  echo "Local branch updated. Use 'git push $ORIGIN $BRANCH' to publish.";
fi

