// benchmarks/flyweight/worker.ts
import { StructCollection } from "../../src/index.js";
import { ComponentSchema } from "./schema.js";

declare const self: Worker;

self.onmessage = (e: MessageEvent) => {
	const { type, payload, buffer, count } = e.data;

	if (type === "objects") {
		// Just iterate to ensure data was accessed
		let _sum = 0;
		for (const obj of payload) {
			_sum += obj.x;
		}
		self.postMessage("done");
	} else {
		const collection = new StructCollection(ComponentSchema, count, buffer);
		const view = collection.createView();
		let _sum = 0;
		for (let i = 0; i < count; i++) {
			view.use(i);
			_sum += view.x;
		}
		self.postMessage("done");
	}
};
