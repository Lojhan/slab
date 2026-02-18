// benchmarks/concurrency/worker.ts
import { StructCollection } from "../../src/index.js";
import { AtomicSchema, MutexSchema } from "./schema.js";

declare const self: Worker;

self.onmessage = (e: MessageEvent) => {
	const { mode, buffer, count, iterations } = e.data;

	if (mode === "atomic") {
		atomicAdd(buffer, count, iterations);
	} else if (mode === "mutex") {
		mutexLock(buffer, count, iterations);
	}

	self.postMessage("done");
};

function atomicAdd(
	buffer: SharedArrayBuffer,
	count: number,
	iterations: number,
) {
	const collection = new StructCollection(
		AtomicSchema.definition,
		count,
		buffer,
	);
	const view = collection.createView();
	view.use(0);
	for (let i = 0; i < iterations; i++) {
		view.atomicAddVal(1);
	}
}

function mutexLock(
	buffer: SharedArrayBuffer,
	count: number,
	iterations: number,
) {
	const collection = new StructCollection(
		MutexSchema.definition,
		count,
		buffer,
	);
	const view = collection.createView();
	view.use(0);
	for (let i = 0; i < iterations; i++) {
		view.lockLock();
		view.data++;
		view.unlockLock();
	}
}
