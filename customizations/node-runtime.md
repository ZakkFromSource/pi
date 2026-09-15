# `pie` runtime and the Windows string crash

## Current workaround

The Windows `pie` launchers select a dedicated **Node 22.23.2 LTS** executable:

```text
%USERPROFILE%\.pi\pie\runtimes\node-v22.23.2-win-x64\node.exe
```

`pi-test.sh` accepts `PIE_NODE`, an executable path, and runs the installed
`tsx` CLI through it. `tsx` starts Pi with the same Node executable. When
`PIE_NODE` is absent, the source runner uses `node` from `PATH`.

Both `%APPDATA%\npm\pie.cmd` and `%APPDATA%\npm\pie` set the dedicated runtime
as their default while honoring an explicit `PIE_NODE` override. This takes
effect in newly started `pie` processes. The system Node installation and the
globally installed `pi` launcher retain their existing configuration.

## Diagnosis: 2026-09-15

Pi aborted while the user was typing an unsent response. The reported check was
`(location_) != nullptr`, with no JavaScript exception. The installed runtime was
Windows x64 Node 24.21.0, V8 `13.6.233.17-node.53`. Its SHA-256 matched the
[official Node release checksums](https://nodejs.org/dist/v24.21.0/SHASUMS256.txt).

The names printed in the Windows stack trace were nearby exported symbols.
Resolving the addresses with the matching official Node PDB gave:

```text
node::NodePlatform::GetStackTracePrinter::<lambda_3>::__invoke
V8_Fatal
v8::internal::String::SlowFlatten<DirectHandle>
v8::internal::String::SlowEquals                 string.cc:1330
v8::internal::Runtime_StringEqual                runtime-strings.cc:386
```

V8, Node's JavaScript engine, failed while converting a concatenated string
into flat storage for an equality comparison. Pi's renderer repeatedly joins
terminal reset sequences to lines and compares successive frames, including
while the input editor is active. This is valid JavaScript behavior.

The [standalone reproduction](../scripts/repro-node-string-crash.mjs) only
constructs and compares synthetic strings. It loads no Pi code, extensions,
model providers, or third-party modules. On the affected runtime it reproduced
the exact assertion and the first five stack frames from the reported crash.
The problem is therefore reproducible within the Node/V8 runtime independently
of Pi. The specific upstream engine defect has not been identified or patched.

### Runtime comparison

Each attempt compared 300 lines across 100,000 frames, using the same process
flags below. All three downloaded runtime binaries were checked against their
official release SHA-256 values.

| Windows x64 runtime | Initial three-attempt comparison |
| --- | --- |
| Node 24.21.0 | One 45-second timeout; two aborts with the reported assertion |
| Node 22.23.2 LTS | Three passes |
| Node 26.8.2 | Three passes |

Later Node 24.21.0 runs also passed. The crash is intermittent, so a single
successful run does not rule it out. The initial raw results and minimal
prototype are retained under `%USERPROFILE%\.pi\pie\diagnostics\20260915`.

Node 22.23.2 meets the repository's `>=22.19.0` requirement. It also passed a
synthetic 30,000-keystroke run through Pi's editor and main-screen renderer.
This is a tested runtime workaround; a long interactive session can exercise
additional behavior beyond these checks.

Relevant upstream implementation:
[string flattening](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/objects/string-inl.h#L714),
[string equality](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/objects/string.cc#L1284).

## Launcher repair: AppData redirection

The initial runtime installation used `%LOCALAPPDATA%\pie`. Windows redirected
that new directory into the packaged desktop app's private storage:

```text
%LOCALAPPDATA%\Packages\<CodexPackageFamily>\LocalCache\Local\pie
```

Processes launched from the desktop app could see the redirected files. Normal
Git Bash sessions could not, so both `pie --version` and `pie install` failed
with `node.exe: No such file or directory` before npm started. The npm version
had not changed. This is Windows
[MSIX AppData virtualization](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization).

The runtime, installation record, diagnostic evidence, and launcher backups
now live under `%USERPROFILE%\.pi\pie`, outside AppData. Both launchers point
there. `GetFinalPathNameByHandleW` confirmed that the new executable's physical
path matches the shared path, whereas the old path resolved inside the desktop
app package. For future setup changes, verify the physical path or launch from
an independent terminal; child processes can inherit the app's redirected view.

After relocation, the Git Bash launcher successfully installed and registered
`npm:cc-safety-net` version 2.4.1, with npm lifecycle scripts disabled for that
verification run. The user also confirmed that `pie --version` returned
`0.85.1` in the original failing Git Bash window. npm remained at version
11.19.0.

## Reproduce before changing the runtime pin

From the repository root, run the script with an explicit candidate Node
executable. These flags increase garbage-collection pressure to reproduce the
failure sooner; they are diagnostic settings and are not part of the launcher.
Run each candidate three times. The affected runtime may abort or hang; stop an
attempt if it has not finished after 45 seconds.

```powershell
$pieRuntime = Join-Path $env:USERPROFILE '.pi\pie\runtimes\node-v22.23.2-win-x64\node.exe'
& $pieRuntime --max-semi-space-size=1 --max-old-space-size=128 --no-parallel-scavenge scripts/repro-node-string-crash.mjs
```

Then run focused tests and the required repository checks:

```powershell
& $pieRuntime --test packages/tui/test/editor.test.ts packages/tui/test/tui-render.test.ts
& $pieRuntime node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/goated-ai-skills/integration.test.ts customizations/extensions/unsloth/index.test.ts
npm run check
pie --version
```

The launcher regression checks cover selecting a runtime whose path contains
spaces, argument boundaries, exit status, and `--no-env`. The real launchers
were also checked with a temporary preload that reported `process.execPath`
from both `tsx` and Pi; each used the dedicated Node 22.23.2 executable.

## Recreate or update the workstation setup

The portable runtime and machine-local launchers are outside Git. Their setup
record is `installation.json` beside the dedicated `node.exe`.

Scope: the current Windows x64 user and this source checkout. The download,
checksum, runtime installation, launcher backups, launcher changes, and checks
were verified here. Recreating them on another workstation remains a manual
procedure with local paths to adjust.

1. Download the [official Node 22.23.2 Windows x64 executable](https://nodejs.org/dist/v22.23.2/win-x64/node.exe)
   to a temporary file. Verify its SHA-256 against the `win-x64/node.exe` entry
   in the [official checksums](https://nodejs.org/dist/v22.23.2/SHASUMS256.txt)
   before executing it. The verified value for this release is:

   ```text
   0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4
   ```

2. Place the verified file at the runtime path above. Keep each future version
   in a separate directory so the previous executable remains available.
3. Back up both `pie` launchers before editing them. In `pie.cmd`, add `setlocal`
   after `@echo off`, and add this before the existing Bash command:

   ```bat
   if not defined PIE_NODE set "PIE_NODE=%USERPROFILE:\=/%/.pi/pie/runtimes/node-v22.23.2-win-x64/node.exe"
   ```

4. In the extensionless `pie` shell script, add this before its existing `exec`
   command, substituting the actual absolute path and using forward slashes:

   ```sh
   : "${PIE_NODE:=C:/Users/YOUR_USER/.pi/pie/runtimes/node-v22.23.2-win-x64/node.exe}"
   export PIE_NODE
   ```

5. Run the reproduction and checks above, then start a fresh `pie` process.
   Use `pie -c` to continue the most recent saved session in the current project,
   or `pie -r` to select a saved session.

The original launchers from before the runtime workaround are backed up under
`%USERPROFILE%\.pi\pie\launcher-backups\20260915-035041`. To roll back the runtime
selection, restore those two files to `%APPDATA%\npm`. The separate
`20260915-124441` backup contains the superseded AppData launchers; restoring
those would reintroduce the terminal visibility problem. An explicit `PIE_NODE`
override can select another tested executable without editing the launchers.
Review future supported Node releases and repeat the reproduction before
updating this pin.
