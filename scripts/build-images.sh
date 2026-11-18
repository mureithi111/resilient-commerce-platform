#!/usr/bin/env bash

set -euo pipefail

echo "Building local web image..."

docker build \
  -t commerce-web:local \
  app/web

echo "Building local worker image..."

docker build \
  -t commerce-worker:local \
  app/worker

echo "Checking local images..."

docker image inspect commerce-web:local >/dev/null
docker image inspect commerce-worker:local >/dev/null

echo "Both application images built successfully."
echo "Images were not pushed to ECR."
