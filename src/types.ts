/**
 * Represents the primitive data types supported by the library.
 * These types map directly to the underlying `DataView` methods.
 */
export type PrimitiveType =
	| "int8"
	| "uint8"
	| "int16"
	| "uint16"
	| "int32"
	| "uint32"
	| "float32"
	| "float64"
	| "boolean"
	| "mutex";

/**
 * Represents a fixed-length string field in a schema definition.
 * The length is specified in bytes, not characters.
 * Multibyte characters (e.g., emojis) will consume more than one byte.
 * Strings exceeding this length will be truncated when written.
 */
export type StringType = { type: "string"; length: number };

/**
 * Represents a nested struct field in a schema definition.
 * Allows composition of complex data structures.
 */
export type StructType<T extends SchemaDefinition> = {
	type: "struct";
	definition: T;
};

/**
 * A field within a schema definition.
 * Can be a primitive type, a fixed-length string, or a nested struct.
 */
// biome-ignore lint/suspicious/noExplicitAny: Circular Type Definition
export type SchemaField = PrimitiveType | StringType | StructType<any>;

/**
 * Defines the structure of a schema, mapping field names to their types.
 * @example
 * const PlayerSchema = {
 *   id: "uint32",
 *   name: { type: "string", length: 16 },
 *   pos: { type: "struct", definition: { x: "float64", y: "float64" } }
 * };
 */
export type SchemaDefinition = {
	[key: string]: SchemaField;
};

type Capitalize<S extends string> = S extends `${infer First}${infer Rest}`
	? `${Uppercase<First>}${Rest}`
	: S;

type AtomicMethods<K extends string> = {
	[P in `atomicAdd${Capitalize<K>}`]: (val: number) => number;
} & {
	[P in `atomicSub${Capitalize<K>}`]: (val: number) => number;
} & {
	[P in `atomicAnd${Capitalize<K>}`]: (val: number) => number;
} & {
	[P in `atomicOr${Capitalize<K>}`]: (val: number) => number;
} & {
	[P in `atomicXor${Capitalize<K>}`]: (val: number) => number;
} & {
	[P in `atomicExchange${Capitalize<K>}`]: (val: number) => number;
} & {
	[P in `atomicCompareExchange${Capitalize<K>}`]: (
		expected: number,
		replacement: number,
	) => number;
};

type MutexMethods<K extends string> = {
	[P in `lock${Capitalize<K>}`]: () => void;
} & {
	[P in `unlock${Capitalize<K>}`]: () => void;
} & {
	[P in `tryLock${Capitalize<K>}`]: () => boolean;
};

// biome-ignore lint/suspicious/noExplicitAny: Standard U2I pattern
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

type FieldMethods<T extends SchemaDefinition> = UnionToIntersection<
	{
		[K in keyof T]: T[K] extends
			| "int8"
			| "uint8"
			| "int16"
			| "uint16"
			| "int32"
			| "uint32"
			? AtomicMethods<K & string>
			: T[K] extends "mutex"
				? MutexMethods<K & string>
				: never;
	}[keyof T]
>;

/**
 * Utility type to infer the TypeScript type for a given schema field.
 */
export type InferType<T extends SchemaField> = T extends "boolean"
	? boolean
	: T extends StringType
		? string
		: T extends StructType<infer S>
			? InferSchema<S>
			: number;

/**
 * Utility type to infer the TypeScript interface for a complete schema definition.
 * This provides full type safety for reading and writing data.
 */
export type InferSchema<T extends SchemaDefinition> = {
	[K in keyof T]: InferType<T[K]>;
} & FieldMethods<T>;

/**
 * A map of primitive types to their size in bytes.
 * Used for calculating offsets and total struct size.
 */
export const TYPE_SIZES: Record<PrimitiveType, number> = {
	int8: 1,
	uint8: 1,
	int16: 2,
	uint16: 2,
	int32: 4,
	uint32: 4,
	float32: 4,
	float64: 8,
	boolean: 1,
	mutex: 4,
};
