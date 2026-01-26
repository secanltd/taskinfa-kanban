#!/bin/bash
# Start Taskinfa-Bot container

set -e

BOT_NAME=${1:-john}

echo "🤖 Starting Taskinfa-Bot: ${BOT_NAME}"

if [ "$BOT_NAME" = "john" ]; then
  docker-compose up -d bot-john
elif [ "$BOT_NAME" = "gordon" ]; then
  docker-compose --profile multi-bot up -d bot-gordon
elif [ "$BOT_NAME" = "smith" ]; then
  docker-compose --profile multi-bot up -d bot-smith
else
  echo "❌ Unknown bot name: $BOT_NAME"
  echo "Available bots: john, gordon, smith"
  exit 1
fi

echo "✅ Bot started successfully"
echo "View logs: ./scripts/logs.sh $BOT_NAME"
