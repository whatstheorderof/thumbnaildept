---
description: Thumbnail Department — research a thumbnail job (e.g. /research JOB-000124)
argument-hint: JOB-000000
allowed-tools: Bash(npm run td:*)
---
Run `npm run td -- research $ARGUMENTS` from the project root and summarise the result for the user: job status, what changed, and the next step. If it fails, show the error and suggest the fix (missing .env.local keys, job in the wrong state, etc.). Never try to approve an order — approval is human-only in the web UI.
