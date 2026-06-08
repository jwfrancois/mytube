---
Task ID: 1
Agent: Main
Task: Speed up Vercel deployment using Neon PostgreSQL and create .env for Jellyfin credentials

Work Log:
- Analyzed current project: SQLite database, in-memory caches, no .env credentials
- Created dual Prisma schema: SQLite for local dev (schema.sqlite.prisma) + PostgreSQL for Vercel (schema.prod.prisma)
- Added MediaCache model to Prisma schema for DB-backed caching
- Created .env with JELLYFIN_SERVER_URL, JELLYFIN_USERNAME, JELLYFIN_PASSWORD
- Created getJellyfinCredentials() helper: auto-connects from env vars if no DB credentials
- Created mediaCache utility: DB-backed caching with TTL, replaces in-memory Maps
- Updated ALL 22 API routes to use credential helper + DB cache
- Removed output: "standalone" from next.config.ts for Vercel compatibility
- Added vercel.json with build:vercel command
- Added postinstall script for prisma generate
- Removed .env and db/custom.db from git tracking (security)
- Pushed to GitHub (force push to overwrite stale remote)
- Browser verification: all APIs working, auto-connect working, DB cache working

Stage Summary:
- Auto-connect from env vars works: status API returns connected=true
- DB caching works: 82ms cached vs 1534ms fresh for TV_SHOW category
- All APIs return 200 status
- Jellyfin NAS entry shows in sidebar with "Online" badge
- 120+ media items from Jellyfin load successfully
- Vercel deployment needs: DATABASE_URL (Neon), JELLYFIN_SERVER_URL, JELLYFIN_USERNAME, JELLYFIN_PASSWORD env vars
