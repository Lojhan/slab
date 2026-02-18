import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schema } from "../src/builder.js";
import { StructCollection } from "../src/collection.js";
import { SparseSet } from "../src/sparse-set.js";

describe("Sparse Set / Entity Indexing", () => {
	it("should map entity IDs to dense indices", () => {
		const Point = { x: schema.float32(), y: schema.float32() };
		const collection = new StructCollection(Point, 10);
		const set = new SparseSet(collection, 100); // 100 max ID

		// Add Entity 50
		const v1 = set.add(50);
		v1.x = 10;
		v1.y = 20;

		assert.equal(set.has(50), true);
		assert.equal(set.has(51), false);

		// Get view for Entity 50
		const v2 = set.get(50);
		assert.ok(v2);
		assert.equal(v2.x, 10);
		assert.equal(v2.y, 20);

		// Add Entity 10
		const v3 = set.add(10);
		v3.x = 30;
		v3.y = 40;

		// Remove Entity 50.
		set.remove(50);
		assert.equal(set.has(50), false);
		assert.equal(set.has(10), true);

		// Entity 10 data should be preserved (moved)
		const v4 = set.get(10);
		assert.ok(v4);
		assert.equal(v4.x, 30);
		assert.equal(v4.y, 40);

		// Verify internal density
		// set.count should be 1
		assert.equal(set.count, 1);
	});
});
