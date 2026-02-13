---
name: taskinfa-gh-pr-reviewer
description: Review a GitHub PR with summary and inline comments. Posts a review with actionable feedback on bugs, logic errors, security issues, and style.
disable-model-invocation: true
user-invocable: true
argument-hint: "[owner/repo] [pr-number]"
allowed-tools: Bash, Read, Grep, Glob
---

# GitHub PR Reviewer

Review the pull request specified by `$ARGUMENTS`. The first argument is `owner/repo`, the second is the PR number.

## Step 1: Fetch PR metadata and diff

```bash
# Get PR metadata
gh pr view $1 --repo $0 --json title,body,author,baseRefName,headRefName,files,additions,deletions,changedFiles

# Get the full diff
gh pr diff $1 --repo $0

# Get list of changed files
gh pr diff $1 --repo $0 --name-only
```

## Step 2: Fetch changed file contents for line-accurate comments

For each changed file, fetch the full file content from the PR's head branch so you can determine exact line numbers:

```bash
# Get the head branch ref
gh pr view $1 --repo $0 --json headRefName --jq '.headRefName'

# For each changed file, fetch its content from the PR branch
gh api repos/$0/contents/{path}?ref={head_branch} --jq '.content' | base64 -d
```

## Step 3: Analyze the diff

Review every changed file for:

1. **Bugs and logic errors** — incorrect conditions, off-by-one, null/undefined access, race conditions
2. **Behavioral regressions** — changes that break existing behavior or API contracts
3. **Missing error handling** — unhandled promise rejections, missing try/catch, unchecked return values
4. **CSS/layout issues** — broken layouts, missing responsive styles, z-index conflicts, accessibility
5. **Inconsistencies** — naming conventions, patterns that differ from the rest of the codebase
6. **Security concerns** — XSS, injection, exposed secrets, insecure defaults
7. **Dead code** — unused imports, unreachable branches, commented-out code left behind
8. **Performance** — unnecessary re-renders, N+1 queries, missing memoization on hot paths

## Step 4: Classify findings

For each finding, classify it as:

- **Blocking** — Must fix before merge. Bugs, security issues, data loss risks, broken functionality.
- **Nit** — Optional improvement. Style, naming, minor refactors, documentation suggestions.

## Step 5: Post the review

### 5a: Prepare inline comments

Build a JSON array of inline comments. Each comment targets a specific line in a specific file:

```json
{
  "body": "## PR Review Summary\n\n...",
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/components/Foo.tsx",
      "line": 42,
      "side": "RIGHT",
      "body": "**Bug:** This will throw if `items` is undefined.\n\n```suggestion\nconst count = items?.length ?? 0;\n```"
    }
  ]
}
```

Rules for inline comments:
- `line` is the line number in the **new version** of the file (RIGHT side of the diff)
- The line MUST be within a changed hunk (added or modified lines shown with `+` in the diff)
- Use `side: "RIGHT"` always (we comment on the new code)
- When a concrete fix is possible, use a GitHub suggestion block:
  ````
  ```suggestion
  corrected code here
  ```
  ````
- Prefix the comment body with `**Bug:**`, `**Security:**`, `**Nit:**`, etc.
- Keep each comment focused on one issue

### 5b: Post the review with inline comments

Use the GitHub API to post the review with all inline comments in a single request:

```bash
# Create a temporary JSON file for the review
cat > /tmp/pr-review.json << 'REVIEW_EOF'
{
  "body": "## PR Review Summary\n\n...",
  "event": "COMMENT",
  "comments": [...]
}
REVIEW_EOF

gh api repos/$0/pulls/$1/reviews \
  --method POST \
  --input /tmp/pr-review.json

rm -f /tmp/pr-review.json
```

### 5c: Review summary format

The `body` field of the review should follow this structure:

```markdown
## PR Review Summary

**Verdict:** [APPROVE | REQUEST CHANGES | COMMENT]

### Overview
[1-2 sentence summary of what the PR does]

### Blocking Issues
- [ ] **Bug** (`path/file.ts:42`): Description of the issue
- [ ] **Security** (`path/file.ts:15`): Description of the issue

### Nits & Suggestions
- **Nit** (`path/file.ts:88`): Description of the suggestion

### What looks good
- [Positive feedback on well-written parts]
```

## Step 6: Determine verdict

- **APPROVE** — No blocking issues found. Nits only.
- **REQUEST CHANGES** — One or more blocking issues found.
- **COMMENT** — Unsure about severity, or only informational observations.

Set the `event` field in the review JSON accordingly:
- `"APPROVE"` for approve
- `"REQUEST_CHANGES"` for request changes
- `"COMMENT"` for comment-only

## Important Notes

- Do NOT approve PRs that have blocking issues
- Always explain WHY something is a problem, not just WHAT
- Be specific — reference exact line numbers and variable names
- Be constructive — suggest fixes, don't just criticize
- If the PR is clean, say so! A short "LGTM" review with approval is fine
- Clean up temp files after posting (`rm -f /tmp/pr-review.json`)
