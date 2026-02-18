import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schema } from "../src/builder.js";
import { StructCollection } from "../src/collection.js";

describe("Struct Copy Operations", () => {
	describe("Primitives", () => {
		it("should copy primitive values in AoS layout", () => {
			const Player = schema.create({
				id: schema.uint32(),
				score: schema.float32(),
				active: schema.boolean(),
			});
			const collection = new StructCollection(Player.definition, 2, undefined, { layout: "aos" });
			const v0 = collection.get(0);
			v0.id = 1;
			v0.score = 100.5;
			v0.active = true;

			collection.copy(0, 1);
			const v1 = collection.get(1);

			assert.equal(v1.id, 1);
			assert.equal(v1.score, 100.5);
			assert.equal(v1.active, true);
		});

		it("should copy primitive values in SoA layout", () => {
			const Player = schema.create({
				id: schema.uint32(),
				score: schema.float32(),
				active: schema.boolean(),
			});
			const collection = new StructCollection(Player.definition, 2, undefined, { layout: "soa" });
			const v0 = collection.get(0);
			v0.id = 1;
			v0.score = 100.5;
			v0.active = true;

			collection.copy(0, 1);
			const v1 = collection.get(1);

			assert.equal(v1.id, 1);
			assert.equal(v1.score, 100.5);
			assert.equal(v1.active, true);
		});
	});

	describe("Strings", () => {
		it("should copy string values in AoS layout", () => {
			const User = schema.create({
				name: schema.string(10),
			});
			const collection = new StructCollection(User.definition, 2, undefined, { layout: "aos" });
			const v0 = collection.get(0);
			v0.name = "Alice";

			collection.copy(0, 1);
			const v1 = collection.get(1);
			assert.equal(v1.name, "Alice");
		});

		it("should copy string values in SoA layout", () => {
			const User = schema.create({
				name: schema.string(10),
			});
			const collection = new StructCollection(User.definition, 2, undefined, { layout: "soa" });
			const v0 = collection.get(0);
			v0.name = "Bob";

			collection.copy(0, 1);
			const v1 = collection.get(1);
			assert.equal(v1.name, "Bob");
		});
	});

	describe("Nested Structs (SoA Check)", () => {
		it("should deep copy nested structs in SoA layout", () => {
			const Vector2 = schema.create({
				x: schema.float32(),
				y: schema.float32(),
			});

			const Player = schema.create({
				id: schema.uint32(),
				pos: Vector2,
			});

			const collection = new StructCollection(Player.definition, 2, undefined, {
				layout: "soa",
			});

			const v0 = collection.get(0);
			v0.id = 1;
			v0.pos.x = 10;
			v0.pos.y = 20;

			const v1 = collection.get(1);
			v1.id = 2; // initial value
			v1.pos.x = 0;
			v1.pos.y = 0;

			// Perform copy from 0 to 1
			collection.copy(0, 1);

			// Verify copy
			assert.equal(v1.id, 1, "Primitive id should be copied");
			assert.equal(v1.pos.x, 10, "Nested x should be copied");
			assert.equal(v1.pos.y, 20, "Nested y should be copied");

			// Modify source to ensure minimal interference
			v0.pos.x = 99;
			assert.equal(v1.pos.x, 10, "Target x should remain independent");
		});

		it("should deep copy deeply nested structs in SoA layout", () => {
			const Inner = schema.create({ val: schema.uint32() });
			const Middle = schema.create({ inner: Inner });
			const Outer = schema.create({ mid: Middle });

			const collection = new StructCollection(Outer.definition, 2, undefined, {
				layout: "soa",
			});

			const v0 = collection.get(0);
			v0.mid.inner.val = 123;

			collection.copy(0, 1);
			const v1 = collection.get(1);
			
			assert.equal(v1.mid.inner.val, 123);
		});
	});
});
