import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createProvider,
  openAICompletionsApi,
  type Model,
  type ModelThinkingLevel,
  type StreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASE_URL = "http://127.0.0.1:8888/v1";
const KEYLESS_PLACEHOLDER = "unsloth-keyless-placeholder";
const LEVELS: ModelThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

// TypeScript interfaces document the data shapes this extension expects.
// They do not create objects at runtime; they help catch mistakes while developing.
interface Capabilities {
  reasoning: boolean;
  levels: string[];
  alwaysOn: boolean;
  effort: boolean;
  preserveThinking: boolean;
  nativeContext?: number;
}

interface StudioModel {
  id: string;
  quant?: string;
  loaded?: boolean;
  context_length?: number;
  max_context_length?: number;
  native_context_length?: number;
}

// -----------------------------------------------------------------------------
// Model capability metadata
// -----------------------------------------------------------------------------

// These per-model capabilities were read from the downloaded GGUF templates.
// Keep them separate from discovery: Studio alone owns the available model list.
const capabilities: Record<string, Capabilities> = JSON.parse(
  readFileSync(fileURLToPath(new URL("./capabilities.json", import.meta.url)), "utf8"),
);

function modelCapabilities(id: string): Capabilities {
  // Prefer the verified metadata for an exact model ID.
  if (capabilities[id]) return capabilities[id];

  // New downloads in known families remain useful without editing this extension.
  if (/qwen3[._-]?8/i.test(id)) {
    return {
      reasoning: true,
      levels: ["low", "medium", "xhigh"],
      alwaysOn: false,
      effort: true,
      preserveThinking: true,
    };
  }
  if (/qwen3|gemma[-_]?4|ling-3/i.test(id)) {
    return {
      reasoning: true,
      levels: ["high"],
      alwaysOn: false,
      effort: false,
      preserveThinking: false,
    };
  }

  // Do not invent thinking support for unknown templates. Their models still appear.
  return { reasoning: false, levels: [], alwaysOn: false, effort: false, preserveThinking: false };
}

// -----------------------------------------------------------------------------
// Convert Unsloth's model description into the format Pi understands
// -----------------------------------------------------------------------------

function toPiModel(model: StudioModel): Model<"openai-completions"> {
  const features = modelCapabilities(model.id);

  // Pi checks this map to decide which thinking choices to show in its UI.
  // A null value means that choice is not supported by the current model.
  const thinkingLevelMap = Object.fromEntries(
    LEVELS.map((level) => {
      if (level === "off") {
        return [level, features.alwaysOn ? null : "none"];
      }

      const supportedLevel = features.levels.includes(level) ? level : null;
      return [level, supportedLevel];
    }),
  );

  // Studio's context_length is the confirmed running capacity. Its misleadingly
  // named max_context_length is only a VRAM-fit warning threshold; an explicit
  // load can legitimately allocate more, so it must not cap Pi's context window.
  const nativeLimits = [model.native_context_length, features.nativeContext].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  const runningContext = model.context_length;
  // Before a model is loaded, use the most conservative verified native limit.
  // Fall back to 32k only when neither Studio nor capabilities.json knows it.
  let contextWindow = nativeLimits.length > 0 ? Math.min(...nativeLimits) : 32768;
  if (model.loaded && typeof runningContext === "number" && Number.isFinite(runningContext) && runningContext > 0) {
    contextWindow = runningContext;
  }

  // The returned object is Pi's complete description of this model.
  return {
    id: model.id,
    name: `${model.id}${model.quant ? ` [${model.quant}]` : ""}${model.loaded ? " (loaded)" : ""}`,
    provider: "unsloth",
    api: "openai-completions",
    baseUrl: BASE_URL,
    reasoning: features.reasoning,
    thinkingLevelMap,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens: Math.min(16384, Math.floor(contextWindow / 4)),
    compat: {
      supportsDeveloperRole: false,
      supportsStore: false,
      maxTokensField: "max_tokens",
      thinkingFormat: "qwen",
      supportsReasoningEffort: features.effort,
    },
  };
}

// -----------------------------------------------------------------------------
// Extension entry point
// -----------------------------------------------------------------------------

// Pi calls this function when it loads the extension.
export default async function unsloth(pi: ExtensionAPI) {
  // Keep the most recent successful model list in memory for this Pi process.
  let catalog: Model<"openai-completions">[] = [];
  let discoveryError: string | undefined;

  // Ask the local Unsloth Studio server which models are currently available.
  async function discover(signal?: AbortSignal, apiKey?: string) {
    // Do not delay Pi startup indefinitely if Studio is stopped or unavailable.
    const deadline = AbortSignal.timeout(5000);
    const response = await fetch(`${BASE_URL}/models`, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      redirect: "error",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    if (!response.ok) throw new Error(`Unsloth model discovery: HTTP ${response.status}`);

    const payload = await response.json();
    // Reject malformed responses before they can become entries in Pi's model picker.
    if (!Array.isArray(payload.data) || payload.data.some((model: StudioModel) => typeof model.id !== "string")) {
      throw new Error("Unsloth returned an invalid model catalog");
    }

    const discovered = payload.data.map(toPiModel);
    discoveryError = undefined;
    return discovered;
  }

  // Initial discovery is best-effort. Pi should still start when Studio is offline.
  try {
    catalog = await discover();
  } catch (error) {
    discoveryError = error instanceof Error ? error.message : String(error);
  }

  // ---------------------------------------------------------------------------
  // Local-only request transport and credential protection
  // ---------------------------------------------------------------------------

  const api = openAICompletionsApi();
  // Resolve credentials through Pi's standard store. Keep an unauthenticated
  // fallback for inference on an already loaded model when no key is configured.
  function localRequestOptions(requestOptions: StreamOptions = {}) {
    const transport = requestOptions.fetch ?? globalThis.fetch;
    return {
      ...requestOptions,
      apiKey: requestOptions.apiKey ?? KEYLESS_PLACEHOLDER,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);

        // This is the main security boundary: never send the local Studio key
        // to a different host, even if a caller supplies an unexpected URL.
        if (new URL(request.url).origin !== new URL(BASE_URL).origin) {
          throw new Error("The Unsloth provider only sends requests to local Studio.");
        }

        // The placeholder exists only to satisfy Pi's OpenAI-compatible client.
        // Remove it before transmission when the user has not configured a real key.
        if (!requestOptions.apiKey || requestOptions.apiKey === KEYLESS_PLACEHOLDER) {
          request.headers.delete("authorization");
        }

        // Reject HTTP redirects so credentials cannot be forwarded to another origin.
        return transport(new Request(request, { redirect: "error" }));
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Register the provider with Pi
  // ---------------------------------------------------------------------------

  const provider = createProvider({
    id: "unsloth",
    name: "Unsloth Studio (local)",
    baseUrl: BASE_URL,
    auth: {
      apiKey: {
        name: "Unsloth Studio API key",
        async resolve({ credential }) {
          return {
            auth: { apiKey: credential?.key || KEYLESS_PLACEHOLDER },
            source: credential?.key ? "Dedicated Unsloth API key" : "Unsloth keyless localhost",
          };
        },
      },
    },
    models: [],
    api: {
      ...api,
      stream: (model, context, options) => api.stream(model, context, localRequestOptions(options)),
      streamSimple: (model, context, options) => api.streamSimple(model, context, localRequestOptions(options)),
    },
  });
  // Studio's loaded model and capacity are live state. The generic provider
  // factory restores persisted snapshots over fresh discovery, so own refresh
  // here and retain only this process's last successful catalog.
  provider.getModels = () => catalog;
  provider.refreshModels = async (context) => {
    // Pi can request an offline refresh. Respect that choice and avoid network access.
    if (!context.allowNetwork) return;

    const apiKey = context.credential?.type === "api_key" ? context.credential.key : undefined;
    const refreshed = await discover(context.signal, apiKey);
    // Publishing through Pi updates the in-memory catalog without persisting a stale snapshot.
    await context.publish({ persist: null, update: () => { catalog = refreshed; } });
  };
  pi.registerProvider(provider);

  // ---------------------------------------------------------------------------
  // Pi lifecycle events
  // ---------------------------------------------------------------------------

  // Show a helpful warning after startup if the initial Studio discovery failed.
  pi.on("session_start", (_event, context) => {
    if (discoveryError) context.ui.notify(`${discoveryError}. Start Studio, then reopen /model.`, "warning");
  });

  // Adjust only Unsloth requests immediately before they are sent.
  pi.on("before_provider_request", (event, context) => {
    if (context.model?.provider !== "unsloth") return;
    const features = modelCapabilities(context.model.id);
    const payload = { ...(event.payload as Record<string, unknown>) };

    // Some Qwen models need this flag to return their reasoning consistently.
    if (features.preserveThinking) payload.preserve_thinking = true;

    // Studio must return tool calls to Pi rather than execute its own tools.
    payload.enable_tools = false;
    return payload;
  });
}
