#!/bin/bash
# Clean-start script for xAID dashboard
# Used by launchd and for manual restarts

export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[$(date)] Stopping any running Next.js servers..."
pkill -f "next dev" 2>/dev/null
sleep 2

echo "[$(date)] Clearing .next cache..."
rm -rf "$DASHBOARD_DIR/.next"

echo "[$(date)] Starting dashboard..."
cd "$DASHBOARD_DIR"
exec npm run dev
