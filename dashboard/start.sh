#!/bin/bash
# Clean-start script for xAID dashboard
# Run this whenever the dashboard looks broken or won't start

export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
DASHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "→ Stopping all Next.js dev servers..."
pkill -f "next dev" 2>/dev/null
sleep 1

echo "→ Clearing .next cache..."
rm -rf "$DASHBOARD_DIR/.next"

echo "→ Starting dashboard..."
cd "$DASHBOARD_DIR"
npm run dev
