// benchmarks/flyweight/main.ts
import { StructCollection } from "../../src/index.js";
import { ComponentSchema } from "./schema.js";

const _WORKERS = 1; // Comparison is mostly about transfer overhead
const COUNT = 1_000_000;

const MODE = process.argv[2] as "serialized" | "shared";

if (!MODE) {
	console.error(
		"Usage: bun run benchmarks/flyweight/main.ts <serialized|shared>",
	);
	process.exit(1);
}

async function run() {
	const worker = new Worker(new URL("./worker.ts", import.meta.url).href);

	if (MODE === "serialized") {
		// 1. Sending JS Objects (Serialized)
		// Create array of objects
		const objects = new Array(COUNT);
		for (let i = 0; i < COUNT; i++) {
			objects[i] = { x: i, y: i, z: i };
		}

		const p1 = new Promise((resolve) => {
			worker.onmessage = resolve;
			worker.postMessage({ type: "objects", payload: objects });
		});
		await p1;
	} else {
		// 2. Sending Shared Buffer (Zero-Copy)
		const collection = new StructCollection(ComponentSchema, COUNT);
		const view = collection.createView();
		for (let i = 0; i < COUNT; i++) {
			view.use(i);
			view.x = i;
			view.y = i;
			view.z = i;
		}

		const p2 = new Promise((resolve) => {
			worker.onmessage = resolve;
			worker.postMessage({
				type: "slab",
				buffer: collection.buffer,
				count: COUNT,
			});
		});
		await p2;
	}

	worker.terminate();
}

run();
