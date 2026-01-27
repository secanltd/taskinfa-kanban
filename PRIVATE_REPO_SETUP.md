# Private Repository Setup Guide

## Overview

This guide explains how to use private GitHub repositories with Taskinfa workers. The system supports both HTTPS and SSH repository URLs and uses GitHub Personal Access Tokens for authentication.

## How It Works

### The Problem
- Docker containers don't have access to your local SSH keys
- Private repos require authentication to clone
- Your custom SSH config (like `git@github-secanltd:secanltd/repo`) won't work in containers

### The Solution
- Workers use **GitHub Personal Access Tokens** for authentication
- SSH URLs are automatically converted to HTTPS format
- Git credentials are pre-configured in the worker container
- Works seamlessly for both public and private repos

## Setup Instructions

### Step 1: Create a GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "Taskinfa Worker")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Set expiration (recommend: No expiration or 1 year)
6. Click **"Generate token"**
7. **Copy the token immediately** (shown only once!)

Example token format: `ghp_1234567890abcdefghijklmnopqrstuvwxyz`

### Step 2: Create Your Project in Taskinfa Dashboard

1. Go to: https://taskinfa-kanban.secan-ltd.workers.dev/projects
2. Click **"Create Project"**
3. Fill in the form:
   - **Project Name**: `master-baker-company-website`
   - **Description**: `Company website for Master Baker`
   - **Git Repository URL**: You can use either format:
     - SSH: `git@github.com:secanltd/master-baker-company-website.git` ✅
     - HTTPS: `https://github.com/secanltd/master-baker-company-website.git` ✅
   - **Working Directory**: `/workspace` (default)
4. Click **"Create"**
5. **Copy your Project ID** (e.g., `master-baker-company-website`)

### Step 3: Set Up Worker with Installer

Run the one-click installer:

```bash
curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-bot/main/scripts/install.sh | bash
```

The installer will guide you through:

1. **Prerequisites Check**
   - Verifies Claude Code CLI (installs if needed)
   - Verifies Docker (guides installation)
   - Authenticates with Claude

2. **Taskinfa Setup**
   - Create account at https://taskinfa-kanban.secan-ltd.workers.dev
   - Create project (already done in Step 2)
   - Generate API key

3. **Worker Configuration**
   - Enter API key
   - Enter Project ID: `master-baker-company-website`
   - Enter Worker Name: `Master-Baker-Worker-1`
   - Enter Workspace ID: `default`
   - **Enter GitHub Token**: Paste the token from Step 1

Example:
```
Enter your Taskinfa API key: taskinfa_abc123...
Enter your Project ID: master-baker-company-website
Enter worker name [Worker-1]: Master-Baker-Worker-1
Enter workspace ID [default]: default
Enter GitHub Personal Access Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

### Step 4: Verify Configuration

After installation completes, check your worker directory:

```bash
cd ~/.taskinfa/workers/master-baker-company-website
cat .env
```

You should see:
```bash
WORKSPACE_ID=default
TASK_LIST_ID=master-baker-company-website
WORKER_NAME=Master-Baker-Worker-1
POLL_INTERVAL=30
TASKINFA_API_KEY=taskinfa_abc123...
TASKINFA_API_URL=https://taskinfa-kanban.secan-ltd.workers.dev/api
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz
```

### Step 5: Start the Worker

```bash
cd ~/.taskinfa/workers/master-baker-company-website
./start.sh
```

The worker will:
1. Configure Git credentials using your token
2. Show: `GitHub Auth: ✅ Configured`
3. Start monitoring for tasks

### Step 6: Create Your First Task

1. Go to: https://taskinfa-kanban.secan-ltd.workers.dev/dashboard
2. Click **"Create Task"**
3. Fill in:
   - **Project**: `master-baker-company-website`
   - **Title**: `Create PRD.md`
   - **Description**:
     ```
     Create a comprehensive Product Requirements Document (PRD.md) for the Master Baker company website.

     Include:
     - Company overview
     - Target audience
     - Key features
     - User stories
     - Technical requirements
     ```
   - **Priority**: High
4. Click **"Create Task"**

The worker will automatically:
1. Fetch the task from the API
2. Clone the private repository: `https://github.com/secanltd/master-baker-company-website.git`
3. Create the PRD.md file
4. Mark the task as "Review"
5. Add completion notes

## How URL Conversion Works

The worker automatically converts SSH URLs to HTTPS format:

**Before (SSH):**
```
git@github.com:secanltd/master-baker-company-website.git
```

**After (HTTPS):**
```
https://github.com/secanltd/master-baker-company-website.git
```

This happens transparently in the worker's skill instructions - you don't need to do anything.

## Git Credential Configuration

When the worker starts, if `GITHUB_TOKEN` is set, it automatically runs:

```bash
git config --global credential.helper store
echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials
```

This allows Git to authenticate with GitHub using your token for all operations.

## Troubleshooting

### "Authentication failed" when cloning

**Problem:** Git cannot authenticate with GitHub

**Solution:**
1. Verify your GitHub token is valid: https://github.com/settings/tokens
2. Check the token has `repo` scope
3. Verify the token is in `.env` file:
   ```bash
   cat ~/.taskinfa/workers/master-baker-company-website/.env | grep GITHUB_TOKEN
   ```

### "Repository not found"

**Problem:** GitHub says repository doesn't exist

**Solution:**
1. Verify you have access to the repo: https://github.com/secanltd/master-baker-company-website
2. Check the repo URL in the project settings
3. Ensure your token has access to the `secanltd` organization

### Worker shows "GitHub Auth: ⚠️ Not configured"

**Problem:** GitHub token is not set

**Solution:**
1. Re-run the installer and provide the token
2. Or manually edit `.env` and add:
   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   ```
3. Restart the worker: `./stop.sh && ./start.sh`

## Security Best Practices

### Protecting Your Token

1. **Never commit** `.env` files to Git (already in `.gitignore`)
2. **Use organization tokens** if available (instead of personal)
3. **Set expiration dates** on tokens (e.g., 90 days)
4. **Rotate tokens** periodically
5. **Revoke tokens** when no longer needed

### Token Scope

Only grant the minimum required scope:
- ✅ `repo` - For private repository access
- ❌ `admin:org` - Not needed
- ❌ `delete_repo` - Not needed

### Multiple Projects

If you have multiple projects with different GitHub organizations:
- Create separate tokens per organization
- Use different worker directories for each project
- Each project can have its own token in its `.env` file

## Example: Master Baker Project

**Repository:** https://github.com/secanltd/master-baker-company-website (private)

**Project Configuration:**
```
Name: master-baker-company-website
Description: Company website for Master Baker
Repository URL: git@github.com:secanltd/master-baker-company-website.git
Working Directory: /workspace
```

**Worker Location:**
```
~/.taskinfa/workers/master-baker-company-website/
├── .env                 # Contains GITHUB_TOKEN
├── worker.sh           # Main worker script
├── start.sh            # Start the worker
├── stop.sh             # Stop the worker
├── logs/               # Worker logs
└── workspace/          # Where repo will be cloned
    └── master-baker-company-website/  # Cloned repo
```

**First Task:**
- Title: "Create PRD.md"
- Description: Product Requirements Document
- Expected Output: `workspace/master-baker-company-website/PRD.md`

## Next Steps

After your first task completes:

1. **Review the work:**
   ```bash
   cd ~/.taskinfa/workers/master-baker-company-website/workspace/master-baker-company-website
   cat PRD.md
   ```

2. **Check worker logs:**
   ```bash
   tail -f ~/.taskinfa/workers/master-baker-company-website/logs/worker.log
   ```

3. **Create more tasks:**
   - Go to dashboard
   - Create tasks for features, bug fixes, etc.
   - Workers execute them automatically

4. **Scale up:**
   - Run multiple workers for faster execution
   - Each worker coordinates via `CLAUDE_CODE_TASK_LIST_ID`

---

**Questions?**
- Documentation: https://github.com/secanltd/taskinfa-bot
- Issues: https://github.com/secanltd/taskinfa-bot/issues
