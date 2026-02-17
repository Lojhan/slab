import type { SchemaDefinition, StringType, StructType } from "./types.js";

/**
 * Creates a nested struct definition.
 * Use this to compose complex schemas where a field is itself another struct.
 * @param definition The schema definition for the nested structure.
 * @returns A struct type definition that can be used as a field in another schema.
 */
function create<T extends SchemaDefinition>(definition: T): StructType<T> {
	return { type: "struct", definition };
}

/**
 * definitions.
 * Strings are encoded as UTF-8 bytes.
 *
 * **WARNING**: Strings exceeding the specified length will be silently truncated
 * to fit the allocated space. The length is in *bytes*, so beware of multibyte characters.
 *
 * @param length The maximum length in bytes allocated for this string.
 * @returns A string type definition.
 */
function string(length: number): StringType {
	return { type: "string", length };
}

/**
 * Helpers for defining schema fields.
 * Each function returns a string literal corresponding to a primitive type.
 */
const primitives = {
	/** Signed 8-bit integer (-128 to 127) */
	int8: () => "int8" as const,
	/** Unsigned 8-bit integer (0 to 255) */
	uint8: () => "uint8" as const,
	/** Signed 16-bit integer (-32,768 to 32,767) */
	int16: () => "int16" as const,
	/** Unsigned 16-bit integer (0 to 65,535) */
	uint16: () => "uint16" as const,
	/** Signed 32-bit integer (-2,147,483,648 to 2,147,483,647) */
	int32: () => "int32" as const,
	/** Unsigned 32-bit integer (0 to 4,294,967,295) */
	uint32: () => "uint32" as const,
	/** 32-bit floating point number (IEEE 754 single-precision) */
	float32: () => "float32" as const,
	/** 64-bit floating point number (IEEE 754 double-precision) */
	float64: () => "float64" as const,
	/** Boolean value (stored as 1 byte: 1 for true, 0 for false) */
	boolean: () => "boolean" as const,
};

/**
 * The main entry point for defining schemas.
 * Provides helper functions for all supported data types.
 *
 * @example
 * const Player = schema.create({
 *   id: schema.uint32(),
 *   health: schema.uint8(),
 *   name: schema.string(16)
 * });
 */
export const schema = {
	...primitives,
	string,
	create,
};
