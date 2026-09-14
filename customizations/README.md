# Local Pi customization guide

This guide is written for someone who is new to Git, npm, and TypeScript. It
explains how this customized Pi installation is arranged, how to use it, and
how to safely keep it up to date.

## The important idea: the repository is the source of truth

The files in this Git repository are the authoritative copies of the custom Pi
source code. Make customizations here and commit them to Git. Do not edit the
generated JavaScript inside the globally installed npm package because those
changes can be lost the next time npm updates that package.

| Location or command | What it is used for |
| --- | --- |
| `P:\Project Files\Programming\pi fork` | The source repository and Git history |
| `pie` | Runs Pi directly from the currently checked-out repository branch |
| `pi` | Runs the globally installed npm release as a fallback |
| `C:\Users\ZakkFromSource\.pi\agent` | Pi's settings, credentials, sessions, and normal extension location |

The repository does **not** replace the whole `.pi` directory. Personal
settings and credentials remain outside Git.

## Opening a terminal in the repository

Yes: commands such as `npm install` must be run with the terminal's current
directory set to the repository root:

```text
P:\Project Files\Programming\pi fork
```

One option is to open that folder in File Explorer, right-click inside it, and
choose the option to open a terminal there. You can also navigate there with a
command.

In PowerShell:

```powershell
Set-Location -LiteralPath 'P:\Project Files\Programming\pi fork'
```

In Git Bash:

```bash
cd '/p/Project Files/Programming/pi fork'
```

You can confirm that you are in the correct place by running:

```bash
git status
```

It should say that you are on the `custom/pi-0.85.1` branch. The prompt may
also show the branch name in parentheses.

## What each setup step does

These steps are needed after a fresh clone. Some of them should also be repeated
after bringing in upstream Pi updates.

### 1. Install the repository dependencies

Run this from the repository root:

```bash
npm install --ignore-scripts
```

Pi's source code depends on other JavaScript and TypeScript packages. This
command reads the dependency information in the repository and downloads the
required versions into its local `node_modules` directory.

This is comparable to installing the dependencies of a Python project from its
lock file. It does **not** replace the globally installed `pi` command, and it
does not copy the repository into `.pi`.

The `--ignore-scripts` option prevents dependencies from automatically running
their installation scripts. The current checkout has been tested successfully
with this safer setting. Run the command again when the dependency lock file
changes after an upstream update.

### 2. Generate the model-data files

Run this from the repository root:

```bash
npm run hydrate:model-data
```

Pi needs generated data describing the models available from its supported AI
providers. Those generated files are intentionally excluded from Git, so they
are not present in a fresh clone.

This command downloads current public model information and generates the local
data files expected by the TypeScript checker and Pi's source runner. It needs
an internet connection. Because the output is generated and Git-ignored, do not
manually commit it.

Run this after a fresh clone, after upstream changes to the model-data system,
or if a check reports that provider data files are missing.

### 3. Check the repository

Run this from the repository root:

```bash
npm run check
```

This is the main project quality check. It checks formatting and code style,
dependency declarations, TypeScript types, imports, package lock data, entry
points, and browser compatibility.

Some formatting checks are allowed to correct formatting automatically. After
the command finishes, run `git status` and inspect any unexpected changes.

A successful run returns to the prompt without an error and without an npm
failure message. Run this before committing TypeScript changes and again after
rebasing onto a newer upstream version.

### 4. Provide the `pie` command

`pie` is a machine-local launcher for the repository's `pi-test.sh` source
runner. It forwards options such as `--version` to Pi.

Two launcher files are currently installed in the npm command directory:

- `pie.cmd` is used by Command Prompt and PowerShell.
- `pie` is the extensionless shell launcher used by Git Bash.

Both launchers point to this repository, so moving or renaming the repository
requires updating them. They are machine-specific and are therefore not stored
in this cross-platform repository.

Verify the launcher in a new PowerShell or Git Bash terminal:

```bash
pie --version
```

### 5. Link the Unsloth extension to Git

The version-controlled Unsloth extension lives here:

```text
customizations/extensions/unsloth
```

Pi normally searches for global extensions under `.pi/agent/extensions`. The
live `unsloth` location is a Windows directory junction pointing to the tracked
directory above. A junction behaves like a directory but redirects programs to
another directory.

This arrangement means:

- the extension is loaded from Pi's normal extension location;
- edits are actually made in the Git repository;
- both `pi` and `pie` see the tracked extension; and
- no repeated manual copying is necessary.

The previous live extension directory was preserved at:

```text
C:\Users\ZakkFromSource\.pi\agent\extension-backups\unsloth-20260914-214123
```

Do not put API keys in the tracked extension. Pi's credential store remains in
`.pi` and outside the repository.

## Everyday customization workflow

### 1. Confirm the correct branch

From the repository root, run:

```bash
git status
```

Make sure it reports `custom/pi-0.85.1`. `pie` runs whichever branch is
currently checked out, so being on `main` would run uncustomized upstream code.

### 2. Edit the repository files

Make changes inside this repository. For example:

- Pi source changes belong under `packages/`.
- Unsloth extension changes belong under
  `customizations/extensions/unsloth/`.

Restart any already-running Pi session when necessary so it loads the updated
source.

### 3. Review and test the changes

Use these commands to see what changed:

```bash
git status
git diff
```

Run Pi from the modified source:

```bash
pie
```

Before committing TypeScript changes, run:

```bash
npm run check
```

Feature-specific tests may also be required depending on what was changed.

### 4. Commit the changes

Stage only the files you intentionally changed. For example:

```bash
git add packages/coding-agent/src/modes/interactive/components/footer.ts
git add customizations/extensions/unsloth/index.ts
```

Then create a commit with a short description:

```bash
git commit -m "feat(coding-agent): describe the customization"
```

Do not use `git add .` because it can accidentally stage unrelated files.

### 5. Back up the branch to GitHub

The first time this branch is pushed, run:

```bash
git push -u origin custom/pi-0.85.1
```

For normal commits made after that, use:

```bash
git push
```

Pushing is what copies the local commits to your GitHub fork. A local commit by
itself is not yet backed up remotely.

## Bringing newer upstream Pi changes into the custom version

Only start an update when `git status` says the working tree is clean. Commit
or intentionally set aside unfinished work first.

The repository has two remotes:

- `upstream` is the original `earendil-works/pi` repository.
- `origin` is the `ZakkFromSource/pi` GitHub fork.

While remaining on the customization branch, download upstream `main` directly
into the local `main` branch:

```bash
git fetch upstream main:main
```

This avoids temporarily checking out `main`, where the tracked customization
directory does not exist. Next, replay the customization commits on top of the
updated `main`:

```bash
git rebase main
```

In simple terms, rebase temporarily lifts off your customization commits,
updates their starting point to the newest Pi code, and then reapplies them.
This produces a clean history where the custom changes appear after upstream.

After a successful rebase, refresh and verify the checkout:

```bash
npm install --ignore-scripts
npm run hydrate:model-data
npm run check
pie --version
pie --list-models unsloth
```

Review the custom difference from upstream with:

```bash
git diff main...HEAD
```

If the customization branch was already pushed before the rebase, its commit
identifiers will have changed. Update the GitHub branch safely with:

```bash
git push --force-with-lease origin custom/pi-0.85.1
```

`--force-with-lease` checks that nobody else changed the remote branch since
you last saw it. It is safer than an unrestricted force push.

You can optionally update the `main` branch in your GitHub fork without
checking it out:

```bash
git push origin main
```

## If a rebase reports conflicts

A conflict means upstream and the customization changed the same part of a
file, so Git needs a human decision about the final version.

1. Run `git status` to list the conflicted files.
2. Open each file and resolve the sections marked with `<<<<<<<`, `=======`,
   and `>>>>>>>`.
3. Stage each resolved file explicitly with `git add <file>`.
4. Continue with `git rebase --continue`.
5. Run the verification commands again when the rebase finishes.

If you are unsure and want to return to the exact pre-rebase state, run:

```bash
git rebase --abort
```

## Troubleshooting `pie`

### Git Bash says `pie: command not found`

Close and reopen Git Bash, then run:

```bash
command -v pie
pie --version
```

`command -v pie` should print:

```text
/c/Users/ZakkFromSource/AppData/Roaming/npm/pie
```

Git Bash requires the extensionless `pie` launcher. PowerShell and Command
Prompt use `pie.cmd`. If one launcher is missing, `pie` may work in one shell
but not another.

### The P: drive or repository moves

Both launchers contain the repository's current absolute path. If the drive is
unavailable, or the folder is renamed or moved, `pie` will fail until both
launchers are updated to the new location.

### The Unsloth extension disappears

Check that the repository is still on the customization branch and that this
directory exists:

```text
P:\Project Files\Programming\pi fork\customizations\extensions\unsloth
```

The preserved backup can be restored if the junction is intentionally removed.
Do not delete the junction or move the backup casually; verify the exact source
and destination first.

## Current customizations

The customization branch currently contains:

- a footer display that shows used context tokens, percentage used, and total
  context-window size;
- the version-controlled Unsloth provider extension;
- a focused footer regression test; and
- beginner-oriented comments explaining the custom TypeScript code.
