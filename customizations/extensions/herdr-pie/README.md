# Herdr integration for `pie`

This extension registers sessions started through the customized `pie` launcher
as the custom Herdr agent `pie`.

## Why this extension exists

On Windows, Herdr identifies the built-in `pi` agent from exact official package
entrypoints such as `pi-coding-agent/dist/cli.js` and
`pi-coding-agent/dist/bundle/cli.js`. This checkout instead runs TypeScript from
`customizations/goated-ai-skills/cli.ts` through `tsx`, so Herdr cannot confirm
it as the built-in agent. Reports from Herdr's managed Pi extension are accepted
but suppressed until that built-in process check succeeds.

This extension uses Herdr's custom-agent reporting interface instead. It reports
`agent: pie` from the stable source `custom:pie`, including session identity and
`idle`, `working`, and `blocked` lifecycle states. It releases that authority on
a graceful Pi shutdown.

The extension activates only when all of these values are present:

```text
PIE_CUSTOM=1
HERDR_ENV=1
HERDR_PANE_ID=<Herdr pane id>
HERDR_SOCKET_PATH=<Herdr socket path>
```

The guard prevents globally installed stock `pi` sessions from being claimed as
`pie`.

## Windows installation

The tracked extension remains in this repository. Pi discovers it through a
user-scoped directory junction:

```powershell
$repo = 'P:\Project Files\Programming\pi fork'
$extensionPath = Join-Path $env:USERPROFILE '.pi\agent\extensions\herdr-pie'
New-Item -ItemType Junction `
  -Path $extensionPath `
  -Target (Join-Path $repo 'customizations\extensions\herdr-pie')
```

Both machine-local launchers must set the guard before starting Pi:

```bat
rem %APPDATA%\npm\pie.cmd
set "PIE_CUSTOM=1"
```

```sh
# %APPDATA%/npm/pie
export PIE_CUSTOM=1
```

Back up both launchers before editing them. The launchers are machine-local and
are not tracked by Git.

## Verification

Run the focused extension test from the repository root:

```bash
node node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/extensions/herdr-pie/index.test.ts
node node_modules/@typescript/native-preview/bin/tsgo.js --project customizations/tsconfig.json --noEmit
```

Then start a fresh `pie` process inside a Herdr pane and inspect the live agent
list from another pane:

```bash
herdr agent list
```

The new pane should contain:

```text
agent: pie
agent_status: idle
```

Submit a prompt to observe `working`, then wait for completion to observe
`idle`. Exit gracefully with `Ctrl+D`; the pane should disappear from
`herdr agent list`.

## Troubleshooting

If the pane remains `unknown`:

1. Start a new `pie` process; an existing process does not inherit launcher
   changes or newly installed extensions.
2. Confirm the launcher exported `PIE_CUSTOM=1`.
3. Confirm `HERDR_ENV`, `HERDR_PANE_ID`, and `HERDR_SOCKET_PATH` exist inside
   the session.
4. Confirm the junction targets this repository's
   `customizations/extensions/herdr-pie` directory.
5. Run the focused test above.

Do not edit `~/.pi/agent/extensions/herdr-agent-state.ts`. Herdr owns and may
overwrite that managed integration.

## Rollback

Exit active `pie` sessions, remove the `herdr-pie` junction, and remove the
`PIE_CUSTOM=1` lines from both launchers. Restore backed-up launchers if
available. Stock `pi` and Herdr's managed Pi integration are unaffected.
