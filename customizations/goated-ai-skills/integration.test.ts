import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type FauxResponseStep, fauxAssistantMessage } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { parseArgs } from "../../packages/coding-agent/src/cli/args.ts";
import { ENV_AGENT_DIR } from "../../packages/coding-agent/src/config.ts";
import { DefaultResourceLoader } from "../../packages/coding-agent/src/core/resource-loader.ts";
import { SettingsManager } from "../../packages/coding-agent/src/core/settings-manager.ts";
import { loadSkills } from "../../packages/coding-agent/src/index.ts";
import { getShellConfig } from "../../packages/coding-agent/src/utils/shell.ts";
import { createHarness, getMessageText, type Harness } from "../../packages/coding-agent/test/suite/harness.ts";
import { getGoatedExtensions } from "./extension.ts";

interface GoatedRegistry {
	skills: Array<{
		name: string;
		path: string;
	}>;
}

const integrationRoot = dirname(fileURLToPath(import.meta.url));
const distributionRoot = join(integrationRoot, "distribution");
const repositoryRoot = join(integrationRoot, "..", "..");

describe("vendored GOATED AI Skills distribution", () => {
	it("contains the runtime support files without upstream development fixtures", () => {
		expect(readdirSync(distributionRoot).sort()).toEqual(["LICENSE", "skills", "stack"]);
		expect(readdirSync(join(distributionRoot, "stack"), { recursive: true }).sort()).toEqual([
			"AGENTS.md",
			"goated-stack.yaml",
			"schemas",
			join("schemas", "stack-registry.schema.json"),
			"templates",
			join("templates", "evidence-entry.md"),
			join("templates", "work-envelope.md"),
		]);
	});

	it("loads every registered skill through Pi without diagnostics", () => {
		const registry = parse(
			readFileSync(join(distributionRoot, "stack", "goated-stack.yaml"), "utf8"),
		) as GoatedRegistry;
		const result = loadSkills({
			agentDir: integrationRoot,
			cwd: integrationRoot,
			skillPaths: [join(distributionRoot, "skills")],
			includeDefaults: false,
		});

		expect(result.diagnostics).toEqual([]);
		expect(result.skills).toHaveLength(registry.skills.length);
		expect(new Set(result.skills.map((skill) => skill.name))).toEqual(
			new Set(registry.skills.map((skill) => skill.name)),
		);

		for (const skill of registry.skills) {
			expect(readFileSync(join(distributionRoot, skill.path), "utf8")).toContain(`name: ${skill.name}`);
		}
	});
});

describe("GOATED native Pi integration", () => {
	const projects: string[] = [];
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
		while (projects.length > 0) rmSync(projects.pop()!, { recursive: true, force: true });
	});

	it.each([
		{ name: "trusted project", args: [], projectTrusted: true, expectedAppend: "PROJECT_APPEND", enabled: true },
		{
			name: "explicit append",
			args: ["--append-system-prompt", "CALLER_APPEND"],
			projectTrusted: true,
			expectedAppend: "CALLER_APPEND",
			enabled: true,
		},
		{ name: "untrusted project", args: [], projectTrusted: false, expectedAppend: "GLOBAL_APPEND", enabled: true },
		{
			name: "disabled skills",
			args: ["--no-skills"],
			projectTrusted: true,
			expectedAppend: "PROJECT_APPEND",
			enabled: false,
		},
		{
			name: "disabled skills shorthand",
			args: ["-ns"],
			projectTrusted: true,
			expectedAppend: "PROJECT_APPEND",
			enabled: false,
		},
		{
			name: "flag-like message after --",
			args: ["--", "--no-skills"],
			projectTrusted: true,
			expectedAppend: "PROJECT_APPEND",
			enabled: true,
		},
	])(
		"preserves prompt composition and discovery for $name",
		async ({ args, projectTrusted, expectedAppend, enabled }) => {
			const projectRoot = mkdtempSync(join(tmpdir(), "pi-goated-session-"));
			projects.push(projectRoot);
			const agentDir = join(projectRoot, "agent");
			mkdirSync(join(projectRoot, ".pi"));
			mkdirSync(agentDir);
			writeFileSync(join(projectRoot, ".pi", "APPEND_SYSTEM.md"), "PROJECT_APPEND");
			writeFileSync(join(agentDir, "APPEND_SYSTEM.md"), "GLOBAL_APPEND");
			const parsed = parseArgs(args);
			const resourceLoader = new DefaultResourceLoader({
				cwd: projectRoot,
				agentDir,
				settingsManager: SettingsManager.create(projectRoot, agentDir, { projectTrusted }),
				noExtensions: true,
				noThemes: true,
				noPromptTemplates: true,
				noContextFiles: true,
				noSkills: parsed.noSkills,
				appendSystemPrompt: parsed.appendSystemPrompt,
				systemPrompt: "CALLER_SYSTEM",
				extensionFactories: [
					(pi) => {
						pi.on("before_agent_start", (event) => ({
							systemPrompt: `${event.systemPrompt}\nEARLIER_EXTENSION`,
						}));
					},
					...getGoatedExtensions(args),
				],
			});
			await resourceLoader.reload();
			const harness = await createHarness({ resourceLoader });
			harnesses.push(harness);
			const extensionErrors: unknown[] = [];
			await harness.session.bindExtensions({ onError: (error) => extensionErrors.push(error) });

			const systemPrompts: string[] = [];
			const userPrompts: string[] = [];
			const captureResponse: FauxResponseStep = (context) => {
				systemPrompts.push(context.systemPrompt ?? "");
				userPrompts.push(getMessageText(context.messages[0]));
				return fauxAssistantMessage("ok");
			};
			harness.setResponses([captureResponse, captureResponse]);
			await harness.session.prompt(enabled ? "/skill:grill-with-docs scope" : "scope");
			await harness.session.prompt("continue");

			for (const prompt of systemPrompts) {
				expect(prompt).toContain("CALLER_SYSTEM");
				expect(prompt).toContain(expectedAppend);
				expect(prompt).toContain("EARLIER_EXTENSION");
				expect(prompt.split("# GOATED Integrated Stack Policy")).toHaveLength(enabled ? 2 : 1);
				if (expectedAppend !== "PROJECT_APPEND") expect(prompt).not.toContain("PROJECT_APPEND");
			}
			if (enabled) expect(userPrompts[0]).toContain('<skill name="grill-with-docs"');
			expect(resourceLoader.getSkills().skills).toHaveLength(enabled ? 37 : 0);
			expect(resourceLoader.getSkills().diagnostics).toEqual([]);

			await harness.session.reload();
			expect(resourceLoader.getSkills().skills).toHaveLength(enabled ? 37 : 0);
			expect(resourceLoader.getSkills().diagnostics).toEqual([]);
			expect(resourceLoader.getExtensions().errors).toEqual([]);
			expect(extensionErrors).toEqual([]);
		},
	);
});

describe("pie launcher", () => {
	it("preserves auth subcommand dispatch when launched from another project", () => {
		const projectRoot = mkdtempSync(join(tmpdir(), "pi-goated-launcher-"));
		try {
			// Only pass OS runtime settings. Never expose the developer's credentials or agent configuration.
			const result = spawnSync(getShellConfig().shell, [join(repositoryRoot, "pi-test.sh"), "auth", "--help"], {
				cwd: projectRoot,
				env: {
					PATH: process.env.PATH,
					SystemRoot: process.env.SystemRoot,
					WINDIR: process.env.WINDIR,
					COMSPEC: process.env.COMSPEC,
					TEMP: projectRoot,
					TMP: projectRoot,
					HOME: projectRoot,
					USERPROFILE: projectRoot,
					APPDATA: join(projectRoot, "appdata"),
					LOCALAPPDATA: join(projectRoot, "localappdata"),
					[ENV_AGENT_DIR]: join(projectRoot, "agent"),
					PI_OFFLINE: "1",
					PI_TELEMETRY: "0",
				},
				encoding: "utf8",
				timeout: 20_000,
				windowsHide: true,
			});

			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(0);
			expect(result.stdout).toMatch(/^Usage:\s+pi auth print-api-key/);
		} finally {
			rmSync(projectRoot, { recursive: true, force: true });
		}
	});
});
