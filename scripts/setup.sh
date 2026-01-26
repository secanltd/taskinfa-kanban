#!/bin/bash

# Taskinfa-Bot Setup Script
# Automates initial setup and configuration

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Taskinfa-Bot Setup - Autonomous Task Automation     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm 9+ first."
    exit 1
fi

if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
    echo "   You can continue setup, but bot won't work without Claude Code."
fi

echo "✓ Prerequisites check passed"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Build shared package
echo "Building shared types..."
npm run build --workspace=packages/shared
echo "✓ Shared types built"
echo ""

# Setup environment
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s/your-secret-key-change-in-production/$JWT_SECRET/" .env
    rm .env.bak

    echo "✓ .env file created with secure JWT_SECRET"
else
    echo "⚠️  .env file already exists, skipping..."
fi
echo ""

# Setup database
echo "Setting up database..."
cd packages/dashboard

if command -v wrangler &> /dev/null; then
    echo "Creating D1 database..."
    wrangler d1 create taskinfa-db || echo "Database may already exist"

    echo ""
    echo "⚠️  IMPORTANT: Copy the database_id from above and update wrangler.toml"
    echo "   Then run: npm run db:migrate"
else
    echo "⚠️  Wrangler not found. Install with: npm install -g wrangler"
    echo "   Then run: wrangler d1 create taskinfa-db"
fi

cd ../..
echo ""

# Build packages
echo "Building all packages..."
npm run build
echo "✓ All packages built"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! 🎉                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Update packages/dashboard/wrangler.toml with your D1 database_id"
echo "2. Run database migration:"
echo "   cd packages/dashboard && npm run db:migrate"
echo ""
echo "3. Generate an API key:"
echo "   node scripts/generate-api-key.js"
echo ""
echo "4. Start the dashboard:"
echo "   npm run dashboard:dev"
echo ""
echo "5. In another terminal, run the bot:"
echo "   npm run bot:run"
echo ""
echo "6. Open http://localhost:3000 to see your dashboard"
echo ""
echo "For detailed instructions, see SETUP.md"
echo ""
