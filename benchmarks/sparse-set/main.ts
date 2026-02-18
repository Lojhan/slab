// benchmarks/sparse-set/main.ts
import { SparseSet, StructCollection } from "../../src/index.js";
import { ComponentSchema } from "./schema.js";

const COUNT = 100_000;
const MAX_ID = COUNT * 2;
const ITERATIONS = 100_000;

const MODE = process.argv[2] as "sparse-set" | "native";

if (!MODE) {
	console.error(
		"Usage: bun run benchmarks/sparse-set/main.ts <sparse-set|native>",
	);
	process.exit(1);
}

async function run() {
	if (MODE === "sparse-set") {
		const collection = new StructCollection(ComponentSchema.definition, COUNT);
		const sparseSet = new SparseSet(collection, MAX_ID);

		// Populate data
		const view = collection.createView();
		for (let i = 0; i < COUNT; i++) {
			const id = i * 2;
			const index = sparseSet.add(id);
			view.use(index.val);
			view.val = i;
		}

		const worker = new Worker(new URL("./worker.ts", import.meta.url).href);

		const p = new Promise((resolve) => {
			worker.onmessage = resolve;
			worker.postMessage({
				mode: "sparse-set",
				buffer: collection.buffer,
				count: COUNT,
				maxId: MAX_ID,
				sparseBuffers: sparseSet.buffers,
				iterations: ITERATIONS,
			});
		});
		await p;
		worker.terminate();
	} else {
		// Native Mode: Send Array + Map (as Object)
		// Simulating sending a snapshot of Game State
		const data = new Array(COUNT);
		const map: Record<number, number> = {};

		for (let i = 0; i < COUNT; i++) {
			data[i] = { val: i };
			map[i * 2] = i;
		}

		const worker = new Worker(new URL("./worker.ts", import.meta.url).href);

		const p = new Promise((resolve) => {
			worker.onmessage = resolve;
			worker.postMessage({
				mode: "native",
				data,
				map,
				iterations: ITERATIONS,
				maxId: MAX_ID,
			});
		});
		await p;
		worker.terminate();
	}
}

run();
