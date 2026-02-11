# Taskinfa Kanban

Autonomous task execution system powered by Claude Code. An orchestrator daemon picks up tasks from your Kanban board and starts Claude sessions automatically. Monitor everything from your phone via Telegram.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- **Kanban Dashboard** - Visual task management with drag-and-drop
- **Autonomous Orchestration** - Daemon polls the board every 15 min, starts Claude sessions
- **Session Tracking** - Live view of active Claude sessions, events, and progress
- **Telegram Bot** - `/status`, `/tasks`, `/new` commands + push notifications when stuck/done
- **Overview Page** - Cross-project status at a glance
- **Memory System** - File-based context persistence across sessions
- **Multi-Workspace** - Isolated workspaces for different teams

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/secanltd/taskinfa-kanban.git
cd taskinfa-kanban
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (JWT_SECRET, etc.)
```

### 3. Start Dashboard

```bash
npm run dashboard:dev
```

Open http://localhost:3000, create an account, and add tasks.

### 4. Start the Orchestrator

```bash
KANBAN_API_URL=http://localhost:3000 KANBAN_API_KEY=<your-key> npm run orchestrator
```

The orchestrator will check for pending tasks every 15 minutes and start Claude sessions automatically.

## Architecture

```
Phone (Telegram)  <->  CF Worker (Bot)  <->  D1 Database  <->  Dashboard (Next.js)
                                                  ^
                            +--------------------------+
                            |                          |
                  Docker Container (24/7)              |
                  +-------------------+                |
                  |  Orchestrator     | polls every 15 min
                  |  (node daemon)    | starts Claude sessions
                  |      |            |
                  |  +---+----+ x N   |
                  |  | claude |       | hooks POST to /api/events
                  |  | -p ... |       |
                  |  +--------+       |
                  +-------------------+
```

**Task Status Flow:**
```
backlog -> todo -> in_progress -> review -> done
```

## Project Structure

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/      # Next.js app + API (Cloudflare Workers)
│   ├── telegram/       # Telegram bot (Cloudflare Worker)
│   └── shared/         # Shared TypeScript types
├── scripts/
│   └── orchestrator.ts # Daemon that polls board and starts Claude
├── .claude/
│   ├── settings.json   # Claude Code hooks config
│   └── skills/         # Autonomous worker skill instructions
├── .memory/            # Cross-project runtime state
└── docs/               # Documentation
```

## Development

```bash
# Build all packages
npm run build

# Start dashboard in dev mode
npm run dashboard:dev

# Start Telegram bot locally
npm run telegram:dev

# Start orchestrator
npm run orchestrator

# Run linter
npm run lint
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

Copyright (c) 2025 [SECAN](https://secan.info)

## Support

- **Issues**: [GitHub Issues](https://github.com/secanltd/taskinfa-kanban/issues)
- **Discussions**: [GitHub Discussions](https://github.com/secanltd/taskinfa-kanban/discussions)

---

Built by [SECAN](https://secan.info)
