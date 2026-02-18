// benchmarks/sparse-set/worker.ts
import { SparseSet, StructCollection } from "../../src/index.js";
import { ComponentSchema } from "./schema.js";

declare const self: Worker;

self.onmessage = (e: MessageEvent) => {
	const { mode, buffer, count, maxId, sparseBuffers, iterations, data, map } =
		e.data;

	// Use a simple LCG for deterministic random numbers
	let seed = 12345;
	const random = () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return Math.abs(seed);
	};

	let _sum = 0;

	if (mode === "sparse-set") {
		const collection = new StructCollection(
			ComponentSchema.definition,
			count,
			buffer,
		);
		const sparseSet = new SparseSet(collection, maxId, sparseBuffers);
		const view = collection.createView();

		for (let i = 0; i < iterations; i++) {
			const id = random() % maxId;
			const index = sparseSet.get(id);

			if (index?.val && index?.val !== -1) {
				view.use(index.val);
				_sum += view.val;
			}
		}
	} else {
		// Native lookup: Map + Array Access
		for (let i = 0; i < iterations; i++) {
			const id = random() % maxId;
			const idx = map[id];
			if (idx !== undefined) {
				// Access object property
				_sum += data[idx].val;
			}
		}
	}

	self.postMessage("done");
};
