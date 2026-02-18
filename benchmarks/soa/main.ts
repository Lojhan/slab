import { StructCollection } from "../../src/index.js";
import { PositionSchema } from "./schema.js";

const WORKERS = 4;
const COUNT = 1_000_000;
const CHUNK = Math.floor(COUNT / WORKERS);

const MODE = process.argv[2] as "aos" | "soa";

if (!MODE) {
	console.error("Usage: bun run benchmarks/soa/main.ts <aos|soa>");
	process.exit(1);
}

async function run() {
	// Initialize collection
	const collection = new StructCollection(PositionSchema, COUNT, undefined, {
		layout: MODE,
	});

	// Initialize data
	const view = collection.createView();
	for (let i = 0; i < COUNT; i++) {
		view.use(i);
		view.x = i;
		view.y = i * 0.5;
		view.z = i * 0.25;
		view.w = 1.0;
		view.vx = 0.1;
		view.vy = 0.1;
	}

	const workers = new Array(WORKERS)
		.fill(0)
		.map(() => new Worker(new URL("./worker.ts", import.meta.url).href));

	const start = performance.now();

	const promises = workers.map(
		(w, index) =>
			new Promise((resolve) => {
				w.onmessage = () => resolve(true);
				w.postMessage({
					buffer: collection.buffer,
					count: COUNT,
					layout: MODE,
					start: index * CHUNK,
					end: (index + 1) * CHUNK,
				});
			}),
	);

	await Promise.all(promises);
	const end = performance.now();

	console.log(
		`[${MODE.toUpperCase()}] Workers (${WORKERS}) processing ${COUNT} items: ${(
			end - start
		).toFixed(2)}ms`,
	);

	for (const w of workers) w.terminate();
}

run();
