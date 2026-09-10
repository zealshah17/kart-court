#!/bin/zsh
# A regular Terminal session keeps the preview independent of Codex tool sessions.
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js is required. Install Node.js 18 or later, then reopen this launcher.'
  read -r 'court_reply?Press Return to close.'
  exit 1
fi
node server.mjs
if [ "$?" -ne 0 ]; then
  read -r 'court_reply?Press Return to close.'
fi
