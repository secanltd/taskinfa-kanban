#!/bin/bash
# Claude Code notification hook — posts events to taskinfa-kanban API
# Called by .claude/settings.json hooks. Reads notification JSON from stdin.
# No-op if KANBAN_API_URL or KANBAN_API_KEY are not set (safe for manual sessions).

[ -z "$KANBAN_API_URL" ] || [ -z "$KANBAN_API_KEY" ] && exit 0

# Read stdin (hook payload)
INPUT=$(cat 2>/dev/null || echo '{}')

# Extract message from the hook payload
MSG=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','notification'))" 2>/dev/null || echo "notification")

# Determine event type from message content
EVENT_TYPE="notification"
case "$MSG" in
  *stuck*|*blocked*|*cannot*) EVENT_TYPE="stuck" ;;
  *error*|*failed*|*Error*)   EVENT_TYPE="error" ;;
  *complete*|*done*|*finished*) EVENT_TYPE="task_completed" ;;
  *need*input*|*question*)    EVENT_TYPE="needs_input" ;;
esac

# POST to events API (best-effort, don't block Claude)
curl -sf -X POST "$KANBAN_API_URL/api/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KANBAN_API_KEY" \
  -d "{\"event_type\":\"$EVENT_TYPE\",\"session_id\":\"${KANBAN_SESSION_ID:-unknown}\",\"task_id\":\"${KANBAN_TASK_ID:-}\",\"message\":$(echo "$MSG" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '\"notification\"')}" \
  >/dev/null 2>&1 &

exit 0
