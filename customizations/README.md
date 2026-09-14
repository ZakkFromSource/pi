# Local Pi customizations

This directory stores local Pi customizations that should be version-controlled.
The Git repository is the authoritative copy: edit and commit files here rather
than editing the globally installed npm package.

## How the two Pi commands are used

- `pi` continues to run the globally installed npm release. It is a useful
  fallback if the source checkout is temporarily broken.
- `pie` runs `pi-test.sh` from this repository, so it uses the source code from
  whichever branch is currently checked out here.

The `pie` command is a small machine-local launcher and is intentionally not
stored in this cross-platform repository because its path depends on where the
checkout lives on a particular computer.

## Unsloth extension

The tracked source lives in `customizations/extensions/unsloth`. The normal Pi
extension location is linked to this directory. This means both `pi` and `pie`
load the version-controlled files while edits and Git history remain in one
place.

Do not put API keys or other credentials in this directory. Pi's credential
store remains outside the repository.

## Setup after cloning on another computer

1. Install the repository dependencies with `npm install --ignore-scripts`.
2. Generate the ignored model data with `npm run hydrate:model-data`.
3. Verify the checkout with `npm run check`.
4. Create a local `pie` launcher that invokes this checkout's `pi-test.sh`
   through Git Bash and forwards all command-line arguments.
5. Link Pi's global `extensions/unsloth` directory to the tracked extension
   directory above. Back up an existing directory before replacing it.

When upstream Pi changes, update local `main`, switch back to the customization
branch, and rebase that branch onto `main`. Resolve and test any conflicts before
continuing to use `pie`.
