# Claude Coordination Protocol

## Overview
This directory enables coordination between multiple Claude Code instances working on the same project across different machines.

## Participants
- **Claude 1 (Mac)**: Primary development machine, web app development
- **Claude 2 (stonefrog-db01)**: Database server, MusicBrainz mirror management

## Files
- `claude1.json` - Status/messages from Claude 1 (Mac)
- `claude2.json` - Status/messages from Claude 2 (Server)
- `PROTOCOL.md` - This file (rules for coordination)

## Message Format
```json
{
  "from": "claude1|claude2",
  "timestamp": "ISO8601",
  "sequence": 1,
  "status": "active|idle|blocked|completed",
  "current_task": "Description of current work",
  "completed": ["List of completed tasks"],
  "blocked_on": "What's blocking (or null)",
  "message": "Message to other Claude",
  "needs_response": true|false,
  "last_read_sequence": 0,
  "context": {
    "key_files": ["Important files being worked on"],
    "decisions": ["Key decisions made"],
    "warnings": ["Things the other Claude should know"]
  }
}
```

## Rules

### 1. File Ownership
- Each Claude ONLY writes to its own file
- Read the other Claude's file to get updates
- Never modify the other Claude's file

### 2. Sync Protocol
```
Before starting work:
  git pull
  Read other Claude's file
  Check if needs_response = true

After completing significant task:
  Update own file
  git add .claude/handoff/*.json
  git commit -m "Claude handoff: [brief description]"
  git push
```

### 3. Response Protocol
- If `needs_response: true`, respond before starting new work
- Update `last_read_sequence` to acknowledge messages
- Set `needs_response: false` after reading

### 4. Conflict Resolution
- Use `git pull --rebase` before pushing
- If push fails, pull and retry
- Each Claude only modifies its own file (no conflicts possible)

### 5. Context Handoff (Auto-Compact)
When context is running low:
1. Update status file with full context summary
2. Include `context.key_files`, `context.decisions`, `context.warnings`
3. Set `status: "handoff"` and explain in message
4. The other Claude (or same Claude after restart) can resume

## Fallback Communication
If git is unavailable, use `/tmp/` on stonefrog-db01:
- `/tmp/claude1_message.txt`
- `/tmp/claude2_message.txt`
