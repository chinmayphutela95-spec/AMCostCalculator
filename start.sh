#!/bin/bash
# Metal AM Cost Analyzer - Start Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "═══════════════════════════════════════"
echo "  Metal AM Cost Analyzer"
echo "═══════════════════════════════════════"

# Seed database if not already seeded
echo "→ Checking database..."
cd "$BACKEND_DIR" && python3 seed_data.py

# Start backend
echo "→ Starting backend on port 8000..."
cd "$BACKEND_DIR" && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "→ Starting frontend on port 5173..."
cd "$FRONTEND_DIR" && /opt/homebrew/bin/node ./node_modules/.bin/vite --port 5173 &
FRONTEND_PID=$!
sleep 3

echo ""
echo "═══════════════════════════════════════"
echo "  ✓  Frontend:  http://localhost:5173"
echo "  ✓  API docs:  http://localhost:8000/docs"
echo "═══════════════════════════════════════"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
