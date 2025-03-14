#!/bin/bash

# Norma AI Startup Script
# This script starts both the backend and frontend services

echo "🚀 Starting Norma AI services..."

# Check if port 3001 is already in use
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3001 is already in use. Stopping existing process..."
    for pid in $(lsof -ti:3001); do 
        kill -9 $pid
        echo "   Process $pid terminated"
    done
fi

# Start the backend server in the background
echo "📡 Starting backend server on port 3001..."
cd "$(dirname "$0")/norma_ai_backend"
source venv/bin/activate
python3 app.py &
BACKEND_PID=$!
echo "   Backend server started with PID: $BACKEND_PID"

# Give the backend server a moment to start up
sleep 2

# Test the backend connection
echo "🔍 Testing backend connection..."
curl -s "http://127.0.0.1:3001/api/public/test-connection" > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Backend is running correctly"
else
    echo "   ❌ Backend connection failed. Check server logs."
    exit 1
fi

# Start the frontend in the background
echo "🖥️  Starting frontend on the next available port..."
cd "$(dirname "$0")/norma_ai_frontend"
BROWSER=none npm start &
FRONTEND_PID=$!
echo "   Frontend server started with PID: $FRONTEND_PID"

echo "✨ Norma AI services started successfully!"
echo "   Backend: http://127.0.0.1:3001"
echo "   Frontend: Check the terminal output for the frontend URL"
echo
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C and then kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID; echo '🛑 Stopping all services...'; exit" INT
wait
