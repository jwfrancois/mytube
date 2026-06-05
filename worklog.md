---
Task ID: 1
Agent: Main Agent
Task: Fix server down issue and verify full MyTube application functionality

Work Log:
- Investigated dev server crash - server was dying between Bash tool sessions due to sandbox process management
- Created persistent server launcher using Node.js `spawn` with `detached: true` and `unref()` in `/home/z/my-project/start-server.js`
- Verified Prisma schema is correct
- Ran `bun run lint` - no errors found
- Started persistent dev server with PID tracking via `/tmp/next-server.pid`
- Verified server stays running across multiple Bash sessions
- Tested all application features via agent browser

Stage Summary:
- Dev server now persists using detached Node.js child process
- All features verified working: local media, Jellyfin browsing, video playback, settings
- Jellyfin connection confirmed: server at https://manitou.dyabavadra.com, user dyabavadra, connected
- No code errors found - lint passes, no console errors, no runtime errors
- Server log shows all API responses returning 200
