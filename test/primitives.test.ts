import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { StructCollection, schema } from "../src/index.js";

describe("Primitive Types", () => {
	const PrimitivesDef = schema.create({
		i8: schema.int8(),
		u8: schema.uint8(),
		i16: schema.int16(),
		u16: schema.uint16(),
		i32: schema.int32(),
		u32: schema.uint32(),
		f32: schema.float32(),
		f64: schema.float64(),
		bool: schema.boolean(),
	});

	const collection = new StructCollection(PrimitivesDef.definition, 2);

	describe("Int8", () => {
		test("should store minimum value", () => {
			const struct = collection.get(0);
			struct.i8 = -128;
			assert.equal(struct.i8, -128);
		});

		test("should store maximum value", () => {
			const struct = collection.get(0);
			struct.i8 = 127;
			assert.equal(struct.i8, 127);
		});

		test("should handle overflow", () => {
			const struct = collection.get(0);
			struct.i8 = 255;
			assert.equal(struct.i8, -1);
		});
	});

	describe("Uint8", () => {
		test("should store maximum value", () => {
			const struct = collection.get(0);
			struct.u8 = 255;
			assert.equal(struct.u8, 255);
		});

		test("should handle underflow", () => {
			const struct = collection.get(0);
			struct.u8 = -1;
			assert.equal(struct.u8, 255);
		});
	});

	describe("Int16", () => {
		test("should store minimum value", () => {
			const struct = collection.get(0);
			struct.i16 = -32768;
			assert.equal(struct.i16, -32768);
		});

		test("should store maximum value", () => {
			const struct = collection.get(0);
			struct.i16 = 32767;
			assert.equal(struct.i16, 32767);
		});
	});

	describe("Uint16", () => {
		test("should store maximum value", () => {
			const struct = collection.get(0);
			struct.u16 = 65535;
			assert.equal(struct.u16, 65535);
		});
	});

	describe("Int32", () => {
		test("should store minimum value", () => {
			const struct = collection.get(0);
			struct.i32 = -2147483648;
			assert.equal(struct.i32, -2147483648);
		});
	});

	describe("Float32", () => {
		test("should store exact values", () => {
			const struct = collection.get(0);
			struct.f32 = 1.5;
			assert.equal(struct.f32, 1.5);
		});

		test("should handle precision loss", () => {
			const struct = collection.get(0);
			struct.f32 = 0.1;
			assert.ok(Math.abs(struct.f32 - 0.1) < 0.000001);
		});
	});

	describe("Float64", () => {
		test("should store Math.PI", () => {
			const struct = collection.get(0);
			struct.f64 = Math.PI;
			assert.equal(struct.f64, Math.PI);
		});
	});

	describe("Boolean", () => {
		test("should store true", () => {
			const struct = collection.get(0);
			struct.bool = true;
			assert.equal(struct.bool, true);
		});

		test("should store false", () => {
			const struct = collection.get(0);
			struct.bool = false;
			assert.equal(struct.bool, false);
		});
	});
});
