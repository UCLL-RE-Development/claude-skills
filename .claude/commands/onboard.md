---
description: Onboard Claude Code into the codebase
---

# Context

## Rules

- Always ask for clarification if any part of the codebase or project is unclear
- Do not commit any changes to the codebase without explicit instructions
- Always use the re-frame command for task related to the client and use the re-brain command for task related to the server, the AiServer is not our concern

## Process

1. **Scan structure**
   - Run `git ls-files` to see all tracked files

2. **Read key files**
   - CLAUDE.md, and any other architecture docs
   - check the build commands re-brain.md and re-frame.md
   - Entry points and config files
   - Core schemas/models

3. **Check state**
   - Run `git status` and `git log -10 --oneline`

## Output

Provide a brief summary:

- What this project does
- Tech stack
- How it's organised
- Current branch and recent activity
