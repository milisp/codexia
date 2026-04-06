#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN is not set"
  exit 1
fi

# Fetch the latest release information
curl -f -L \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/milisp/codexia/releases/latest" > release.json

if [ ! -f "release.json" ]; then
  echo "Error: release.json not found. Please ensure it exists."
  exit 1
fi

# Extract version and remove leading "v" (e.g. v1.2.3 -> 1.2.3)
VERSION=$(jq -r '.tag_name' release.json | sed 's/^v//')

# Extract SHAs from release.json
# The digest field format is "sha256:..." so we cut the prefix
ARM_SHA=$(jq -r '.assets[] | select(.name | contains("aarch64") and endswith(".dmg")) | .digest' release.json | cut -d: -f2)
INTEL_SHA=$(jq -r '.assets[] | select(.name | contains("x86_64") and endswith(".dmg")) | .digest' release.json | cut -d: -f2)

if [ -z "$ARM_SHA" ] || [ -z "$INTEL_SHA" ]; then
  echo "Error: Could not extract SHAs from release.json"
  echo "ARM SHA: $ARM_SHA"
  echo "Intel SHA: $INTEL_SHA"
  exit 1
fi

echo "Updating to version $VERSION"
echo "ARM SHA256: $ARM_SHA"
echo "Intel SHA256: $INTEL_SHA"

# Clone the Homebrew tap repository
git clone https://x-access-token:${GITHUB_TOKEN}@github.com/milisp/homebrew-codexia.git
cd homebrew-codexia

# Determine the file to update
TARGET_FILE="Casks/codexia.rb"

if [ ! -f "$TARGET_FILE" ]; then
  echo "Error: $TARGET_FILE not found in homebrew-codexia repo"
  exit 1
fi

# Update version and SHA256 values
# Note: Using Linux-compatible sed syntax (without empty string after -i)
sed -i "s/version \".*\"/version \"${VERSION}\"/" "$TARGET_FILE"
sed -i "/on_arm do/,/end/ s/sha256 \".*\"/sha256 \"${ARM_SHA}\"/" "$TARGET_FILE"
sed -i "/on_intel do/,/end/ s/sha256 \".*\"/sha256 \"${INTEL_SHA}\"/" "$TARGET_FILE"

# Commit and push changes
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add "$TARGET_FILE"
git commit -m "chore(cask): bump codexia to ${VERSION}"
git push

echo "Successfully updated Homebrew tap to ${VERSION}"
