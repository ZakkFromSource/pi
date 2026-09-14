import type { Model, Provider } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import unsloth from "./index.ts";

// The provider conversion is the behavior under test. Stub Pi's provider
// factory and streaming transport so this test never contacts an LLM.
vi.mock("@earendil-works/pi-ai", () => ({
  createProvider: (configuration: Record<string, unknown>) => ({
    ...configuration,
    getModels: () => configuration.models,
  }),
  openAICompletionsApi: () => ({
    stream: vi.fn(),
    streamSimple: vi.fn(),
  }),
}));

describe("Unsloth Studio provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a known model's native context before Studio loads it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: "ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF",
              loaded: false,
            },
          ],
        }),
      ),
    );

    let registeredProvider: Provider | undefined;
    const pi = {
      registerProvider(provider: Provider) {
        registeredProvider = provider;
      },
      on() {
        // Lifecycle handlers are not needed to inspect the registered model catalogue.
      },
    } as unknown as ExtensionAPI;

    await unsloth(pi);

    const models = registeredProvider?.getModels() as Model[] | undefined;
    expect(models).toHaveLength(1);
    expect(models?.[0]?.contextWindow).toBe(262144);
  });
});
