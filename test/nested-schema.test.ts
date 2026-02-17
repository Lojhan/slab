import assert from "node:assert";
import { test } from "node:test";
import { StructCollection, schema } from "../src/index.js";

const Point = schema.create({
	x: schema.float64(),
	y: schema.float64(),
});

const Player = schema.create({
	id: schema.uint32(),
	pos: Point,
	vel: Point,
	active: schema.boolean(),
});

test("Nested Structs", () => {
	const players = new StructCollection(Player.definition, 10);

	const p1 = players.get(0);
	p1.id = 123;
	p1.pos.x = 10.5;
	p1.pos.y = 20.5;
	p1.vel.x = 1.0;
	p1.vel.y = -1.0;
	p1.active = true;

	assert.strictEqual(p1.id, 123);
	assert.strictEqual(p1.pos.x, 10.5);
	assert.strictEqual(p1.pos.y, 20.5);
	assert.strictEqual(p1.vel.x, 1.0);
	assert.strictEqual(p1.vel.y, -1.0);
	assert.strictEqual(p1.active, true);

	// Verify buffer writes
	// id is at offset 0 (4 bytes)
	// pos is at offset 4 (16 bytes) -> x at 4, y at 12?
	// Wait, schema iterates keys. 'pos' is a struct.
	// pos size = 8 + 8 = 16.
	// Point definition: x, y.
	// Point offsets: x: 0, y: 8.
	// Player offsets:
	// id: 0 (size 4)
	// pos: 4 (size 16) -> pos.x at 4+0=4, pos.y at 4+8=12.
	// vel: 20 (size 16) -> vel.x at 20+0=20, vel.y at 20+8=28.
	// active: 36 (size 1)

	const view = new DataView(players.buffer);
	assert.strictEqual(view.getFloat64(4, true), 10.5); // pos.x
	assert.strictEqual(view.getFloat64(12, true), 20.5); // pos.y
	assert.strictEqual(view.getFloat64(20, true), 1.0); // vel.x
});

test("Deep Nesting", () => {
	const Deep = schema.create({
		level1: schema.create({
			level2: schema.create({
				val: schema.uint8(),
			}),
		}),
	});

	const collection = new StructCollection(Deep.definition, 1);
	const item = collection.get(0);

	item.level1.level2.val = 255;
	assert.strictEqual(item.level1.level2.val, 255);
});
