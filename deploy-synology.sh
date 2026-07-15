#!/bin/bash
# =============================================================================
# CARE AI Sonologist Companion™ — Synology NAS Deployment Script
# =============================================================================
#
# Usage:
#   chmod +x deploy-synology.sh
#   ./deploy-synology.sh            # Build and deploy
#   ./deploy-synology.sh --rebuild  # Force rebuild from scratch
#
# Prerequisites:
#   - Docker + Docker Compose installed on Synology (Container Manager package)
#   - This project directory uploaded to the NAS
#   - Port 3090 available (or change APP_PORT in .env)
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN} CARE AI Sonologist Companion™${NC}"
echo -e "${CYAN} Synology NAS Deployment${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# ---- Pre-flight checks ----
echo -e "${YELLOW}[1/5] Pre-flight checks...${NC}"

if ! command -v docker &>/dev/null; then
  echo -e "${RED}ERROR: Docker not found.${NC}"
  echo "Install Docker via Synology Container Manager package."
  exit 1
fi
echo "  ✓ Docker found: $(docker --version | head -1)"

# Detect Compose V2 plugin vs standalone
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  echo "  ✓ Docker Compose V2 plugin detected"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  echo "  ✓ Docker Compose standalone detected"
else
  echo -e "${RED}ERROR: Docker Compose not found.${NC}"
  exit 1
fi

# Check for .env
if [ ! -f .env ]; then
  echo -e "${YELLOW}  ! No .env file found. Creating from .env.example...${NC}"
  cp .env.example .env
  echo "  ✓ Created .env — edit APP_PORT if needed (default: 3090)"
fi

# Read port from .env
source .env 2>/dev/null || true
APP_PORT="${APP_PORT:-3090}"

echo ""

# ---- Stop existing container ----
echo -e "${YELLOW}[2/5] Stopping existing container...${NC}"
if docker ps -a --format '{{.Names}}' | grep -q "care-ai-sonologist-companion"; then
  $COMPOSE_CMD down 2>/dev/null || docker rm -f care-ai-sonologist-companion 2>/dev/null
  echo "  ✓ Stopped existing container"
else
  echo "  ✓ No existing container found"
fi
echo ""

# ---- Create data directories ----
echo -e "${YELLOW}[3/5] Ensuring data directories...${NC}"
mkdir -p data/db data/studies data/exports
echo "  ✓ data/db      (SQLite database)"
echo "  ✓ data/studies (DICOM study files)"
echo "  ✓ data/exports (PDF report exports)"
echo ""

# ---- Build ----
echo -e "${YELLOW}[4/5] Building Docker image...${NC}"
BUILD_ARGS=""
if [ "$1" = "--rebuild" ]; then
  BUILD_ARGS="--no-cache"
  echo "  ! Full rebuild (--no-cache)"
fi

$COMPOSE_CMD build $BUILD_ARGS 2>&1 | while IFS= read -r line; do
  echo "  $line"
done
echo "  ✓ Build complete"
echo ""

# ---- Start ----
echo -e "${YELLOW}[5/5] Starting container...${NC}"
$COMPOSE_CMD up -d 2>&1 | while IFS= read -r line; do
  echo "  $line"
done

# Wait for health check
echo ""
echo -e "${CYAN}Waiting for health check...${NC}"
HEALTHY=false
for i in $(seq 1 30); do
  if docker ps --format '{{.Status}}' | grep -q "care-ai-sonologist-companion" | grep -q "healthy"; then
    HEALTHY=true
    break
  fi
  # Also check if container is running (older Docker doesn't always show "healthy")
  if docker ps --format '{{.Names}}' | grep -q "care-ai-sonologist-companion"; then
    if wget -q --spider "http://localhost:${APP_PORT}/api/health" 2>/dev/null; then
      HEALTHY=true
      break
    fi
  fi
  printf "  ."
  sleep 2
done
echo ""

if [ "$HEALTHY" = true ]; then
  echo -e "${GREEN}=========================================${NC}"
  echo -e "${GREEN} ✓ DEPLOYMENT SUCCESSFUL${NC}"
  echo -e "${GREEN}=========================================${NC}"
  echo ""
  echo -e "  Access: ${CYAN}http://<your-synology-ip>:${APP_PORT}${NC}"
  echo ""
  echo "  Useful commands:"
  echo "    $COMPOSE_CMD logs -f          # View live logs"
  echo "    $COMPOSE_CMD restart          # Restart container"
  echo "    $COMPOSE_CMD down             # Stop container"
  echo "    $COMPOSE_CMD down -v           # Stop + remove volumes (DELETES DATA)"
  echo "    $COMPOSE_CMD build --no-cache  # Rebuild from scratch"
  echo ""
else
  echo -e "${YELLOW}=========================================${NC}"
  echo -e "${YELLOW} Container started but health check not yet passing${NC}"
  echo -e "${YELLOW} Check logs: $COMPOSE_CMD logs -f${NC}"
  echo -e "${YELLOW}=========================================${NC}"
fi