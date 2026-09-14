# GOATED AI Skills Integration

The `pie` source launcher loads 37 complete GOATED AI Skills V2 packages and
their shared support files from this directory. The upstream development
fixtures are excluded.

## Sources of truth

- `distribution/skills/` contains the 37 installed skill packages.
- `distribution/stack/` contains these five shared support files:
  - `AGENTS.md`: shared routing, scope, approval, delegation, and proof policy.
  - `goated-stack.yaml`: skill registry and relationships.
  - `schemas/stack-registry.schema.json`: registry format.
  - `templates/work-envelope.md`: optional task-state template.
  - `templates/evidence-entry.md`: optional verification-record template.
- `distribution/LICENSE` preserves the upstream license.
- `cli.ts` delegates to Pi's existing command entry points.
- `extension.ts` supplies skills and the shared policy through native Pi hooks.
- The installed snapshot comes from
  [GOATED AI Skills](https://github.com/ZakkFromSource/goated-ai-skills) at commit
  `46333189b3a2be61b1a6a6ddc1dff19929466530`.

The upstream [integrated-stack decision](https://github.com/ZakkFromSource/goated-ai-skills/blob/46333189b3a2be61b1a6a6ddc1dff19929466530/docs/adr/0002-v2-integrated-stack-foundation.md)
introduced shared policy to coordinate independently usable skills. The stack
is therefore relevant to using GOATED. Its `fixtures/` subtree contains test
scenarios and sample projects for developing GOATED itself; those 129 files
are not needed in this runtime distribution. The retained distribution has
93 files: 87 skill files, five support files, and the license.

## Runtime behavior

- Scope: sessions started through this checkout's `pie` launcher, including
  sessions in other project directories. No global Pi installation is changed.
- `pi-test.sh` passes arguments unchanged to `cli.ts`, which preserves Pi's
  auth, package, config, and experimental command dispatch.
- `resources_discover` adds the skills at startup and `/reload`. Pi lists skill
  names and descriptions; full skill bodies are loaded when used.
- `before_agent_start` appends the shared policy to the composed system prompt.
  Project trust, `SYSTEM.md`, `APPEND_SYSTEM.md`, explicit system-prompt flags,
  and other extensions retain Pi's normal behavior. In particular, an explicit
  `--append-system-prompt` still replaces automatic APPEND_SYSTEM discovery.
- Paths are resolved from the installed extension, independently of the
  current project. The policy identifies the distribution root for agents.
- `pie --no-skills` (or `-ns`) disables both bundled skills and policy for that
  run. `--no-extensions` only disables normal extension discovery; this bundled
  integration remains enabled unless skills are disabled.
- Pi's experimental server/client commands are delegated unchanged. This
  adapter configures local `main()` sessions, not a separately hosted server.

Use native commands such as `/skill:grill-with-docs` to select a skill.
Restart `pie` after changing the launcher or adapter source. `/reload` refreshes
vendored skill files and the shared policy during an existing local session.

## Verify the installation

From the repository root, with the repository's existing Node.js dependencies
and Bash available:

```bash
node node_modules/vitest/dist/cli.js --config packages/coding-agent/vitest.config.ts --run customizations/goated-ai-skills/integration.test.ts
node node_modules/@typescript/native-preview/bin/tsgo.js --project customizations/goated-ai-skills/tsconfig.json --noEmit
npm run check
```

The focused suite checks the distribution boundary, skill discovery, native
skill invocation, prompt composition, project trust, disabling skills, reload,
and actual launcher subcommand dispatch from another directory. It uses Pi's
faux provider and isolated configuration, without real provider requests.
The scoped TypeScript configuration is needed because the root configuration
does not include `customizations/` by default.

## Refresh the snapshot

1. Inspect and validate the intended upstream revision before copying it.
2. Back up the current `distribution/` directory outside the repository.
3. Replace the complete selected skill folders, the five stack files listed
   above, and `LICENSE` from the same upstream revision. Preserve their
   package-relative paths. Do not copy `stack/fixtures/`, upstream root agent
   instructions, development docs, tickets, tests, or maintenance scripts.
   Scripts and references inside a selected skill folder remain part of that
   skill and must be preserved.
4. Update the pinned commit above.
5. Repeat the verification steps and compare source and installed file hashes.

The refresh is manual. No vendored script runs automatically, and no
credentials or machine-wide settings are required. Restore the backup to roll
back an unsuccessful refresh.

## Pi customization research (2026-09-15)

Checked the official Pi documentation and the local Pi 0.85.1 source. These
are optional follow-ups; only the small runtime adapter above is implemented.
Recheck the linked APIs and local examples after upgrading Pi.

| Priority | Suggestion | Reason and tradeoff |
| --- | --- | --- |
| 1 | A `/goated` status and skill selector | Show the installed revision, discovered skills, and active task route. Pi's command and status APIs can make the integration visible without replacing the custom footer. Keep detailed state behind the command to avoid persistent clutter. |
| 2 | Store active task state in the Pi session | Custom session entries can retain scope, decisions, and pending verification across resume and compaction. Restore from the current branch, then supply a concise summary to the model; stored custom entries do not enter model context automatically. Durable project knowledge should still use the project's chosen documents. |
| 3 | An optional scout/reviewer subagent bridge | The GOATED delegation skill supplies instructions, while an extension supplies actual child-agent execution. Pi's example first reuses the current entry point and falls back to `pi`; adapt and test that launch path to preserve this checkout and its TypeScript runtime arguments. Inherit the selected model, propagate cancellation, and report usage. Start with independent read-only work: delegation adds cost and coordination. |
| 4 | Explicit plan/review presets | Pi supports selecting tools, model, thinking level, and extra instructions. A preset could activate GOATED review or planning with fewer manual steps. Preserve prior settings when leaving it. Tool selection is not an operating-system sandbox; shell and extension tools need separate consideration. |
| 5 | A dedicated runtime Pi package | An explicit package manifest could make installation and updates portable across machines and allow Pi's package controls. Package only the retained runtime distribution and adapter, pin revisions, and keep refresh manual. This is most useful once the integration must work beyond this fork. |

Sources: [extension hooks, commands, and session APIs](https://pi.dev/docs/latest/extensions),
[native skills](https://pi.dev/docs/latest/skills),
[package manifests](https://pi.dev/docs/latest/packages),
[subagent example](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent),
and [preset example](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/preset.ts).
The suggested priorities and tradeoffs are this integration's assessment.
