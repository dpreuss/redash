#!/bin/bash
set -e

echo "Stopping containers..."
docker compose down

echo "Clearing client/dist directory..."
rm -rf client/dist

echo "Rebuilding containers..."
docker compose build --no-cache

echo "Starting containers..."
docker compose up -d

echo "Frontend rebuild completed. Please refresh your browser with hard refresh (Ctrl+Shift+R or Cmd+Shift+R)." 