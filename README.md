# Taskinfa Kanban

Autonomous task execution system powered by Claude Code. Deploy AI workers that automatically pick up tasks from your Kanban board and execute them.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- **Kanban Dashboard** - Visual task management with drag-and-drop
- **Autonomous Workers** - Docker containers that execute tasks automatically
- **Claude Code Integration** - AI-powered code execution via MCP
- **Real-time Updates** - SSE-based live status updates
- **Multi-Workspace** - Isolated workspaces for different projects
- **Secure by Design** - Isolated Docker containers, API key authentication

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/taskinfa-kanban.git
cd taskinfa-kanban
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Dashboard

```bash
npm run build
npm run dashboard:dev
```

Open http://localhost:3000, create an account, and add a task.

### 4. Start a Worker

```bash
./scripts/docker-manage.sh start
```

See [Worker Setup](docs/WORKER_SETUP.md) for detailed configuration.

## Documentation

| Guide | Description |
|-------|-------------|
| [Local Setup](docs/SETUP.md) | Complete local development setup |
| [Deployment](docs/DEPLOYMENT.md) | Deploy to Cloudflare Workers |
| [Worker Setup](docs/WORKER_SETUP.md) | Configure Docker workers |
| [API Reference](docs/API_REFERENCE.md) | REST API documentation |
| [Architecture](docs/ARCHITECTURE.md) | System design and structure |
| [Environment](docs/ENVIRONMENT.md) | Environment variables reference |

## Architecture

```
User Interface
      |
      v
+------------------+     +------------------+
|  Dashboard API   | <-> |   D1 Database    |
|  (Next.js)       |     |   (SQLite)       |
+------------------+     +------------------+
      |
      v
+------------------+     +------------------+
|   MCP Server     | <-> |   Bot Executor   |
|                  |     |   (Docker)       |
+------------------+     +------------------+
                               |
                               v
                        +------------------+
                        |   Claude Code    |
                        |   CLI            |
                        +------------------+
```

**Task Status Flow:**
```
backlog -> todo -> in_progress -> review -> done
```

## Project Structure

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/      # Next.js app + API + MCP server
│   ├── bot/            # Autonomous task executor
│   └── shared/         # Shared TypeScript types
├── scripts/            # Helper scripts
├── docs/               # Documentation
└── docker-compose.yml  # Docker configuration
```

## Why Taskinfa?

- **Open Source** - MIT licensed, fork and customize
- **Self-Hosted** - Your data, your infrastructure
- **Secure** - Workers run in isolated Docker containers
- **Scalable** - Run multiple workers in parallel
- **Extensible** - MCP protocol for custom integrations

## Development

```bash
# Build all packages
npm run build

# Start dashboard in dev mode
npm run dashboard:dev

# Run bot locally (without Docker)
cd packages/bot && npm run dev

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

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/taskinfa-kanban/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/taskinfa-kanban/discussions)

---

Built by [SECAN](https://secan.info)
