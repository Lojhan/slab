import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schema } from "../src/builder.js";
import { StructCollection } from "../src/collection.js";

describe("SoA Layout Support", () => {
	it("should support SoA layout with same API", () => {
		const Movement = {
			x: schema.float32(),
			y: schema.float32(),
			id: schema.uint32(),
		};

		const collection = new StructCollection(Movement, 100, undefined, {
			layout: "soa",
		});

		const v = collection.createView();
		v.use(0);
		v.x = 10;
		v.y = 20;
		v.id = 1;

		v.use(1);
		v.x = 30;
		v.y = 40;
		v.id = 2;

		v.use(0);
		assert.equal(v.x, 10);
		assert.equal(v.y, 20);
		assert.equal(v.id, 1);

		v.use(1);
		assert.equal(v.x, 30);
		assert.equal(v.y, 40);
		assert.equal(v.id, 2);
	});

	it("should align data correctly in memory for SoA", () => {
		// This test verifies the underlying memory layout
		const Simple = {
			a: schema.uint8(),
			b: schema.uint8(),
		};
		// Capacity 4
		// AoS: a0, b0, a1, b1, a2, b2, a3, b3
		// SoA: a0, a1, a2, a3, b0, b1, b2, b3

		const collection = new StructCollection(Simple, 4, undefined, {
			layout: "soa",
		});
		const view = collection.createView();

		view.use(0);
		view.a = 1;
		view.b = 10;

		view.use(1);
		view.a = 2;
		view.b = 20;

		const u8 = new Uint8Array(collection.buffer);
		// Expect a0=1, a1=2 at indices 0, 1.
		assert.equal(u8[0], 1); // a0
		assert.equal(u8[1], 2); // a1

		// Expect b0 at index 4 (capacity 4 * size 1)
		assert.equal(u8[4], 10); // b0
		assert.equal(u8[5], 20); // b1
	});
});
