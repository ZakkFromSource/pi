# Pi Fork Customizations

This directory contains the customizations maintained on top of the upstream
[Pi](https://github.com/earendil-works/pi) project. The Git repository is the
source of truth for customized source code and extensions.

## Repository layout

| Path or command | Purpose |
| --- | --- |
| `packages/` | Upstream Pi packages and customized application source |
| `customizations/extensions/unsloth/` | Version-controlled Unsloth provider extension |
| `customizations/extensions/herdr-pie/` | Reports source-launched `pie` sessions as a custom Herdr agent |
| `customizations/herdr/` | Configures Git Bash panes and cwd-aware bare Herdr launches |
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

They set `PIE_CUSTOM=1` so the tracked
[Herdr `pie` integration](extensions/herdr-pie/README.md) activates only for
this source launcher. The launchers contain an absolute path and are not
committed to the repository.
They must be updated if the repository is moved or renamed.

They also select a dedicated Node 22.23.2 LTS runtime through `PIE_NODE` to
avoid a reproduced native string-comparison crash in Windows Node 24.21.0.
The runtime lives under `%USERPROFILE%\.pi\pie`, where normal terminals can
access it without the desktop app's AppData redirection.
See [runtime diagnosis and setup](node-runtime.md) for the evidence, runtime
location, verification steps, and launcher backups.

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

## Herdr `pie` agent integration

Herdr recognizes stock Pi on Windows from exact official package entrypoints.
The `pie` launcher instead runs this checkout's TypeScript entrypoint through
`tsx`, so Herdr cannot classify it as the built-in `pi` process. The tracked
extension at `customizations/extensions/herdr-pie` reports it through Herdr's
custom-agent interface as `pie`.

The live global extension path is a Windows directory junction:

```text
~/.pi/agent/extensions/herdr-pie
  -> customizations/extensions/herdr-pie
```

The extension requires both `PIE_CUSTOM=1` from the machine-local launcher and
Herdr's inherited pane variables. Stock `pi` sessions therefore continue using
Herdr's managed `pi` integration without being claimed as `pie`.

From another Herdr pane, verify a newly started `pie` process with:

```bash
herdr agent list
```

It should appear as `pie` with `idle`, `working`, or `blocked` state. Exit it
with `Ctrl+D` and confirm it leaves the list. See the
[integration guide](extensions/herdr-pie/README.md) for installation,
troubleshooting, focused tests, and rollback.

## Herdr Git Bash shell and open-here behavior

The user-level Herdr configuration selects non-login Git Bash for newly created
panes. A tracked wrapper installed at `~/bin/herdr` makes bare `herdr` calls
from Git Bash create and focus a workspace at the invoking directory before
attaching to the persistent session. Explicit Herdr commands and calls from
inside a managed pane remain side-effect free.

See [Herdr Git Bash setup](herdr/README.md) for the diagnosis, configuration,
wrapper installation, focused test, live verification, and rollback procedure.

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

`upstream/main`, local `main`, and `origin/main` are three separate references:

- `upstream/main` records the latest upstream Pi commit downloaded to this
  computer;
- local `main` is this checkout's clean copy of upstream Pi; and
- `origin/main` is the `main` branch visible in the GitHub fork.

Updating one does not automatically update the others. The procedure below
moves the same upstream changes through all three places, then merges them into
`custom/pie`.

Use a merge for routine updates. A merge keeps the existing customization
commits unchanged and does not require a force push. This is safer and easier
to recover than rebasing a branch that has already been pushed to GitHub.

Close any running `pie` session before starting. Changing branches temporarily
changes the source files used by the `pie` launcher.

### 1. Protect the current customization work

Start on `custom/pie` and confirm there are no uncommitted changes:

```bash
git switch custom/pie
git status
```

`git status` should report that the working tree is clean. If it lists modified
or untracked files, review and commit the intended work before continuing. Do
not begin an upstream update while unrelated work is unfinished.

Push the current branch before merging the update:

```bash
git push
```

This leaves the current working version recoverable on GitHub until the tested
merge is pushed later.

### 2. Download the latest upstream history

```bash
git fetch upstream
```

`git fetch` downloads new commits and updates `upstream/main`. It does not edit
the working files, update local `main`, or change the GitHub fork.

Optionally preview the incoming commits:

```bash
git log --oneline main..upstream/main
```

An empty result means local `main` already contains the fetched upstream
commits.

### 3. Fast-forward local `main`

```bash
git switch main
git merge --ff-only upstream/main
```

`--ff-only` updates local `main` only when it can move straight forward to the
upstream commit. It refuses to create a merge or discard unexpected local work.
Local customization commits should never be made on `main`; they belong on
`custom/pie`.

If this command refuses to fast-forward, stop and inspect the branch history.
Do not force the update, because local `main` may contain a commit that needs to
be understood first.

### 4. Update the fork's `main` branch

```bash
git push origin main
```

This copies the newly updated local `main` to `origin/main` in the GitHub fork.
At this point, the fork's `main` mirrors the downloaded upstream version, while
`custom/pie` still contains the previous upstream version plus the
customizations.

### 5. Merge upstream changes into `custom/pie`

```bash
git switch custom/pie
git merge main
```

Git now combines the updated upstream source from `main` with the customization
commits on `custom/pie`.

- If the changes affect different files or lines, Git merges them
  automatically.
- If both branches changed the same area, Git pauses and reports a merge
  conflict. Follow the conflict procedure below.
- If Git reports `Already up to date`, there were no new upstream changes to
  merge.

Do not run `pie` until the merge has completed or been aborted. During an
unfinished merge, source files can contain conflict markers and are not a valid
working version.

### 6. Refresh dependencies and generated model data

After the merge completes, run:

```bash
npm install --ignore-scripts
npm run hydrate:model-data
```

The first command brings `node_modules` into line with the updated lock file.
The second regenerates the provider model data used by the source checkout.
Running both after every upstream update is safe and avoids having to determine
whether that particular update changed either input.

### 7. Review and verify the combined version

First review what remains custom compared with the updated upstream branch:

```bash
git diff --stat main...custom/pie
git diff main...custom/pie
git log --oneline main..custom/pie
```

The first command gives a short file summary. The second shows the full
customization diff. The third lists commits that exist only on `custom/pie`.

Then run the project checks and focused customization tests:

```bash
npm run check
node node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/extensions/unsloth/index.test.ts
pie --version
pie --list-models unsloth
```

Also start `pie` and manually check the customized footer and the Unsloth model
selection. Automated checks can find source and type errors, but this short
smoke test confirms that the customized behavior still works in the terminal.

If a check fails because of the upstream update, fix and commit that adaptation
on `custom/pie`. Do not modify `main` to make a customization work.

### 8. Push the successfully updated customization branch

After all checks and the manual smoke test pass:

```bash
git push origin custom/pie
```

Because this workflow uses a merge, an ordinary push is sufficient. Do not use
`--force` or `--force-with-lease` for this maintenance workflow.

## Resolving merge conflicts

A conflict means upstream Pi and `custom/pie` changed overlapping code and Git
cannot safely choose the final result. It does not mean either branch is lost.
Git pauses the merge so the combined code can be reviewed.

### Identify the conflicts

```bash
git status
git diff --name-only --diff-filter=U
```

`git status` explains that a merge is in progress. The second command lists
only files that are still unresolved.

### Resolve each file

Open each conflicted file in an editor. Git surrounds the disputed code with a
line containing `<<<<<<< HEAD`, a separator line containing `=======`, and an
ending line such as `>>>>>>> main`. The code above the separator comes from
`custom/pie`; the code below it comes from the updated `main` branch.

Edit the section into the final code that should remain, then remove all three
marker lines. Usually the correct result preserves the purpose of the custom
code while adapting it to the updated upstream structure; it may not be an
unchanged copy of either side.

Review the surrounding function or module before deciding. If an upstream
change renamed an API, moved logic, or fixed a bug, carry that new behavior
into the customization rather than blindly keeping the old custom block.

Confirm that no marker was left behind:

```bash
git diff --check
```

### Mark resolved files and finish the merge

Stage only the files that have been deliberately resolved:

```bash
git add path/to/resolved-file.ts
git status
```

Repeat for every conflicted file. When `git status` reports no unresolved
paths, finish the merge:

```bash
git merge --continue
```

Git may open an editor containing the prepared merge commit message. Keep the
message, save the file, and close the editor. Then perform all dependency,
review, test, and smoke-test steps from the update procedure above.

### Abort when the correct result is unclear

If the conflict cannot be resolved confidently, return to the exact state from
before `git merge main`:

```bash
git merge --abort
```

Aborting is safe and preferable to guessing. It does not remove the upstream
commits already downloaded or the update made to `main`; it only cancels their
merge into `custom/pie`. The conflict can be investigated and attempted again
later.

Never commit files that still contain conflict markers. Never solve an
unfamiliar conflict by choosing all of one side without first checking which
custom behavior or upstream fix that choice would discard.

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
- Source-launched `pie` sessions report lifecycle state to Herdr as the custom
  `pie` agent without changing stock `pi` detection.
- New Herdr panes use Git Bash, and bare Git Bash launches open a focused Herdr
  workspace at the invoking directory.
- The Unsloth provider extension is maintained in the repository and advertises
  verified native context limits before a model is loaded.
- Focused regression tests cover the customized footer and Unsloth context
  behavior.
- Custom TypeScript includes beginner-oriented comments for non-obvious logic.
