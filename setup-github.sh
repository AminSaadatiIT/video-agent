#!/bin/bash
set -e
echo "Step 1: Login to GitHub (opens browser, no token typing needed)"
gh auth login

echo "Step 2: Init git and create+push repo in one shot"
git init
git add .
git commit -m "Initial commit: video agent"
gh repo create video-agent --public --source=. --remote=origin --push

echo "Done. Repo URL:"
gh repo view --web=false --json url -q .url
