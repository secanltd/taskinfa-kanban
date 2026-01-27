# Taskinfa Worker - Quick Start Guide

Get started with Taskinfa in under 5 minutes!

## One-Line Installation

```bash
curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-bot/main/scripts/install.sh | bash
```

Or with wget:

```bash
wget -qO- https://raw.githubusercontent.com/secanltd/taskinfa-bot/main/scripts/install.sh | bash
```

## What This Does

The installer script will:

1. ✅ Check for and install Claude Code CLI (if needed)
2. ✅ Check for Docker (guide you to install if needed)
3. ✅ Authenticate with Claude
4. ✅ Guide you through creating a Taskinfa account
5. ✅ Set up your worker environment
6. ✅ Start your first worker

## Prerequisites

Before running the installer, you'll need:
- **macOS, Linux, or Windows (WSL2)**
- **curl** or **wget** (usually pre-installed)
- **Internet connection**

Everything else is handled automatically!

## Step-by-Step Guide

### 1. Run the Installer

```bash
curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-bot/main/scripts/install.sh | bash
```

### 2. Follow the Prompts

The installer will guide you through:

```
╔════════════════════════════════════════════════════════════════════╗
║                    TASKINFA WORKER INSTALLER                        ║
║            Autonomous Task Automation with Claude Code             ║
╚════════════════════════════════════════════════════════════════════╝

Step 1: Checking prerequisites...
✓ Claude Code CLI is installed
✓ Docker is installed
✓ Claude is authenticated

Step 2: Taskinfa Dashboard Setup
Before continuing, you need to set up your Taskinfa account:

  1. Go to: https://taskinfa-kanban.secan-ltd.workers.dev
  2. Create an account
  3. Create a new project
  4. Generate an API key
  ...
```

### 3. Create Your Account

1. Visit https://taskinfa-kanban.secan-ltd.workers.dev
2. Click **Sign Up** and create an account
3. Go to **Projects** → **Create Project**
   - Name: `my-first-project`
   - Description: `My first automated project`
   - Repository URL: (optional, e.g., `https://github.com/yourorg/repo`)
4. Note your **Project ID** (e.g., `my-first-project`)
5. Go to **Settings** → **API Keys** → **Create API Key**
6. Copy your API key (shown only once!)

### 4. Configure Your Worker

The installer will ask for:

- **API Key**: Paste the API key you just created
- **Project ID**: Enter your project ID (e.g., `my-first-project`)
- **Worker Name**: Give your worker a name (default: `Worker-1`)
- **Workspace ID**: Usually `default`

### 5. Start Working!

The installer will create everything in `~/.taskinfa/workers/your-project-id/`

Start the worker:
```bash
cd ~/.taskinfa/workers/my-first-project
./start.sh
```

View logs:
```bash
tail -f ~/.taskinfa/workers/my-first-project/logs/worker.log
```

Stop the worker:
```bash
cd ~/.taskinfa/workers/my-first-project
./stop.sh
```

## Creating Your First Task

1. Go to the dashboard: https://taskinfa-kanban.secan-ltd.workers.dev/dashboard
2. Click **Create Task**
3. Fill in:
   - **Project**: Select your project
   - **Title**: "Create a README.md file"
   - **Description**: "Create a README.md file in the project root with a basic project description"
   - **Priority**: Medium
4. Click **Create Task**

Your worker will automatically:
- Fetch the task
- Execute the instructions
- Create the README.md file
- Mark the task as complete
- Add completion notes

## Project Repository Setup (Optional)

If you want workers to automatically clone a git repository:

1. Create a GitHub repository (or use an existing one)
2. In Taskinfa dashboard → **Projects** → Edit your project
3. Add **Repository URL**: `https://github.com/yourorg/repo`
4. Workers will automatically:
   - Clone the repository on first run
   - Work within the project directory
   - Make changes to the code

## What's Next?

- **Create more tasks**: Add tasks to your project
- **Monitor progress**: Watch tasks move through the kanban board
- **Review work**: Check completed tasks in the "Review" column
- **Scale up**: Add more workers for faster execution

## Troubleshooting

### Claude Code not found
```bash
curl -fsSL https://claude.sh/install.sh | bash
export PATH="$HOME/.claude/bin:$PATH"
```

### Docker not running
Start Docker Desktop or run:
```bash
sudo systemctl start docker  # Linux
```

### Worker not starting
Check logs:
```bash
tail -f ~/.taskinfa/workers/your-project-id/logs/worker.log
```

### Can't create tasks - "No projects found"
Make sure you've created at least one project in the Taskinfa dashboard.

## Manual Installation

If you prefer to set things up manually, see:
- [Worker Setup Guide](WORKER_SETUP.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)

## Support

- 📚 Documentation: https://github.com/secanltd/taskinfa-bot
- 🐛 Issues: https://github.com/secanltd/taskinfa-bot/issues
- 💬 Discussions: https://github.com/secanltd/taskinfa-bot/discussions

## License

MIT License - See [LICENSE](LICENSE) for details

---

**Built with ❤️ by SECAN**
