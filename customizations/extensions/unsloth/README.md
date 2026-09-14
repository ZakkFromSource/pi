# Unsloth Studio provider for global Pi

Created for Pi 0.85.1 on 2026-09-14. This tracked directory is the authoritative
source for the extension. The Windows setup links it into Pi's global extension
directory, where Pi discovers it automatically.

## Use

1. Start Unsloth Studio with its API on `http://127.0.0.1:8888`.
2. Start Pi normally, or run `/reload` in an existing Pi session.
3. Open `/model` or press Ctrl+L and search for `unsloth`.
4. Select any catalog model. The catalog labels the resident model `(loaded)`.
   Sending the first prompt loads the selected model through Studio's API.
5. Use Shift+Tab to cycle the model's supported thinking choices.

The current ISTA-DASLab Qwen3.8 model supports off, low, medium, and xhigh.
Models with only an on/off thinking switch expose off and high (high means on).
Always-thinking models expose high only. Non-reasoning models expose off only.
Unsloth Qwen3.8's own template also accepts high as an alias for xhigh.

## Authentication and automatic loading

A dedicated key named **Pi global local provider** is stored in Pi's standard
`~/.pi/agent/auth.json`, under the `unsloth` provider. It was created with explicit
user authorization through Unsloth's verified local identity handshake and API,
and saved using Pi's locking credential-store API. Existing credentials were
preserved. No key was printed or copied into this extension or its documentation.
Windows file permissions grant access to the user, Administrators, and SYSTEM.

The provider resolves this credential through Pi and sends it only to
`http://127.0.0.1:8888`. Redirects and model overrides pointing elsewhere are
rejected. Revoke the dedicated key in Studio's API settings if no longer wanted.

Unsloth deliberately disallows switching to another model for keyless callers,
even with **Switch model by request** enabled. A live attempt returned HTTP 503
`model_switch_failed`. Keyless requests may restore the same model after an idle
unload, but cannot cold-load an arbitrary different model. The dedicated key
enables automatic loading with **Switch model by request** turned on in Studio.
That setting was enabled by the user. The user's keyless setting can remain on.

Without a stored key, the provider falls back to keyless inference. Its internal
placeholder satisfies Pi's OpenAI client but is removed before transmission.
In that fallback mode, load the selected model manually in Studio first.

## Discovery and capabilities

The live `/v1/models` response owns model availability, including LM Studio
downloads that Studio has indexed. Pi fetches the catalog at extension startup
and through its native provider refresh when the model picker refreshes. A failed
refresh preserves the last good list in that Pi process; a fresh offline start
has no saved catalog. Reopen the picker after Studio starts.

`capabilities.json` contains capabilities read from the downloaded GGUF templates
on the installation date. This is metadata, not a second model availability list.
Known new Qwen3.8 downloads receive off/low/medium/xhigh; other known Qwen3,
Gemma 4, and Ling 3 downloads get an on/off toggle. Unknown model families still
appear but do not advertise unverified thinking support. Add their verified
capabilities to this JSON and `/reload` if needed. Recheck metadata if replacing
an existing model with a different chat template.

Unloaded models use at most a 32,768-token context window. Loaded models use
Studio's confirmed running `context_length`; refresh the picker after loading.
`max_context_length` is a VRAM-fit warning estimate and does not cap that value.
Live discovery takes precedence over any old persisted Pi model snapshot.
Text input is enabled. Image capability is not inferred from repository names.
Studio tools are disabled per request; Pi owns tool execution.

## Sampling behavior

Default Pi requests omit temperature, top_p, top_k, min_p, repetition_penalty,
presence_penalty, and frequency_penalty. They do not read Studio's chat sliders.
Studio resolves its recommended sampling fields in this precedence order:
server `UNSLOTH_SAMPLING_*` pins, explicit client values, per-model recommended
values, then schema defaults. Thus a server pin can override even Pi's request.
Custom chat UI slider values are not automatically inherited by an API request.
Pi explicitly supplies thinking controls and an output cap of up to 8,192 tokens.
That output cap is distinct from the total context window.

## Verification

- All 24 live Studio catalog models appeared in `pi --list-models unsloth`.
- Pi's native RPC cycle returned low, medium, xhigh, off for the loaded model.
- Live off requests returned text without thinking. Live low, medium and xhigh
  requests each returned thinking plus text and stopped successfully.
- Provider contract tests covered a catalog with no loaded models, new downloads,
  failed-refresh retention, all four thinking payloads, and absent Authorization.
- Authenticated cold loading and inference passed through Pi for the original
  ISTA-DASLab Qwen3.8 model and the LM Studio Qwen3.8 Q4_K_M download.
- Authenticated switching from the original model to LM Studio Qwen3.8 passed.
- Dedicated-key transport tests verify the bearer header, redirect rejection,
  and rejection of remote endpoint overrides without sending a request.
- Pi switched from the LM Studio Qwen3.8 model back to the original model, then
  completed one side-effect-free tool call and correctly used the tool result.
- Final authenticated off/xhigh requests returned text-only/thinking-plus-text
  respectively. All 24 models and the native thinking cycle passed again.
- Context regression checks fail for both the erroneous 114k VRAM cap and an old
  persisted snapshot. After correction, live Pi RPC reports contextWindow 262144.
- The interactive terminal's physical key delivery has not been automated; the
  native cycle operation and documented default keybinding were verified.

## Known Studio backend failures

Loading `Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF` repeatedly crashed Studio's Python
backend with Windows exception `0xc0000005`. A cold load of
`lmstudio-community/gemma-4-E2B-it-GGUF` also crashed. One Windows crash record
identified NumPy's `_multiarray_umath.cp313-win_amd64.pyd`; others reported an
unknown module. This is not an API-key rejection. It remains unresolved and
requires separate Studio/runtime diagnosis. No Studio package or dependency was
modified. Other Qwen3.8 models loaded and answered successfully.

The backend was restarted after the crashes, and the original ISTA-DASLab model
was restored. It runs on the original port, using the installed Studio CLI in a
hidden background process. Restart Studio normally if closing this backend.

## Remove

Remove the `unsloth` directory link from `~/.pi/agent/extensions`, then restart Pi
or run `/reload`. This removes the live connection without deleting the tracked
source files. Revoke the dedicated key in Studio and remove only the `unsloth`
credential from Pi if removing authentication too. The installation preserves
`settings.json` and does not create a `models.json` file.

## Sources

- https://pi.dev/docs/latest/custom-provider
- Pi's installed `docs/extensions.md`, `docs/keybindings.md`, and `docs/rpc.md`
- Installed Unsloth `studio/backend/routes/inference.py`,
  `_maybe_auto_switch_model`: keyless callers cannot switch models
- Downloaded GGUF `tokenizer.chat_template` metadata
