#!/bin/bash
# View Taskinfa-Bot container logs

set -e

BOT_NAME=${1:-john}
FOLLOW=${2:-true}

if [ "$BOT_NAME" = "john" ]; then
  CONTAINER="taskinfa-kanban-john"
elif [ "$BOT_NAME" = "gordon" ]; then
  CONTAINER="taskinfa-kanban-gordon"
elif [ "$BOT_NAME" = "smith" ]; then
  CONTAINER="taskinfa-kanban-smith"
else
  echo "❌ Unknown bot name: $BOT_NAME"
  echo "Available bots: john, gordon, smith"
  exit 1
fi

if [ "$FOLLOW" = "true" ]; then
  echo "📜 Following logs for ${BOT_NAME} (Ctrl+C to exit)"
  docker-compose logs -f "$CONTAINER"
else
  echo "📜 Showing recent logs for ${BOT_NAME}"
  docker-compose logs --tail=50 "$CONTAINER"
fi
