import { Schema } from "./schema.js";
import type { InferSchema, PrimitiveType, SchemaDefinition } from "./types.js";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/**
 * Dynamically creates a class that acts as a view over a `SharedArrayBuffer`
 * based on the provided schema.
 *
 * This function generates getters and setters for each field in the schema,
 * allowing property access to read/write directly to the underlying buffer.
 *
 * @param schema The schema definition to generate the view for.
 * @returns A class constructor that can be instantiated with a buffer and offset.
 *          The generated class provides properties matching the schema.
 */
export function createStructClass<T extends SchemaDefinition>(
	schema: Schema<T>,
) {
	class SpecializedStruct {
		// biome-ignore lint/correctness/noUnusedPrivateClassMembers: These private members are used internally by the dynamically defined getters/setters
		private __view: DataView;
		// biome-ignore lint/correctness/noUnusedPrivateClassMembers: These private members are used internally by the dynamically defined getters/setters
		private __offset: number;

		constructor(buffer: SharedArrayBuffer, offset: number) {
			this.__view = new DataView(buffer);
			this.__offset = offset;
		}

		static getSize() {
			return schema.size;
		}
	}

	for (const [key, type] of schema.fields) {
		// biome-ignore lint/style/noNonNullAssertion: We are confident that the key exists in the offsets map
		const offset = schema.offsets.get(key)!;

		if (typeof type === "object" && type.type === "struct") {
			const nestedSchema = new Schema(type.definition);
			const NestedStruct = createStructClass(nestedSchema);

			Object.defineProperty(SpecializedStruct.prototype, key, {
				get: function () {
					// biome-ignore lint/suspicious/noExplicitAny: Dynamically created class
					return new (NestedStruct as any)(
						this.__view.buffer,
						this.__offset + offset,
					);
				},
			});
			continue;
		}

		// String handling
		if (typeof type === "object" && type.type === "string") {
			const length = type.length;
			Object.defineProperty(SpecializedStruct.prototype, key, {
				get: function () {
					const bytes = new Uint8Array(
						this.__view.buffer,
						this.__view.byteOffset + this.__offset + offset,
						length,
					);
					let end = 0;
					while (end < length && bytes[end] !== 0) end++;
					return TEXT_DECODER.decode(bytes.subarray(0, end));
				},
				set: function (val: string) {
					const bytes = new Uint8Array(
						this.__view.buffer,
						this.__view.byteOffset + this.__offset + offset,
						length,
					);
					const encoded = TEXT_ENCODER.encode(val);
					bytes.set(encoded.subarray(0, length));
					if (encoded.length < length) {
						bytes[encoded.length] = 0;
					}
				},
				enumerable: true,
				configurable: false,
			});
			continue;
		}

		const primitive = type as PrimitiveType;
		Object.defineProperty(SpecializedStruct.prototype, key, {
			get: function () {
				switch (primitive) {
					case "int8":
						return this.__view.getInt8(this.__offset + offset);
					case "uint8":
						return this.__view.getUint8(this.__offset + offset);
					case "int16":
						return this.__view.getInt16(this.__offset + offset, true);
					case "uint16":
						return this.__view.getUint16(this.__offset + offset, true);
					case "int32":
						return this.__view.getInt32(this.__offset + offset, true);
					case "uint32":
						return this.__view.getUint32(this.__offset + offset, true);
					case "float32":
						return this.__view.getFloat32(this.__offset + offset, true);
					case "float64":
						return this.__view.getFloat64(this.__offset + offset, true);
					case "boolean":
						return !!this.__view.getUint8(this.__offset + offset);
				}
			},
			set: function (val: number | boolean) {
				switch (primitive) {
					case "int8":
						this.__view.setInt8(this.__offset + offset, val as number);
						break;
					case "uint8":
						this.__view.setUint8(this.__offset + offset, val as number);
						break;
					case "int16":
						this.__view.setInt16(this.__offset + offset, val as number, true);
						break;
					case "uint16":
						this.__view.setUint16(this.__offset + offset, val as number, true);
						break;
					case "int32":
						this.__view.setInt32(this.__offset + offset, val as number, true);
						break;
					case "uint32":
						this.__view.setUint32(this.__offset + offset, val as number, true);
						break;
					case "float32":
						this.__view.setFloat32(this.__offset + offset, val as number, true);
						break;
					case "float64":
						this.__view.setFloat64(this.__offset + offset, val as number, true);
						break;
					case "boolean":
						this.__view.setUint8(this.__offset + offset, val ? 1 : 0);
						break;
				}
			},
			enumerable: true,
			configurable: false,
		});
	}

	return SpecializedStruct as unknown as {
		new (buffer: SharedArrayBuffer, offset: number): InferSchema<T>;
		getSize(): number;
	};
}
