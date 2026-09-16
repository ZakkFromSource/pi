# Recreate the `pie` and Herdr setup on Windows

This guide is for recreating the customized `pie` source launcher and its Herdr
integration after cloning this repository onto another Windows machine.

The procedure is source-backed by the tracked launchers, extensions, tests, and
current workstation configuration. It has been verified incrementally on
Windows 11 with Herdr 0.9.0, but has not yet been replayed from beginning to end
on a clean machine.

## Scope and privacy

This guide configures files under the current user's profile. It does not copy
credentials, API keys, sessions, machine names, account names, or the original
workstation's private paths.

Use placeholders such as `C:/path/to/pi` for the clone. Do not commit any files
from `~/.pi/agent/auth.json`, session directories, provider credentials, or
machine-local Herdr state.

The tested launcher and shell configuration are Windows-specific. The
`herdr-pie` extension supports Windows named pipes and Unix sockets, but Linux
installation and launcher behavior remain unverified.

## Prerequisites

Install these before starting:

- Windows 11;
- Git for Windows, including Git Bash at the default
  `C:/Program Files/Git/bin/bash.exe` path;
- Node.js and npm satisfying the repository's declared engine requirements;
- Herdr;
- the global Pi release if the fallback `pi` command is wanted; and
- a clone of this repository with the `custom/pie` branch checked out.

The setup does not require administrator access when the current account can
create a directory junction under its own profile.

## 1. Prepare the source checkout

In PowerShell, choose the clone path and enter it:

```powershell
$Repo = 'C:\path\to\pi'
Set-Location -LiteralPath $Repo
git switch custom/pie
```

In Git Bash, the same path uses Git's drive notation:

```bash
cd '/c/path/to/pi'
git status
```

Install the repository dependencies without lifecycle scripts, hydrate public
model metadata, and run the standard checks:

```bash
npm install --ignore-scripts
npm run hydrate:model-data
npm run check
```

Credentials are configured separately through Pi's normal authentication
commands. Do not copy another machine's credential files into the repository.

## 2. Install the tested Node runtime workaround

The tested Windows setup uses Node 22.23.2 from:

```text
%USERPROFILE%\.pi\pie\runtimes\node-v22.23.2-win-x64\node.exe
```

Follow [the runtime download, checksum, and installation procedure](node-runtime.md#recreate-or-update-the-workstation-setup)
before creating the launchers below. That guide owns the runtime version,
checksum, diagnostics, and update procedure.

A different supported Node version can be selected with `PIE_NODE`, but it has
not received the same crash-reproduction testing.

## 3. Create the `pie` launchers

The launchers are intentionally machine-local because they contain the clone
path. Create `%APPDATA%\npm` if it does not already exist. Back up existing
`pie` and `pie.cmd` files before replacing them.

Replace every `C:/path/to/pi` below with the clone's absolute path using forward
slashes.

### PowerShell and Command Prompt launcher

Create `%APPDATA%\npm\pie.cmd` with this complete content:

```bat
@echo off
setlocal
rem Run the version-controlled Pi source checkout through Git Bash.
rem Keep the tested runtime outside AppData, which packaged apps can redirect.
if not defined PIE_NODE set "PIE_NODE=%USERPROFILE:\=/%/.pi/pie/runtimes/node-v22.23.2-win-x64/node.exe"
set "PIE_CUSTOM=1"
rem %* forwards every argument supplied after the "pie" command.
"C:\Program Files\Git\bin\bash.exe" "C:/path/to/pi/pi-test.sh" %*
```

### Git Bash launcher

Create the extensionless `%APPDATA%\npm\pie` file with this complete content:

```sh
#!/bin/sh

# Git Bash uses this extensionless launcher instead of pie.cmd.
# Keep the tested runtime outside AppData, which packaged apps can redirect.
: "${PIE_NODE:=$HOME/.pi/pie/runtimes/node-v22.23.2-win-x64/node.exe}"
export PIE_NODE
export PIE_CUSTOM=1
# "$@" forwards every argument to Pi's source runner.
exec "C:/Program Files/Git/bin/bash.exe" "C:/path/to/pi/pi-test.sh" "$@"
```

From Git Bash, make the extensionless launcher executable and refresh command
lookup:

```bash
chmod +x "$APPDATA/npm/pie"
hash -r
command -v pie
pie --version
```

Expected result: `command -v pie` resolves under the current user's roaming npm
directory and `pie --version` prints the source checkout's Pi version.

## 4. Link the tracked Herdr extension

Pi discovers global extensions under `~/.pi/agent/extensions`. Keep the
extension source in Git and create a Windows directory junction to it.

Run in PowerShell, adjusting `$Repo` if this is a new shell:

```powershell
$Repo = 'C:\path\to\pi'
$Extensions = Join-Path $env:USERPROFILE '.pi\agent\extensions'
$HerdrPie = Join-Path $Extensions 'herdr-pie'
New-Item -ItemType Directory -Force -Path $Extensions | Out-Null
if (Test-Path -LiteralPath $HerdrPie) {
    throw "Refusing to replace existing path: $HerdrPie"
}
New-Item -ItemType Junction `
    -Path $HerdrPie `
    -Target (Join-Path $Repo 'customizations\extensions\herdr-pie')
```

Do not edit Herdr's managed `herdr-agent-state.ts`. The tracked custom extension
uses the separate agent label `pie` and activates only when the launcher exports
`PIE_CUSTOM=1`.

## 5. Configure Herdr to use Git Bash

Back up `%APPDATA%\herdr\config.toml`. Merge this section into the existing
file rather than replacing unrelated settings:

```toml
[terminal]
default_shell = "C:/Program Files/Git/bin/bash.exe"
shell_mode = "non_login"
new_cwd = "follow"
```

Validate the file and reload a running Herdr server:

```bash
herdr config check
herdr server reload-config
```

Existing panes retain their original shell. Only newly created panes,
workspaces, and tabs use the updated terminal settings.

## 6. Install cwd-aware bare `herdr` behavior

Herdr is persistent: bare `herdr` normally attaches to the existing focused
workspace instead of using the invoking terminal's current directory. Install
the tracked wrapper earlier on Git Bash's `PATH`:

```bash
mkdir -p "$HOME/bin"
install -m 755 customizations/herdr/open-here.sh "$HOME/bin/herdr"
hash -r
command -v herdr
```

The expected path is `$HOME/bin/herdr`. The wrapper delegates to Herdr's stable
`~/.herdr/packages/standalone/current/herdr.exe` path, so normal Herdr binary
updates continue to apply.

A bare `herdr` outside Herdr creates and focuses a workspace at `$PWD` before
attaching. Explicit commands such as `herdr status` and commands run inside a
managed pane do not create workspaces.

## 7. Verify the complete setup

Run the focused tests and type check from the repository root:

```bash
node node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/extensions/herdr-pie/index.test.ts customizations/herdr/open-here.test.ts
node node_modules/@typescript/native-preview/bin/tsgo.js --project customizations/tsconfig.json --noEmit
npm run check
```

Then perform this manual acceptance check:

1. Open Git Bash in a test directory.
2. Run bare `herdr`.
3. Confirm the new pane is Git Bash and its prompt shows the test directory.
4. Run `pie` in that pane.
5. From another Herdr pane, run `herdr agent list`.
6. Confirm an agent named `pie` appears as `idle` or `working`.
7. Exit `pie` gracefully with `Ctrl+D`.
8. Confirm that pane no longer appears in `herdr agent list` as an active agent.

Useful diagnostics:

```bash
herdr pane process-info --current
herdr pane current --current
herdr integration status
```

## Troubleshooting

### `pie` is not found in Git Bash

```bash
hash -r
command -v pie
printf '%s\n' "$PATH"
```

Confirm `%APPDATA%\npm` is on `PATH` and that the extensionless launcher exists.

### `pie` starts but does not appear in Herdr

Start a fresh `pie` process after changing launchers or extensions. Confirm the
following values exist inside that process:

```bash
env | grep -E '^(PIE_CUSTOM|HERDR_ENV|HERDR_PANE_ID|HERDR_SOCKET_PATH)='
```

Confirm the `herdr-pie` junction targets the current clone and rerun the focused
extension test.

### New panes still use PowerShell

Run `herdr config check` and `herdr server reload-config`, then create a new
pane or workspace. Existing panes do not change shells in place.

### Bare `herdr` opens the previous directory

Confirm Git Bash resolves the tracked wrapper copy first:

```bash
command -v herdr
```

It should resolve to `$HOME/bin/herdr`, not directly into `.herdr/packages`.

## Rollback

1. Exit active `pie` sessions.
2. Restore the backed-up `%APPDATA%\npm\pie` and `pie.cmd` launchers, or remove
   them if they did not exist previously.
3. Remove the `~/.pi/agent/extensions/herdr-pie` junction.
4. Remove `$HOME/bin/herdr` and run `hash -r`.
5. Restore the backed-up Herdr config or remove the `[terminal]` section, then
   reload or restart Herdr.
6. Restore the previous `PIE_NODE` selection if the runtime was changed.

These actions do not delete Pi credentials, sessions, Herdr workspaces, or the
repository clone.

## Linux status

The lifecycle extension already selects Unix sockets outside Windows. The rest
of this guide is not portable as written: it assumes Windows launcher files,
Git for Windows, a directory junction, `herdr.exe`, and a Windows Git Bash path.

A Linux procedure would need separate verified launcher, symlink, default-shell,
and Herdr executable instructions. Until that is tested, treat Linux support as
an implementation candidate rather than a supported setup.
