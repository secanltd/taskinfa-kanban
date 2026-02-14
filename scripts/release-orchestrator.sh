#!/usr/bin/env bash
set -euo pipefail

# Release Orchestrator — bump version, commit, tag, push.
#
# Usage:
#   ./scripts/release-orchestrator.sh          # patch bump (default)
#   ./scripts/release-orchestrator.sh minor    # minor bump
#   ./scripts/release-orchestrator.sh major    # major bump
#   ./scripts/release-orchestrator.sh patch    # patch bump (explicit)

BUMP_TYPE="${1:-patch}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_JSON="$REPO_ROOT/package.json"

# Validate bump type
if [[ "$BUMP_TYPE" != "major" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "patch" ]]; then
    echo "Error: invalid bump type '$BUMP_TYPE'. Use: major, minor, or patch"
    exit 1
fi

# Read current version from package.json
CURRENT_VERSION=$(node -e "console.log(require('$PKG_JSON').version)")
echo "Current version: $CURRENT_VERSION"

# Split into parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump
case "$BUMP_TYPE" in
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TAG="orchestrator/v$NEW_VERSION"

echo "New version:     $NEW_VERSION ($BUMP_TYPE bump)"
echo "Tag:             $TAG"
echo

# Check for uncommitted changes (besides what we're about to do)
if ! git diff --quiet HEAD 2>/dev/null; then
    echo "Error: you have uncommitted changes. Commit or stash them first."
    exit 1
fi

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: tag $TAG already exists"
    exit 1
fi

# Update package.json version
node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$PKG_JSON', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('$PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated package.json to $NEW_VERSION"

# Commit and tag
git add "$PKG_JSON"
git commit -m "chore: bump orchestrator version to $NEW_VERSION"
git tag "$TAG"

echo "Created commit and tag $TAG"

# Push
echo "Pushing to origin..."
git push origin HEAD
git push origin "$TAG"

echo
echo "Done! Release workflow will build and publish orchestrator v$NEW_VERSION"
echo "Track progress: https://github.com/secanltd/taskinfa-kanban/actions"
