import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schema } from "../src/builder.js";
import { StructCollection } from "../src/collection.js";

describe("Concurrency Features", () => {
	it("should support atomic operations on integer fields", () => {
		const Player = {
			health: schema.int32(),
			score: schema.uint32(),
		};
		const collection = new StructCollection(Player, 1);
		const view = collection.get(0);
		view.health = 100;

		// generated method: atomicAddHealth
		const oldVal = view.atomicAddHealth(10);
		assert.equal(oldVal, 100);
		assert.equal(view.health, 110);

		// generated method: atomicSubHealth
		const oldVal2 = view.atomicSubHealth(50);
		assert.equal(oldVal2, 110);
		assert.equal(view.health, 60);

		// generated method: lockHealth exists? (implied by primitive check, though test doesn't check mutex logic here)
	});
});
