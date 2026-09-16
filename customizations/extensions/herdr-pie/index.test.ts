import net from "node:net";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import herdrPie from "./index.ts";

type EventHandler = (event: unknown, context: unknown) => unknown;

type ReportRequest = {
	method: string;
	params: {
		agent?: string;
		pane_id?: string;
		source?: string;
		state?: string;
	};
};

function createExtensionApi() {
	const handlers = new Map<string, EventHandler[]>();
	const sharedHandlers = new Map<string, Array<(data: unknown) => void>>();
	const pi = {
		on(event: string, handler: EventHandler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		events: {
			on(event: string, handler: (data: unknown) => void) {
				sharedHandlers.set(event, [...(sharedHandlers.get(event) ?? []), handler]);
			},
		},
	} as unknown as ExtensionAPI;

	async function emit(event: string, payload: unknown, context: unknown): Promise<void> {
		for (const handler of handlers.get(event) ?? []) await handler(payload, context);
	}

	return { pi, handlers, sharedHandlers, emit };
}

async function createReportServer(): Promise<{
	reports: ReportRequest[];
	socketPath: string;
	close: () => Promise<void>;
}> {
	const reports: ReportRequest[] = [];
	const suffix = `herdr-pie-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const endpoint = process.platform === "win32" ? `\\\\.\\pipe\\${suffix}` : join(tmpdir(), `${suffix}.sock`);
	const socketPath = process.platform === "win32" ? suffix : endpoint;
	const server = net.createServer((socket) => {
		let input = "";
		socket.on("data", (chunk) => {
			input += chunk.toString("utf8");
			const newline = input.indexOf("\n");
			if (newline === -1) return;
			reports.push(JSON.parse(input.slice(0, newline)) as ReportRequest);
			socket.end('{"result":{"type":"ok"}}\n');
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(endpoint, resolve);
	});

	return {
		reports,
		socketPath,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (process.platform !== "win32") rmSync(endpoint, { force: true });
					if (error) reject(error);
					else resolve();
				});
			}),
	};
}

describe("Herdr pie integration", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("does not claim stock pi sessions", () => {
		vi.stubEnv("PIE_CUSTOM", "");
		const extension = createExtensionApi();
		herdrPie(extension.pi);

		expect(extension.handlers.size).toBe(0);
		expect(extension.sharedHandlers.size).toBe(0);
	});

	it("reports the custom pie lifecycle when launched with PIE_CUSTOM", async () => {
		const server = await createReportServer();
		try {
			vi.stubEnv("PIE_CUSTOM", "1");
			vi.stubEnv("HERDR_ENV", "1");
			vi.stubEnv("HERDR_PANE_ID", "w1:p1");
			vi.stubEnv("HERDR_SOCKET_PATH", server.socketPath);
			const extension = createExtensionApi();
			herdrPie(extension.pi);
			const context = {
				mode: "tui",
				isIdle: () => true,
				sessionManager: {
					getSessionFile: () => undefined,
					getSessionId: () => "session-1",
				},
			};

			await extension.emit("session_start", { reason: "startup" }, context);
			await extension.emit("agent_start", {}, context);
			await extension.emit("ui_prompt_start", { title: "Approval" }, context);
			await extension.emit("ui_prompt_end", {}, context);
			await extension.emit("agent_settled", {}, context);
			await extension.emit("session_shutdown", { reason: "quit" }, context);

			expect(server.reports.map((report) => report.method)).toEqual([
				"pane.report_agent_session",
				"pane.report_agent",
				"pane.report_agent_session",
				"pane.report_agent",
				"pane.report_agent",
				"pane.report_agent",
				"pane.report_agent",
				"pane.release_agent",
			]);
			expect(
				server.reports
					.filter((report) => report.method === "pane.report_agent")
					.map((report) => report.params.state),
			).toEqual(["idle", "working", "blocked", "working", "idle"]);
			for (const report of server.reports) {
				expect(report.params).toMatchObject({ agent: "pie", pane_id: "w1:p1", source: "custom:pie" });
			}
		} finally {
			await server.close();
		}
	});
});
