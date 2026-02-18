import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schema } from "../src/builder.js";
import { StructCollection } from "../src/collection.js";

describe("Flyweight Pattern / View Reusability", () => {
	it("should reuse the same view instance", () => {
		const PointSquared = {
			x: schema.float32(),
			y: schema.float32(),
		};

		const collection = new StructCollection(PointSquared, 10);

		// Fill some data
		const p0 = collection.get(0);
		p0.x = 10;
		p0.y = 20;

		const p1 = collection.get(1);
		p1.x = 30;
		p1.y = 40;

		// New API usage: create a view once
		const view = collection.createView();

		// Point to index 0
		view.use(0);
		assert.equal(view.x, 10);
		assert.equal(view.y, 20);

		// Point to index 1 using the SAME view
		view.use(1);
		assert.equal(view.x, 30);
		assert.equal(view.y, 40);

		// Verify it is actually the same object (implied by usage, but let's be explicit)
		const v1 = view.use(0);
		const v2 = view.use(1);
		assert.equal(v1, v2);
	});
});
