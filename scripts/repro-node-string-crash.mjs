import assert from "node:assert/strict";

// Standalone reproduction of the Windows Node 24.21.0 V8 crash seen while typing
// in Pi. No Pi code or third-party modules are loaded. See customizations/node-runtime.md.
// This may abort the process: run it explicitly, outside the normal test suite.
const transcriptLines = Array.from(
	{ length: 300 },
	(_, index) =>
		`\x1b[36mExample transcript row ${index}:\x1b[0m ${"Content with ASCII and Unicode café. ".repeat(3)}`,
);
const lineReset = "\x1b[0m\x1b]8;;\x1b\\";
let previousFrame = transcriptLines.map((line) => line + lineReset);

// Equal strings can have separate backing storage. Comparing repeated render
// frames exercises V8's flattening of concatenated strings during collection.
for (let frame = 0; frame < 100_000; frame++) {
	const currentFrame = transcriptLines.map((line) => line + lineReset);
	for (let lineIndex = 0; lineIndex < currentFrame.length; lineIndex++) {
		assert.equal(previousFrame[lineIndex], currentFrame[lineIndex]);
	}
	previousFrame = currentFrame;
}

console.log("100000 string comparison frames passed");
