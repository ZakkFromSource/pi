import net from "node:net";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SOURCE = "custom:pie";
const AGENT = "pie";

type AgentState = "working" | "blocked" | "idle";

type BlockedEvent = {
	active: boolean;
	label?: string;
};

type Reporter = {
	reportSession(sessionStartSource?: string): Promise<void>;
	reportState(state: AgentState, message?: string): Promise<void>;
	release(): Promise<void>;
	updateSession(context: ExtensionContext): void;
};

function isBlockedEvent(value: unknown): value is BlockedEvent {
	return typeof value === "object" && value !== null && "active" in value && typeof value.active === "boolean";
}

function createReporter(): Reporter | undefined {
	const socketPath = process.env.HERDR_SOCKET_PATH;
	const paneId = process.env.HERDR_PANE_ID;
	if (process.env.PIE_CUSTOM !== "1" || process.env.HERDR_ENV !== "1" || !socketPath || !paneId) return;

	const socketEndpoint = process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;
	let reportSeq = Date.now() * 1000;
	let currentAgentSessionId: string | undefined;
	let currentAgentSessionPath: string | undefined;
	let requestQueue = Promise.resolve();

	function nextReportSeq(): number {
		reportSeq += 1;
		return reportSeq;
	}

	function sendRequestAttempt(request: unknown, timeoutMs: number): Promise<boolean> {
		return new Promise((resolve) => {
			let finished = false;
			let timeout: ReturnType<typeof setTimeout> | undefined;
			const socket = net.createConnection(socketEndpoint);
			const finish = (delivered: boolean) => {
				if (finished) return;
				finished = true;
				if (timeout) clearTimeout(timeout);
				socket.destroy();
				resolve(delivered);
			};

			socket.on("error", () => finish(false));
			socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
			socket.on("data", () => finish(true));
			socket.on("end", () => finish(false));
			timeout = setTimeout(() => finish(false), timeoutMs);
			timeout.unref?.();
		});
	}

	function enqueueRequest(method: string, params: Record<string, unknown>): Promise<void> {
		requestQueue = requestQueue.then(async () => {
			const request = {
				id: `${SOURCE}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
				method,
				params,
			};
			if (!(await sendRequestAttempt(request, 500))) await sendRequestAttempt(request, 1500);
		});
		return requestQueue;
	}

	function sessionParams(): Record<string, unknown> {
		if (currentAgentSessionPath) return { agent_session_path: currentAgentSessionPath };
		if (currentAgentSessionId) return { agent_session_id: currentAgentSessionId };
		return {};
	}

	return {
		updateSession(context) {
			try {
				const file = context.sessionManager.getSessionFile();
				currentAgentSessionPath = typeof file === "string" && file.startsWith("/") ? file : undefined;
			} catch {
				currentAgentSessionPath = undefined;
			}
			try {
				const id = context.sessionManager.getSessionId();
				currentAgentSessionId = typeof id === "string" && id.length > 0 ? id : undefined;
			} catch {
				currentAgentSessionId = undefined;
			}
		},
		reportSession(sessionStartSource) {
			const session = sessionParams();
			if (Object.keys(session).length === 0) return Promise.resolve();
			return enqueueRequest("pane.report_agent_session", {
				pane_id: paneId,
				source: SOURCE,
				agent: AGENT,
				seq: nextReportSeq(),
				session_start_source: sessionStartSource,
				...session,
			});
		},
		reportState(state, message) {
			return enqueueRequest("pane.report_agent", {
				pane_id: paneId,
				source: SOURCE,
				agent: AGENT,
				state,
				message,
				seq: nextReportSeq(),
				...sessionParams(),
			});
		},
		release() {
			return enqueueRequest("pane.release_agent", {
				pane_id: paneId,
				source: SOURCE,
				agent: AGENT,
				seq: nextReportSeq(),
			});
		},
	};
}

export default function herdrPie(pi: ExtensionAPI): void {
	const configuredReporter = createReporter();
	if (!configuredReporter) return;
	const reporter: Reporter = configuredReporter;

	let rootSession = false;
	let agentActive = false;
	let blockedCount = 0;
	let blockedMessage: string | undefined;
	let lastState: AgentState | undefined;
	let lastMessage: string | undefined;

	function desiredState(): { state: AgentState; message?: string } {
		if (blockedCount > 0) return { state: "blocked", message: blockedMessage };
		if (agentActive) return { state: "working" };
		return { state: "idle" };
	}

	function publishState(force = false): Promise<void> {
		const next = desiredState();
		if (!force && next.state === lastState && next.message === lastMessage) return Promise.resolve();
		lastState = next.state;
		lastMessage = next.message;
		return reporter.reportState(next.state, next.message);
	}

	function updateBlocked(active: boolean, message?: string): void {
		if (!rootSession) return;
		if (active) {
			blockedCount += 1;
			blockedMessage = message;
		} else {
			blockedCount = Math.max(0, blockedCount - 1);
			if (blockedCount === 0) blockedMessage = undefined;
		}
		void publishState();
	}

	pi.events.on("herdr:blocked", (data) => {
		if (isBlockedEvent(data)) updateBlocked(data.active, data.label);
	});

	pi.on("session_start", async (event, context) => {
		if (context.mode !== "tui") return;
		rootSession = true;
		reporter.updateSession(context);
		await reporter.reportSession(event.reason);
		agentActive = !context.isIdle();
		await publishState(true);
	});

	pi.on("agent_start", async (_event, context) => {
		if (!rootSession) return;
		reporter.updateSession(context);
		await reporter.reportSession();
		agentActive = true;
		await publishState();
	});

	pi.on("agent_settled", async (_event, context) => {
		if (!rootSession || !context.isIdle()) return;
		agentActive = false;
		await publishState();
	});

	pi.on("ui_prompt_start", (event) => updateBlocked(true, event.title));
	pi.on("ui_prompt_end", () => updateBlocked(false));

	pi.on("session_shutdown", async () => {
		if (!rootSession) return;
		rootSession = false;
		await reporter.release();
	});
}
