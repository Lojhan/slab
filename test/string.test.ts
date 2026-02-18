import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { StructCollection, schema } from "../src/index.js";

describe("String Handling", () => {
	const StringDef = schema.create({
		name: schema.string(10),
	});

	const collection = new StructCollection(StringDef.definition, 5);
	const item = collection.get(0);

	test("Normal string", () => {
		item.name = "Hello";
		assert.equal(item.name, "Hello");
	});

	test("Exact length string", () => {
		const tenChars = "1234567890";
		item.name = tenChars;
		assert.equal(item.name, tenChars);
	});

	test("Truncation", () => {
		const longString = "This is way too long for the buffer";
		item.name = longString;
		assert.equal(item.name, "This is wa"); // 10 chars
	});

	test("Unicode (UTF-8 multi-byte characters)", () => {
		const euros = "€€€";
		item.name = euros;
		assert.equal(item.name, euros);
	});

	test("Truncating in middle of multibyte char", () => {
		item.name = "€€€a";
		assert.equal(item.name, "€€€a");
	});
});
