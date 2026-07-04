#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${REPO_NAME:-fandazi-web-tool}"
DESCRIPTION="饭搭子 — GitHub 开源型 Web 工具版家庭做饭助手"
VISIBILITY="${VISIBILITY:-public}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if [ ! -d .git ]; then
  git init -b main
fi

if [ -z "$(git status --short)" ]; then
  echo "Working tree clean."
else
  git add .
  git commit -m "Prepare GitHub release"
fi

read -r -p "GitHub username: " GH_USER
read -r -s -p "GitHub personal access token (repo scope): " GITHUB_TOKEN
echo

if [ -z "$GH_USER" ] || [ -z "$GITHUB_TOKEN" ]; then
  echo "GitHub username and token are required." >&2
  exit 1
fi

PRIVATE_JSON=false
if [ "$VISIBILITY" = "private" ]; then
  PRIVATE_JSON=true
fi

AUTH_HEADER=$(printf 'Authorization: token %s' "$GITHUB_TOKEN")
CREATE_RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "$AUTH_HEADER" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"${REPO_NAME}\",\"description\":\"${DESCRIPTION}\",\"private\":${PRIVATE_JSON},\"has_issues\":true,\"has_projects\":false,\"has_wiki\":false}")

HTTP_CODE=$(printf '%s' "$CREATE_RESPONSE" | tail -n 1)
BODY=$(printf '%s' "$CREATE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "422" ]; then
  echo "GitHub repo create failed (HTTP $HTTP_CODE):" >&2
  echo "$BODY" >&2
  exit 1
fi

REMOTE_URL="https://${GH_USER}:${GITHUB_TOKEN}@github.com/${GH_USER}/${REPO_NAME}.git"
PUBLIC_URL="https://github.com/${GH_USER}/${REPO_NAME}"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git branch -M main
git push -u origin main

# Remove token from local remote URL after push; future pushes can use credential helper / token prompt.
git remote set-url origin "https://github.com/${GH_USER}/${REPO_NAME}.git"

echo "Published: ${PUBLIC_URL}"
