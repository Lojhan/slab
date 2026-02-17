import { strict as assert } from "node:assert";
import { test } from "node:test";
import { StructCollection, schema } from "../src/index.js";

test("Multiple Views", (_t) => {
	const Def = schema.create({ x: schema.int32() });
	const collection = new StructCollection(Def.definition, 10);

	const view1 = collection.get(0);
	const view2 = collection.get(0);

	assert.notStrictEqual(view1, view2);

	view1.x = 42;
	assert.equal(view2.x, 42);

	view2.x = 100;
	assert.equal(view1.x, 100);
});

test("Buffer Access", (_t) => {
	const Def = schema.create({ x: schema.int32() });
	const collection = new StructCollection(Def.definition, 10);

	const view = collection.get(0);
	view.x = 0x12345678;

	// Direct SAB access
	const rawArray = new Int32Array(collection.buffer);
	assert.equal(rawArray[0], 0x12345678);
});
