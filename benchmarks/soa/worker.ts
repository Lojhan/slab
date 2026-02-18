// benchmarks/soa/worker.ts
import { StructCollection } from "../../src/index.js";
import { PositionSchema } from "./schema.js";

declare const self: Worker;

self.onmessage = (e: MessageEvent) => {
	const { buffer, count, layout, start, end } = e.data;

	const collection = new StructCollection(PositionSchema, count, buffer, {
		layout,
	});
	const view = collection.createView();

	// Simulate physics update loop
	for (let i = start; i < end; i++) {
		view.__use(i);
		view.x += view.vx;
		view.y += view.vy;
		view.z += 0.01;
	}

	self.postMessage("done");
};
