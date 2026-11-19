# LOOTZONE on Render (or any Node host)

No dependencies, no build step. Needs Node 18+.

## Deploy on Render
1. Create a GitHub repo and push the contents of this folder (server.js, package.json, render.yaml, public/).
2. On render.com: New > Web Service > pick the repo.
3. Runtime: Node. Build command: `echo ok` (or leave blank). Start command: `node server.js`.
4. Deploy. Share the `https://yourname.onrender.com` link with anyone.

Notes
- Free Render services sleep when idle (first visit takes ~30s to wake) and their disk is wiped on every deploy/restart,
  so accounts and the leaderboard reset. To keep them, add a Render Disk (paid) mounted at /data and set env var DATA_DIR=/data.
- Accounts: username + email + password (hashed with scrypt). Email is stored server-side only and never shown.
- Servers: `lzteam` (team deathmatch) and `lzffa` (free for all), up to 16 players each.

Run locally: `node server.js` then open http://localhost:3000
