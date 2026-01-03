#!/usr/bin/env bash
set -euo pipefail
cd API
sam validate
sam build
sam deploy --resolve-s3 --capabilities CAPABILITY_IAM
