import { StructCollection } from "../src/index.js";

import { COUNT, PlayerDef } from "./constants.js";

const MODE = process.argv[2];
const TYPE = process.argv[3];

if (!MODE || !TYPE) {
	console.error(
		"Usage: bun run benchmarks/common.ts <allocation|write|read> <native|struct>",
	);
	process.exit(1);
}

function runStruct() {
	if (MODE === "allocation") {
		// biome-ignore lint/correctness/noUnusedVariables: allocation benchmark
		const players = new StructCollection(PlayerDef, COUNT);
		return;
	}

	const players = new StructCollection(PlayerDef, COUNT);

	if (MODE === "write" || MODE === "read") {
		for (let i = 0; i < COUNT; i++) {
			const p = players.get(i);
			p.id = i;
			p.health = 100;
			p.x = i * 0.5;
			p.y = i * 1.5;
			p.active = true;
		}
	}

	if (MODE === "read") {
		let sum = 0;
		for (let i = 0; i < COUNT; i++) {
			const p = players.get(i);
			sum += p.x + p.y;
		}
		console.log("Sum:", sum);
	}
}

function runNative() {
	if (MODE === "allocation") {
		const players = new Array(COUNT);
		for (let i = 0; i < COUNT; i++) {
			players[i] = { id: 0, health: 0, x: 0, y: 0, active: false, name: "" };
		}
		return;
	}

	// Pre-allocate for fairness in write/read
	const players = new Array(COUNT);
	for (let i = 0; i < COUNT; i++) {
		players[i] = { id: 0, health: 0, x: 0, y: 0, active: false, name: "" };
	}

	if (MODE === "write" || MODE === "read") {
		for (let i = 0; i < COUNT; i++) {
			const p = players[i];
			p.id = i;
			p.health = 100;
			p.x = i * 0.5;
			p.y = i * 1.5;
			p.active = true;
		}
	}

	if (MODE === "read") {
		let sum = 0;
		for (let i = 0; i < COUNT; i++) {
			const p = players[i];
			sum += p.x + p.y;
		}
		console.log("Sum:", sum);
	}
}

if (TYPE === "struct") {
	runStruct();
} else {
	runNative();
}
