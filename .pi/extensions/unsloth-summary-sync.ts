import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Keeps web-search.json's summaryModel pointed at whichever model Unsloth
// Studio currently has loaded, so pi-web-access summarizes locally when
// possible and falls back to its built-in chain (Luna, Terra, ...) otherwise.

const DEFAULT_BASE_URL = "http://127.0.0.1:8888/v1";
const POLL_MS = 15_000;
const CONFIG_PATH = join(homedir(), ".pi", "agent", "web-search.json");
// Thinking-level metadata maintained by the unsloth provider extension.
const CAPABILITIES_PATH = join(
	homedir(),
	".pi",
	"agent",
	"extensions",
	"unsloth",
	"capabilities.json",
);

interface StudioModel {
	id: string;
	loaded?: boolean;
}

interface Capabilities {
	reasoning: boolean;
	levels: string[];
}

type WebSearchConfig = Record<string, unknown>;

function loadCapabilities(): Record<string, Capabilities> {
	try {
		return JSON.parse(readFileSync(CAPABILITIES_PATH, "utf8")) as Record<string, Capabilities>;
	} catch {
		return {};
	}
}

// Prefer the user's usual "low" level; fall back to the first supported
// level; no suffix when thinking support is unknown (safer than guessing).
function thinkingSuffix(modelId: string): string {
	const cap = loadCapabilities()[modelId];
	if (!cap || !cap.reasoning || cap.levels.length === 0) return "";
	if (cap.levels.includes("low")) return ":low";
	return `:${cap.levels[0]}`;
}

function readConfig(): WebSearchConfig {
	try {
		return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as WebSearchConfig;
	} catch {
		return {};
	}
}

function writeConfig(config: WebSearchConfig): void {
	const tempPath = `${CONFIG_PATH}.tmp`;
	writeFileSync(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
	renameSync(tempPath, CONFIG_PATH);
}

export default function unslothSummarySync(pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | undefined;

	async function sync(notify: (message: string) => void): Promise<void> {
		// Resolved per call so the override (used by tests) can change between syncs.
		const baseUrl = process.env.PI_UNSLOTH_BASE_URL ?? DEFAULT_BASE_URL;
		try {
			const response = await fetch(`${baseUrl}/models`, {
				signal: AbortSignal.timeout(5_000),
				redirect: "error",
			});
			if (!response.ok) return; // Studio error: leave config untouched.
			const payload = (await response.json()) as { data?: StudioModel[] };
			const models = Array.isArray(payload.data) ? payload.data : [];
			const loaded = models.find((model) => model.loaded === true && typeof model.id === "string");

			const config = readConfig();
			if (!loaded) {
				// Nothing loaded: drop the key so pi-web-access uses its default chain.
				if (config.summaryModel === undefined) return;
				delete config.summaryModel;
				writeConfig(config);
				notify("Unsloth: no model loaded, summary model reset to default chain");
				return;
			}

			const target = `unsloth/${loaded.id}${thinkingSuffix(loaded.id)}`;
			if (config.summaryModel === target) return;
			config.summaryModel = target;
			writeConfig(config);
			notify(`Unsloth: summary model set to ${target}`);
		} catch {
			// Studio offline or config unreadable: leave config untouched.
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		if (timer) return;
		const notify = (message: string) => ctx.ui.notify(message, "info");
		void sync(notify);
		timer = setInterval(() => void sync(notify), POLL_MS);
	});

	pi.on("session_shutdown", async () => {
		if (timer) {
			clearInterval(timer);
			timer = undefined;
		}
	});
}
