#!/bin/bash

# Read version from package.json
# VERSION=$(node -p "require('./package.json').version")
VERSION=v4.1

# Define image name and tag
IMAGE_NAME="h55205l/ffandown"
IMAGE_TAG="$IMAGE_NAME:$VERSION"

# Define color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Checking for dist directory...${NC}"
# Remove dist directory if it exists
if [ -d "dist" ]; then
  echo -e "${GREEN}Removing existing dist directory...${NC}"
  rm -r dist
fi

# Build package
echo -e "${GREEN}Building package...${NC}"
npm run pkg

# Remove existing Docker image (if any)
echo -e "${GREEN}Removing existing Docker image...${NC}"
docker image rm -f "$IMAGE_TAG" >/dev/null 2>&1

echo -e "${GREEN}Building new Docker image...${NC}"
# Build new Docker image
docker build -t "$IMAGE_TAG" .

echo -e "${GREEN}Done.${NC}"