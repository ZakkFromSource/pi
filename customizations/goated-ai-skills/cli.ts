#!/usr/bin/env node
import { setupCli } from "../../packages/coding-agent/src/cli/setup.ts";
import { runExperimentalCommand } from "../../packages/coding-agent/src/experimental/commands.ts";
import { main } from "../../packages/coding-agent/src/main.ts";
import { getGoatedExtensions } from "./extension.ts";

setupCli();
const args = process.argv.slice(2);
if (await runExperimentalCommand(args)) {
	if (args[0] === "client") process.exit(process.exitCode ?? 0);
} else {
	// Keep argv intact: Pi dispatches auth, package, and config commands by position.
	await main(args, { extensionFactories: getGoatedExtensions(args) });
}
