#!/usr/bin/env bash

set -euo pipefail

: "${ALB_DNS:?Set ALB_DNS first}"

for i in $(seq 1 100); do
  curl -sS -X POST \
    "http://${ALB_DNS}/orders" \
    -H "Content-Type: application/json" \
    -d "{
      \"customerId\":\"LOAD-TEST-${i}\",
      \"items\":[
        {
          \"productId\":\"TEST-${i}\",
          \"quantity\":1,
          \"price\":100
        }
      ]
    }" >/dev/null

  echo "Submitted test order ${i}"
done
