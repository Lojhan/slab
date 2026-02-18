// benchmarks/concurrency/main.ts
import { StructCollection } from "../../src/index.js";
import { AtomicSchema, MutexSchema } from "./schema.js";

const WORKERS = 4;
const ITERATIONS = 100_000;

const MODE = process.argv[2] as "atomic" | "mutex";

if (!MODE) {
	console.error("Usage: bun run benchmarks/concurrency/main.ts <atomic|mutex>");
	process.exit(1);
}

async function run() {
	const schema = MODE === "atomic" ? AtomicSchema : MutexSchema;
	const collection = new StructCollection(schema.definition, 1);

	const workers = new Array(WORKERS)
		.fill(0)
		.map(() => new Worker(new URL("./worker.ts", import.meta.url).href));

	const start = performance.now();

	const promises = workers.map(
		(w) =>
			new Promise((resolve) => {
				w.onmessage = () => resolve(true);
				w.postMessage({
					mode: MODE,
					buffer: collection.buffer,
					count: 1, // Single shared resource for contention test
					iterations: ITERATIONS,
				});
			}),
	);

	await Promise.all(promises);
	const end = performance.now();

	const view = collection.get(0);
	const expected = WORKERS * ITERATIONS;
	const actual = "lock" in view ? view.data : view.val;

	console.log(
		`[${MODE.toUpperCase()}] Workers (${WORKERS}) contention test (${ITERATIONS} ops/worker):
		Total Time: ${(end - start).toFixed(2)}ms
		Expected Val: ${expected}
		Actual Val:   ${actual}
		Error:        ${expected - actual}`,
	);

	for (const w of workers) w.terminate();
}

run();
