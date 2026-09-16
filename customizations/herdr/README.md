# Herdr Git Bash setup

This setup makes Git Bash the default shell for new Herdr panes on Windows and
makes a bare `herdr` command launched from Git Bash open a focused workspace at
the invoking directory.

For a complete new-machine procedure, including `pie` launchers and the custom
agent extension, start with the
[Windows `pie` and Herdr setup guide](../windows-setup.md). This document owns
the component-specific behavior and troubleshooting details.

## Why both changes are required

Herdr is a persistent terminal server. Running bare `herdr` while its server is
already active attaches to the existing session and focused workspace; it does
not retarget that workspace to the caller's current directory.

Shell selection is independent. Without an explicit Windows terminal setting,
Herdr starts PowerShell. Existing panes retain their original shell after a
configuration reload.

The complete behavior therefore requires:

1. `[terminal].default_shell` to control newly created pane shells; and
2. the Git Bash `open-here.sh` wrapper to create and focus a workspace at
   `$PWD` before attaching to an already-running server.

## User-level configuration

The live config is `%APPDATA%\herdr\config.toml`:

```toml
[terminal]
default_shell = "C:/Program Files/Git/bin/bash.exe"
shell_mode = "non_login"
new_cwd = "follow"
```

`non_login` preserves the requested pane working directory instead of applying
login-shell startup behavior. `follow` makes new tabs and panes inherit their
source workspace when no explicit `--cwd` is supplied.

Validate and apply changes without stopping the server:

```bash
herdr config check
herdr server reload-config
```

Only newly created panes use the changed shell. Recreate an old PowerShell pane
or workspace when it should use Git Bash.

## Open-here wrapper

The tracked wrapper is `customizations/herdr/open-here.sh`. Install it at the
first user-local `PATH` location used by Git Bash:

```bash
mkdir -p "$HOME/bin"
install -m 755 customizations/herdr/open-here.sh "$HOME/bin/herdr"
hash -r
command -v herdr
```

The expected resolved path is `/c/Users/YOUR_USER/bin/herdr`.

The wrapper uses Herdr's update-stable executable path:

```text
~/.herdr/packages/standalone/current/herdr.exe
```

Its behavior is deliberately narrow:

- bare `herdr` outside a managed pane first requests
  `workspace create --cwd "$PWD" --focus`, then attaches;
- if no server exists, that request fails harmlessly and normal startup creates
  the initial workspace from the caller's directory;
- calls made inside Herdr delegate directly;
- explicit commands such as `herdr status` and `herdr agent list` delegate
  directly without creating workspaces.

Each bare invocation against an already-running server creates a new workspace.
Use explicit Herdr commands when only inspection or control is intended.

## Verification

Run the focused wrapper regression test from the repository root:

```bash
node node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/herdr/open-here.test.ts
```

Check the live configuration:

```bash
herdr config check
```

Then open Git Bash in a folder, run bare `herdr`, and inspect the created pane:

```bash
herdr pane process-info --current
herdr pane current --current
```

Expected results:

- `foreground_processes[0].name` is `bash.exe`;
- `cwd` is the folder from which bare `herdr` was launched.

This workstation was verified with Herdr 0.9.0 using
`C:/Program Files/Git/bin/bash.exe`; a newly created workspace opened at the
requested repository path.

## Rollback

1. Remove `~/bin/herdr` and run `hash -r` in existing Git Bash terminals.
2. Restore the backed-up `%APPDATA%\herdr\config.toml`, or remove the
   `[terminal]` block.
3. Run the real Herdr executable's `config check` and `server reload-config`, or
   restart Herdr.

The current configuration backup is stored beside `config.toml` with the prefix
`config.toml.backup-`. Removing the wrapper does not delete Herdr workspaces or
stop its persistent server.
