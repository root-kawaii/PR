#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-ios}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""
IOS_BUNDLE_ID="com.rootkawaii.pierre"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

wait_for_postgres() {
  local status=""
  for _ in {1..30}; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' pierre-local-postgres 2>/dev/null || true)"
    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "Local Postgres did not become ready in time." >&2
  exit 1
}

start_db() {
  echo "Starting local Postgres on 127.0.0.1:5433..."
  (cd "${ROOT_DIR}" && docker compose up -d postgres >/dev/null)
  wait_for_postgres
}

start_backend_background() {
  if lsof -ti tcp:3000 >/dev/null 2>&1; then
    echo "Port 3000 is already in use. Stop the existing backend first." >&2
    exit 1
  fi

  echo "Starting backend on http://127.0.0.1:3000..."
  (
    cd "${ROOT_DIR}/rust_BE"
    cargo run
  ) &
  BACKEND_PID=$!

  sleep 4
  if ! kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    echo "Backend exited during startup." >&2
    wait "${BACKEND_PID}" || true
    exit 1
  fi
}

ensure_ios_dev_build() {
  require_cmd xcrun

  cd "${ROOT_DIR}/pierre_two"

  if xcrun simctl get_app_container booted "${IOS_BUNDLE_ID}" app >/dev/null 2>&1; then
    return 0
  fi

  echo "iOS dev build not installed in the booted simulator. Installing it now..."
  APP_ENV=development EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 npx expo run:ios
}

start_app() {
  echo "Starting Expo app (${MODE})..."
  cd "${ROOT_DIR}/pierre_two"

  case "${MODE}" in
    ios)
      ensure_ios_dev_build
      APP_ENV=development EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 npx expo start --ios
      ;;
    android)
      npm run start:local-android
      ;;
    app)
      APP_ENV=development EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 npx expo start
      ;;
    *)
      echo "Unsupported mode: ${MODE}" >&2
      echo "Usage: bash scripts/dev-local.sh [ios|android|app|backend|db]" >&2
      exit 1
      ;;
  esac
}

require_cmd docker
require_cmd cargo

trap cleanup EXIT INT TERM

case "${MODE}" in
  db)
    start_db
    echo "Local Postgres is ready."
    ;;
  backend)
    start_db
    echo "Starting backend on http://127.0.0.1:3000..."
    cd "${ROOT_DIR}/rust_BE"
    cargo run
    ;;
  ios|android|app)
    require_cmd npm
    start_db
    start_backend_background
    start_app
    ;;
  *)
    echo "Usage: bash scripts/dev-local.sh [ios|android|app|backend|db]" >&2
    exit 1
    ;;
esac
