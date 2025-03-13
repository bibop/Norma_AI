#!/bin/bash
# Norma AI starter script
# This script starts both the Flask backend and React frontend services

echo "========== NORMA AI STARTUP SCRIPT =========="
echo "Starting Norma AI services..."

# Determine terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
port_in_use() {
  lsof -i:$1 -P -n | grep LISTEN >/dev/null
  return $?
}

# Check if port 3001 is available
if port_in_use 3001; then
  echo -e "${YELLOW}Warning: Port 3001 is already in use. The backend may not start correctly.${NC}"
fi

# Start the Flask backend
echo -e "\n${GREEN}Starting Flask backend service on port 3001...${NC}"
cd "$(dirname "$0")/norma_ai_backend"

# Activate the virtual environment
source venv/bin/activate

# Run the Flask application
echo "Starting Flask app..."
python3 app.py &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to initialize
echo "Waiting for backend to initialize..."
sleep 3

# Start the React frontend (in a new terminal window)
echo -e "\n${GREEN}Starting React frontend service...${NC}"
echo "Opening new terminal window for frontend service..."

# Use AppleScript to open a new terminal window for the frontend
osascript <<EOF
tell application "Terminal"
  do script "cd '$(dirname "$0")/norma_ai_frontend' && npm start"
end tell
EOF

echo -e "\n${GREEN}All services started!${NC}"
echo "- Backend: http://127.0.0.1:3001"
echo "- Frontend: http://localhost:3000"
echo "- Connection Test: open connection_test.html in your browser"
echo -e "\nPress Ctrl+C to stop the backend service"

# Handle clean shutdown
cleanup() {
  echo -e "\n${YELLOW}Shutting down services...${NC}"
  if [ -n "$BACKEND_PID" ]; then
    echo "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID
  fi
  echo "Services stopped."
  exit 0
}

trap cleanup INT

# Keep script running until user presses Ctrl+C
wait $BACKEND_PID
