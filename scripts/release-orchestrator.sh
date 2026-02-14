#!/usr/bin/env bash
set -euo pipefail

# Release Orchestrator — bump version, commit, tag, push.
# Works with protected main branches by creating a PR for the version bump.
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

# Ensure we're on main and up to date
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "Error: must be on main branch (currently on $CURRENT_BRANCH)"
    exit 1
fi
git pull origin main --quiet

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
    echo "Error: you have uncommitted changes. Commit or stash them first."
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
BRANCH="chore/bump-orchestrator-v$NEW_VERSION"

echo "New version:     $NEW_VERSION ($BUMP_TYPE bump)"
echo "Tag:             $TAG"
echo

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: tag $TAG already exists"
    exit 1
fi

# Create branch, bump, commit
git checkout -b "$BRANCH"

node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$PKG_JSON', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('$PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated package.json to $NEW_VERSION"

git add "$PKG_JSON"
git commit -m "chore: bump orchestrator version to $NEW_VERSION"
git push -u origin "$BRANCH"

# Create PR and merge with admin privileges
echo "Creating PR..."
PR_URL=$(gh pr create \
    --title "chore: bump orchestrator version to $NEW_VERSION" \
    --body "Automated version bump for orchestrator release v$NEW_VERSION" \
    --base main)
echo "PR: $PR_URL"

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')

echo "Waiting for CI checks to pass..."
# Give GitHub a moment to register the checks
sleep 10
gh pr checks "$PR_NUMBER" --watch --fail-fast || {
    echo "Error: CI checks failed. Fix the issue and retry."
    echo "PR is still open: $PR_URL"
    git checkout main
    exit 1
}

echo "Merging PR..."
gh pr merge "$PR_NUMBER" --merge --admin --delete-branch

# Switch back to main and pull the merge
git checkout main
git pull origin main --quiet

# Tag the merged commit and push the tag
git tag "$TAG"
git push origin "$TAG"

echo
echo "Done! Release workflow will build and publish orchestrator v$NEW_VERSION"
echo "Track progress: https://github.com/secanltd/taskinfa-kanban/actions"
