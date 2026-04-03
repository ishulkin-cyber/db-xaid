#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/node20/bin:$PATH"

echo "=== XAID Dashboard ==="
echo

# ── Backend ────────────────────────────────────────────────────────────────
echo "[1/4] Checking backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "  Creating virtualenv..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -r requirements.txt
else
  source .venv/bin/activate
fi

if grep -q "ANTHROPIC_API_KEY=$" .env 2>/dev/null; then
  echo
  echo "⚠️  ANTHROPIC_API_KEY не задан в dashboard/backend/.env"
  echo "   Грейдинг RADPEER не будет работать."
  echo
fi

# Kill old instances
pkill -f "uvicorn main:app" 2>/dev/null || true
sleep 1

echo "[2/4] Starting backend on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning &
BACKEND_PID=$!

# ── Frontend ───────────────────────────────────────────────────────────────
echo "[3/4] Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install --silent

echo "[4/4] Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo
echo "✓ Dashboard запущен:"
echo
echo "  🫁 Дашборд:  http://localhost:8000"
echo "  📊 API docs: http://localhost:8000/docs"
echo
echo "Ctrl+C для остановки."

# Открыть браузер через 1.5 секунды (дать бэкенду стартовать)
sleep 1.5 && open "http://localhost:8000" &

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
