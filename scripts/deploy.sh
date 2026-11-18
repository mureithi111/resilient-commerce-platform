#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}/infrastructure"

echo "Checking TypeScript..."

npx tsc --noEmit

echo "Synthesizing registry stack..."

npx cdk synth CommerceRegistryStack

echo "Synthesizing platform stack..."

npx cdk synth CommercePlatformStack

echo "Synthesizing pipeline stack..."

npx cdk synth CommercePipelineStack

echo "Reviewing platform infrastructure differences..."

npx cdk diff CommercePlatformStack

echo "Reviewing pipeline infrastructure differences..."

npx cdk diff CommercePipelineStack

echo "Validation completed."
echo "Review all differences before deploying."
