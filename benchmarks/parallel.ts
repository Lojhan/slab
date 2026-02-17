import { StructCollection } from "../src/index.js";
import { CHUNK, COUNT, PlayerDef, WORKERS } from "./constants.js";

const MODE = process.argv[2];

if (!MODE) {
	console.error("Usage: bun run benchmarks/parallel.ts <native|struct>");
	process.exit(1);
}

async function runStruct() {
	const players = new StructCollection(PlayerDef, COUNT);

	for (let i = 0; i < COUNT; i++) {
		const p = players.get(i);
		p.id = i;
		p.x = 100;
		p.y = 200;
	}

	const workers = new Array(WORKERS)
		.fill(0)
		.map(
			() => new Worker(new URL("./parallel-worker.ts", import.meta.url).href),
		);

	const promises = workers.map(
		(w, index) =>
			new Promise((resolve) => {
				w.onmessage = () => resolve(true);
				w.postMessage({
					type: "struct",
					payload: players.buffer,
					start: index * CHUNK,
					end: (index + 1) * CHUNK,
				});
			}),
	);

	await Promise.all(promises);

	for (const w of workers) w.terminate();
}

async function runNative() {
	const players = new Array(COUNT);
	for (let i = 0; i < COUNT; i++) {
		players[i] = { id: i, health: 0, x: 100, y: 200, active: false, name: "" };
	}

	const workers = new Array(WORKERS)
		.fill(0)
		.map(
			() => new Worker(new URL("./parallel-worker.ts", import.meta.url).href),
		);

	const promises = workers.map(
		(w, index) =>
			new Promise((resolve) => {
				const start = index * CHUNK;
				const end = (index + 1) * CHUNK;
				const slice = players.slice(start, end);

				w.onmessage = (_) => resolve(true);

				w.postMessage({
					type: "native",
					payload: slice,
				});
			}),
	);

	await Promise.all(promises);

	for (const w of workers) w.terminate();
}

if (MODE === "struct") {
	runStruct();
} else {
	runNative();
}
