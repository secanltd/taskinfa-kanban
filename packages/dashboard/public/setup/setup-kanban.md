# Setup Taskinfa Kanban

This command configures your environment for autonomous task execution with Taskinfa Kanban.

## Steps

1. Ask the user for their API key from kanban.taskinfa.com (or their custom dashboard URL).

2. Ask the user for their dashboard URL (default: https://kanban.taskinfa.com).

3. Validate the API key:
   ```bash
   curl -s "$DASHBOARD_URL/api/auth/me" -H "Authorization: Bearer $API_KEY"
   ```
   If this returns user info, the key is valid. Extract workspace_id.

4. Store configuration in `.env` file at the workspace root:
   ```
   KANBAN_API_URL=<dashboard_url>
   KANBAN_API_KEY=<api_key>
   ```

5. Configure Claude Code hooks in `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "notification": [{
         "command": "if [ -n \"$KANBAN_API_URL\" ] && [ -n \"$KANBAN_API_KEY\" ]; then curl -s -X POST \"$KANBAN_API_URL/api/events\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $KANBAN_API_KEY\" -d \"{\\\"event_type\\\": \\\"notification\\\", \\\"session_id\\\": \\\"$KANBAN_SESSION_ID\\\", \\\"task_id\\\": \\\"$KANBAN_TASK_ID\\\", \\\"message\\\": $(echo \\\"$CLAUDE_NOTIFICATION\\\" | jq -Rs .)}\"; fi"
       }]
     }
   }
   ```

6. Create memory directory structure:
   ```
   /workspace/.memory/overview.md
   /workspace/.memory/preferences.md
   ```

7. Fetch the user's projects from the API:
   ```bash
   curl -s "$DASHBOARD_URL/api/task-lists" -H "Authorization: Bearer $API_KEY"
   ```
   For each project, create `.memory/context.md` in its working directory if it doesn't exist.

8. Download the orchestrator script:
   ```bash
   curl -o /workspace/scripts/orchestrator.ts "$DASHBOARD_URL/setup/orchestrator.ts"
   ```
   Or tell the user to copy it from the taskinfa-kanban repository.

9. Print summary:
   ```
   Setup complete!

   Your dashboard: <dashboard_url>
   API key: configured in .env
   Hooks: configured in .claude/settings.json
   Memory: /workspace/.memory/

   To start the orchestrator (auto-picks up tasks every 15 min):
     KANBAN_API_URL=<url> KANBAN_API_KEY=<key> npx tsx scripts/orchestrator.ts

   Optional: Set up Telegram notifications
     1. Create a bot via @BotFather on Telegram
     2. Send /start to your bot
     3. Configure the bot token in your dashboard settings

   Add tasks on the board and Claude will pick them up automatically!
   ```
