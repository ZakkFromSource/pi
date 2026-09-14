# Pi Fork Customizations

This directory contains the customizations maintained on top of the upstream
[Pi](https://github.com/earendil-works/pi) project. The Git repository is the
source of truth for customized source code and extensions.

## Repository layout

| Path or command | Purpose |
| --- | --- |
| `packages/` | Upstream Pi packages and customized application source |
| `customizations/extensions/unsloth/` | Version-controlled Unsloth provider extension |
| `customizations/goated-ai-skills/` | Pinned GOATED runtime skills, Pi adapter, and integration notes |
| `pie` | Runs Pi from the currently checked-out repository source |
| `pi` | Runs the globally installed npm release as a fallback |
| `~/.pi/agent/` | Stores local settings, credentials, sessions, and extension links |

The repository does not replace `~/.pi`. Local state and credentials remain
outside version control.

## Prerequisites

- Git and Git Bash
- Node.js and npm
- Access to the drive containing the repository
- An internet connection when installing dependencies or hydrating model data

## Working from the repository root

Unless stated otherwise, run all project commands from the repository root:

```text
P:\Project Files\Programming\pi fork
```

Navigate there from PowerShell with:

```powershell
Set-Location -LiteralPath 'P:\Project Files\Programming\pi fork'
```

Navigate there from Git Bash with:

```bash
cd '/p/Project Files/Programming/pi fork'
```

Confirm the location and active branch with:

```bash
git status
```

The customization branch is `custom/pie`.

## Initial setup

### Install dependencies

```bash
npm install --ignore-scripts
```

This command reads the repository's package manifests and lock file, then
installs the required JavaScript and TypeScript packages into the local
`node_modules` directory. It is similar to installing a Python project's locked
dependencies into a virtual environment.

The command affects only this source checkout. It does not reinstall the global
`pi` command or copy files into `~/.pi`.

`--ignore-scripts` prevents dependencies from running installation lifecycle
scripts automatically. This checkout has been verified with that option.

Run this command:

- after cloning the repository;
- when the dependency lock file changes; or
- after an upstream update that changes dependencies.

### Hydrate model data

```bash
npm run hydrate:model-data
```

Pi uses generated data describing models offered by its supported providers.
This command downloads current public provider information and generates the
model-data files required by the source checkout.

The generated files are excluded from Git because they can be recreated. They
should not be staged or committed.

Run this command:

- after cloning the repository;
- when provider data is missing;
- after relevant upstream changes; or
- when `npm run check` reports missing model data.

### Validate the checkout

```bash
npm run check
```

This command runs the repository's standard quality checks, including:

- formatting and code-style checks;
- TypeScript type checking;
- dependency and import validation;
- package lock and entry-point checks; and
- browser compatibility checks.

The formatter may correct formatting automatically. Run `git status` afterward
and review any resulting changes before committing them.

A successful check returns to the terminal prompt without an error or npm
failure message.

## The `pie` source launcher

`pie` runs the repository's `pi-test.sh` script and forwards all command-line
arguments to Pi. This makes the checked-out source directly executable without
overwriting the globally installed npm release.

The workstation uses two machine-local launchers:

| Launcher | Shell |
| --- | --- |
| `%APPDATA%\npm\pie.cmd` | PowerShell and Command Prompt |
| `%APPDATA%\npm\pie` | Git Bash |

Both launchers currently target:

```text
P:\Project Files\Programming\pi fork\pi-test.sh
```

The launchers contain an absolute path and are not committed to the repository.
They must be updated if the repository is moved or renamed.

Verify the launcher with:

```bash
pie --version
```

Start the customized agent with:

```bash
pie
```

The `pie` command always uses the branch currently checked out in this
repository. Keep `custom/pie` checked out during normal use.

## Unsloth extension link

The tracked Unsloth extension is stored at:

```text
customizations/extensions/unsloth
```

Pi normally loads global extensions from `~/.pi/agent/extensions`. The live
`unsloth` path is a Windows directory junction targeting the tracked directory.
A directory junction appears to applications as a normal folder while its
contents remain in another location.

This link provides the following behavior:

- extension edits are made in the Git repository;
- both `pi` and `pie` load the tracked extension;
- Git records the extension's history; and
- no manual copying is required after each change.

The original extension directory was preserved under:

```text
~/.pi/agent/extension-backups/
```

Credentials must remain in Pi's credential store. Never add API keys, tokens,
or other secrets to the tracked extension files.

## Development workflow

### 1. Check the working state

```bash
git status
```

Confirm that the active branch is `custom/pie`. Review or commit existing
changes before starting unrelated work.

### 2. Edit the relevant source

- Application changes belong under `packages/`.
- Unsloth provider changes belong under
  `customizations/extensions/unsloth/`.

Restart a running Pi session when required to load changed source files.

### 3. Review the changes

```bash
git status
git diff
```

`git status` lists changed files. `git diff` displays the exact line-by-line
changes that have not yet been staged.

### 4. Test the customized version

Run the affected behavior through `pie`, then run the repository checks:

```bash
pie
npm run check
```

Run focused tests for the affected feature when available.

Run the Unsloth provider regression test with:

```bash
node node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/extensions/unsloth/index.test.ts
```

### 5. Commit the changes

Stage each intended file explicitly:

```bash
git add packages/coding-agent/src/modes/interactive/components/footer.ts
git add customizations/extensions/unsloth/index.ts
```

Create a descriptive commit:

```bash
git commit -m "feat(coding-agent): describe the customization"
```

Avoid `git add .`; it may include unrelated files that were not reviewed.

### 6. Push the branch to GitHub

For the first push of the customization branch:

```bash
git push -u origin custom/pie
```

For later commits:

```bash
git push
```

A commit records work locally. A push copies those commits to the GitHub fork.

## Updating from upstream Pi

The repository has two Git remotes:

| Remote | Repository |
| --- | --- |
| `upstream` | Original `earendil-works/pi` project |
| `origin` | `ZakkFromSource/pi` fork |

Begin only when `git status` reports a clean working tree.

### 1. Update the local `main` branch

Remain on the customization branch and run:

```bash
git fetch upstream main:main
```

This downloads upstream `main` directly into the local `main` branch. Remaining
on the customization branch also keeps the tracked extension directory present
throughout the update.

### 2. Rebase the customization branch

```bash
git rebase main
```

A rebase reapplies the customization commits after the newest upstream commits.
The resulting history shows the current upstream code followed by the local
customizations.

### 3. Refresh generated and installed files

```bash
npm install --ignore-scripts
npm run hydrate:model-data
```

This synchronizes local dependencies and regenerates model data for the updated
source.

### 4. Verify the updated version

```bash
npm run check
pie --version
pie --list-models unsloth
git diff main...HEAD
```

The final command displays the complete customization difference relative to
upstream `main`.

### 5. Update the GitHub branches

Rebase changes commit identifiers. If the customization branch was previously
pushed, update it with:

```bash
git push --force-with-lease origin custom/pie
```

`--force-with-lease` refuses to overwrite unexpected remote work and is safer
than an unrestricted force push.

Update the fork's `main` branch without checking it out:

```bash
git push origin main
```

## Resolving rebase conflicts

A conflict occurs when upstream and the customization branch change the same
part of a file.

1. Run `git status` to identify conflicted files.
2. Open each file and resolve the sections marked by `<<<<<<<`, `=======`, and
   `>>>>>>>`.
3. Stage each resolved file with `git add <path>`.
4. Continue with `git rebase --continue`.
5. Repeat until the rebase completes.
6. Run the full update verification commands again.

Cancel the rebase and restore its starting state with:

```bash
git rebase --abort
```

## Troubleshooting

### Git Bash cannot find `pie`

Refresh Git Bash's command lookup and inspect the launcher:

```bash
hash -r
command -v pie
pie --version
```

The expected launcher path is:

```text
/c/Users/ZakkFromSource/AppData/Roaming/npm/pie
```

Git Bash requires the extensionless `pie` launcher. PowerShell and Command
Prompt use `pie.cmd`.

### `pie` fails after the repository is moved

Update both machine-local launchers to reference the new absolute path to
`pi-test.sh`. Confirm that the drive is mounted before testing the launchers.

### The Unsloth extension is unavailable

Confirm that the customization branch is checked out and that this directory
exists:

```text
P:\Project Files\Programming\pi fork\customizations\extensions\unsloth
```

If the directory exists, inspect the junction at
`~/.pi/agent/extensions/unsloth`. A preserved copy is available under
`~/.pi/agent/extension-backups/` if the junction must be deliberately removed
and restored.

## Current customizations

- Footer context usage displays used tokens, percentage used, and total context
  capacity.
- The `pie` launcher loads the pinned GOATED skills and shared policy through
  a native adapter. See [GOATED integration](goated-ai-skills/README.md) for
  runtime scope, verification, and snapshot updates.
- The Unsloth provider extension is maintained in the repository and advertises
  verified native context limits before a model is loaded.
- Focused regression tests cover the customized footer and Unsloth context
  behavior.
- Custom TypeScript includes beginner-oriented comments for non-obvious logic.
