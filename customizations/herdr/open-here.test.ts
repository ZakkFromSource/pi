import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getShellConfig } from "../../packages/coding-agent/src/utils/shell.ts";

const temporaryDirectories: string[] = [];
const wrapper = join(import.meta.dirname, "open-here.sh");

function runWrapper(args: string[], environment: Record<string, string | undefined> = {}) {
	const directory = mkdtempSync(join(tmpdir(), "herdr open here "));
	temporaryDirectories.push(directory);
	const logPath = join(directory, "calls.log");
	const fakeHerdr = join(directory, "herdr-real");
	writeFileSync(
		fakeHerdr,
		[
			"#!/usr/bin/env bash",
			'printf \'%s|%s\\n\' "$#" "$*" >> "$HERDR_TEST_LOG"',
			'exit "${HERDR_TEST_EXIT:-0}"',
			"",
		].join("\n"),
	);
	chmodSync(fakeHerdr, 0o755);

	const result = spawnSync(getShellConfig().shell, [wrapper, ...args], {
		cwd: directory,
		env: {
			PATH: process.env.PATH,
			SystemRoot: process.env.SystemRoot,
			WINDIR: process.env.WINDIR,
			HOME: process.env.HOME,
			HERDR_REAL_BIN: fakeHerdr,
			HERDR_TEST_LOG: logPath,
			...environment,
		},
		encoding: "utf8",
	});

	return {
		result,
		calls: readFileSync(logPath, "utf8").trim().split(/\r?\n/),
		directory,
	};
}

describe("Herdr Git Bash launcher", () => {
	afterEach(() => {
		while (temporaryDirectories.length > 0) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
	});

	it("opens a focused workspace at the invoking directory before attaching", () => {
		const invocation = runWrapper([]);

		expect(invocation.result.status, invocation.result.stderr).toBe(0);
		const shellDirectory = invocation.directory
			.replace(/^([A-Za-z]):/, (_match, drive: string) => `/${drive.toLowerCase()}`)
			.replaceAll("\\", "/");
		expect(invocation.calls).toEqual([`5|workspace create --cwd ${shellDirectory} --focus`, "0|"]);
	});

	it("delegates without creating a workspace inside Herdr or for explicit commands", () => {
		const inside = runWrapper([], { HERDR_ENV: "1" });
		const command = runWrapper(["status"]);

		expect(inside.calls).toEqual(["0|"]);
		expect(command.calls).toEqual(["1|status"]);
	});
});
