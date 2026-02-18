import assert from "node:assert/strict";
import { test } from "node:test";
import { StructCollection, schema } from "../src/index.js";

test("StructCollection Basic Usage", () => {
	const PlayerDef = schema.create({
		id: schema.uint32(),
		health: schema.uint8(),
		x: schema.float64(),
		y: schema.float64(),
		active: schema.boolean(),
		name: schema.string(16),
	});

	const count = 10;
	const players = new StructCollection(PlayerDef.definition, count);

	const p0 = players.get(0);
	p0.id = 123;
	p0.health = 100;
	p0.x = 10.5;
	p0.y = 20.5;
	p0.active = true;
	p0.name = "TestPlayer";

	assert.equal(p0.id, 123);
	assert.equal(p0.health, 100);
	assert.equal(p0.x, 10.5);
	assert.equal(p0.y, 20.5);
	assert.equal(p0.active, true);
	assert.equal(p0.name, "TestPlayer");

	const p0_alias = players.get(0);
	assert.equal(p0_alias.id, 123);

	const p1 = players.get(1);
	p1.id = 456;
	assert.equal(p1.id, 456);
	assert.equal(p0.id, 123);
});
