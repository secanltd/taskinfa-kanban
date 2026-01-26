#!/bin/bash
# Stop Taskinfa-Bot container

set -e

BOT_NAME=${1:-john}

echo "🛑 Stopping Taskinfa-Bot: ${BOT_NAME}"

if [ "$BOT_NAME" = "john" ]; then
  docker-compose stop bot-john
elif [ "$BOT_NAME" = "gordon" ]; then
  docker-compose stop bot-gordon
elif [ "$BOT_NAME" = "smith" ]; then
  docker-compose stop bot-smith
elif [ "$BOT_NAME" = "all" ]; then
  docker-compose stop
else
  echo "❌ Unknown bot name: $BOT_NAME"
  echo "Available bots: john, gordon, smith, all"
  exit 1
fi

echo "✅ Bot stopped successfully"
