#!/usr/bin/env bash

# Bare launches from Git Bash should open a workspace at the caller's directory.
# Herdr commands and calls made inside a managed pane must remain side-effect free.
herdr_real="${HERDR_REAL_BIN:-$HOME/.herdr/packages/standalone/current/herdr.exe}"
if [[ ! -x "$herdr_real" ]]; then
	printf 'Herdr executable not found: %s\n' "$herdr_real" >&2
	exit 127
fi

if [[ "${HERDR_ENV:-}" != "1" && $# -eq 0 ]]; then
	# This succeeds when the persistent server already exists. If it does not,
	# the normal launch below creates the initial workspace from the caller's cwd.
	"$herdr_real" workspace create --cwd "$PWD" --focus >/dev/null 2>&1 || true
fi

exec "$herdr_real" "$@"
