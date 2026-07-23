#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_PLIST="${REPO_ROOT}/scripts/com.fandazi.auto-publish.plist"
TARGET_DIR="/Users/miki/Library/LaunchAgents"
TARGET_PLIST="${TARGET_DIR}/com.fandazi.auto-publish.plist"
DOMAIN="gui/$(id -u)"

mkdir -p "${TARGET_DIR}" "/Users/miki/Library/Logs"
cp "${SOURCE_PLIST}" "${TARGET_PLIST}"
launchctl bootout "${DOMAIN}" "${TARGET_PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "${DOMAIN}" "${TARGET_PLIST}"
launchctl enable "${DOMAIN}/com.fandazi.auto-publish"
launchctl kickstart -k "${DOMAIN}/com.fandazi.auto-publish"

echo "饭搭子自动发布已安装并启动。"
