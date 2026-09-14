import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../../packages/coding-agent/src/cli/args.ts";
import type { ExtensionAPI, InlineExtension } from "../../packages/coding-agent/src/core/extensions/index.ts";

const distributionRoot = join(dirname(fileURLToPath(import.meta.url)), "distribution");

export default function goatedSkills(pi: ExtensionAPI): void {
	// Read once per extension load. /reload refreshes the policy alongside the skills.
	const sharedPolicy = readFileSync(join(distributionRoot, "stack", "AGENTS.md"), "utf8");
	const instructions = [
		"## Installed GOATED AI Skills",
		`Distribution root: ${distributionRoot}`,
		"Resolve package-relative stack/ and skills/ paths from this root.",
		"The shared policy below is already loaded; do not reread it for each skill.",
		sharedPolicy,
	].join("\n\n");

	pi.on("resources_discover", () => ({ skillPaths: [join(distributionRoot, "skills")] }));
	pi.on("before_agent_start", (event) => ({
		// Preserve Pi's project/system instructions and earlier extension contributions.
		systemPrompt: `${event.systemPrompt}\n\n${instructions}`,
	}));
}

export function getGoatedExtensions(args: string[]): InlineExtension[] {
	// Use Pi's parser so flag values and text after -- keep their normal meaning.
	if (parseArgs(args).noSkills) return [];
	return [{ name: "goated-ai-skills", factory: goatedSkills }];
}
