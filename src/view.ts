import { Schema } from "./schema.js";
import {
	type InferSchema,
	type PrimitiveType,
	type SchemaDefinition,
	TYPE_SIZES,
} from "./types.js";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export function createSoAStructClass<T extends SchemaDefinition>(
	schema: Schema<T>,
	capacity: number,
) {
	const fieldOffsets = new Map<string, number>();
	let currentOffset = 0;

	for (const [key, type] of schema.fields) {
		let size = 0;
		let align = 1;

		if (typeof type === "string" && type !== "mutex") {
			size = TYPE_SIZES[type];
			align = size;
		} else if (type === "mutex") {
			size = 4;
			align = 4;
		} else if (typeof type === "object") {
			if (type.type === "string") {
				size = type.length;
				align = 1;
			} else if (type.type === "struct") {
				const nestedSchema = new Schema(type.definition);
				size = nestedSchema.size;
				// biome-ignore lint/suspicious/noExplicitAny: Internal property
				align = (nestedSchema as any).alignment || 8;
			}
		}

		if (currentOffset % align !== 0) {
			currentOffset += align - (currentOffset % align);
		}

		fieldOffsets.set(key as string, currentOffset);
		currentOffset += size * capacity;
	}

	// biome-ignore lint/suspicious/noExplicitAny: Dynamic class generation
	const initializers: ((instance: any) => void)[] = [];

	class SoAStruct {
		public __view: DataView;
		public __index: number;
		public __startOffset: number;

		constructor(buffer: SharedArrayBuffer, startOffset: number) {
			this.__view = new DataView(buffer);
			this.__startOffset = startOffset;
			this.__index = 0;
			for (const init of initializers) {
				init(this);
			}
		}

		public __use(index: number) {
			this.__index = index;
			return this;
		}
	}

	for (const [key, type] of schema.fields) {
		// biome-ignore lint/style/noNonNullAssertion: Key guaranteed to exist
		const fieldStart = fieldOffsets.get(key as string)!;

		if (typeof type === "object" && type.type === "struct") {
			const nestedSchema = new Schema(type.definition);
			const NestedStruct = createStructClass(nestedSchema);

			initializers.push((instance) => {
				// biome-ignore lint/suspicious/noExplicitAny: Dynamic logic
				instance[`__${String(key)}`] = new (NestedStruct as any)(
					instance.__view.buffer,
					instance.__startOffset + fieldStart, // Initial offset
				);
			});

			Object.defineProperty(SoAStruct.prototype, key, {
				get: function () {
					const nested = this[`__${String(key)}`];
					const structSize = nestedSchema.size;
					nested.__offset =
						this.__startOffset + fieldStart + this.__index * structSize;
					return nested;
				},
				enumerable: true,
			});
			continue;
		}

		let itemSize = 0;
		let isString = false;
		let strLen = 0;

		if (typeof type === "string") {
			itemSize = TYPE_SIZES[type];
		} else if (type.type === "string") {
			itemSize = type.length;
			isString = true;
			strLen = type.length;
		}

		const primitive = type as PrimitiveType;
		const capKey = String(key)[0].toUpperCase() + String(key).slice(1);

		if (
			["int8", "uint8", "int16", "uint16", "int32", "uint32", "mutex"].includes(
				primitive,
			)
		) {
			const typeName = primitive === "mutex" ? "int32" : primitive;
			// biome-ignore lint/suspicious/noExplicitAny: Dynamic logic
			const TypedArrayConstructor: any = {
				int8: Int8Array,
				uint8: Uint8Array,
				int16: Int16Array,
				uint16: Uint16Array,
				int32: Int32Array,
				uint32: Uint32Array,
			}[typeName as string];
			const elementSize = TYPE_SIZES[typeName];
			const shift = Math.log2(elementSize);

			initializers.push((instance) => {
				const ctorName = `__${typeName}Array`;
				if (!instance[ctorName]) {
					instance[ctorName] = new TypedArrayConstructor(
						instance.__view.buffer,
					);
				}
			});

			const arrayName = `__${typeName}Array`;

			if (primitive !== "mutex") {
				// Atomic ops
				const ops = ["Add", "Sub", "And", "Or", "Xor", "Exchange"];
				ops.forEach((op) => {
					Object.defineProperty(SoAStruct.prototype, `atomic${op}${capKey}`, {
						value: function (val: number) {
							const offset =
								this.__startOffset + fieldStart + this.__index * itemSize;
							const idx = offset >> shift;
							// biome-ignore lint/suspicious/noExplicitAny: Dynamic logic
							return (Atomics as any)[op.toLowerCase()](
								this[arrayName],
								idx,
								val,
							);
						},
						writable: true,
						configurable: true,
					});
				});

				Object.defineProperty(
					SoAStruct.prototype,
					`atomicCompareExchange${capKey}`,
					{
						value: function (expected: number, replacement: number) {
							const offset =
								this.__startOffset + fieldStart + this.__index * itemSize;
							const idx = offset >> shift;
							return Atomics.compareExchange(
								this[arrayName],
								idx,
								expected,
								replacement,
							);
						},
						writable: true,
						configurable: true,
					},
				);
			} else {
				// Mutex ops
				const canWait = typeof Atomics.wait === "function";
				Object.defineProperties(SoAStruct.prototype, {
					[`lock${capKey}`]: {
						value: function () {
							const offset =
								this.__startOffset + fieldStart + this.__index * itemSize;
							const idx = offset >> shift;
							while (
								Atomics.compareExchange(this[arrayName], idx, 0, 1) !== 0
							) {
								if (canWait) {
									try {
										Atomics.wait(this[arrayName], idx, 1);
									} catch {}
								}
							}
						},
						writable: true,
						configurable: true,
					},
					[`unlock${capKey}`]: {
						value: function () {
							const offset =
								this.__startOffset + fieldStart + this.__index * itemSize;
							const idx = offset >> shift;
							Atomics.store(this[arrayName], idx, 0);
							Atomics.notify(this[arrayName], idx, 1);
						},
						writable: true,
						configurable: true,
					},
					[`tryLock${capKey}`]: {
						value: function (): boolean {
							const offset =
								this.__startOffset + fieldStart + this.__index * itemSize;
							const idx = offset >> shift;
							return Atomics.compareExchange(this[arrayName], idx, 0, 1) === 0;
						},
						writable: true,
						configurable: true,
					},
				});
			}
		}

		Object.defineProperty(SoAStruct.prototype, key, {
			get: function () {
				const offset =
					this.__startOffset + fieldStart + this.__index * itemSize;

				if (isString) {
					const bytes = new Uint8Array(
						this.__view.buffer,
						this.__view.byteOffset + offset,
						strLen,
					);
					let end = 0;
					while (end < strLen && bytes[end] !== 0) end++;
					return TEXT_DECODER.decode(bytes.subarray(0, end));
				}

				switch (primitive) {
					case "int8":
						return this.__view.getInt8(offset);
					case "uint8":
						return this.__view.getUint8(offset);
					case "int16":
						return this.__view.getInt16(offset, true);
					case "uint16":
						return this.__view.getUint16(offset, true);
					case "int32":
						return this.__view.getInt32(offset, true);
					case "uint32":
						return this.__view.getUint32(offset, true);
					case "float32":
						return this.__view.getFloat32(offset, true);
					case "float64":
						return this.__view.getFloat64(offset, true);
					case "boolean":
						return !!this.__view.getUint8(offset);
				}
			},
			// biome-ignore lint/suspicious/noExplicitAny: Mixed value type
			set: function (val: any) {
				const offset =
					this.__startOffset + fieldStart + this.__index * itemSize;

				if (isString) {
					const bytes = new Uint8Array(
						this.__view.buffer,
						this.__view.byteOffset + offset,
						strLen,
					);
					const encoded = TEXT_ENCODER.encode(val);
					bytes.set(encoded.subarray(0, strLen));
					if (encoded.length < strLen) {
						bytes[encoded.length] = 0;
					}
					return;
				}

				switch (primitive) {
					case "int8":
						this.__view.setInt8(offset, val);
						break;
					case "uint8":
						this.__view.setUint8(offset, val);
						break;
					case "int16":
						this.__view.setInt16(offset, val, true);
						break;
					case "uint16":
						this.__view.setUint16(offset, val, true);
						break;
					case "int32":
						this.__view.setInt32(offset, val, true);
						break;
					case "uint32":
						this.__view.setUint32(offset, val, true);
						break;
					case "float32":
						this.__view.setFloat32(offset, val, true);
						break;
					case "float64":
						this.__view.setFloat64(offset, val, true);
						break;
					case "boolean":
						this.__view.setUint8(offset, val ? 1 : 0);
						break;
				}
			},
			enumerable: true,
		});
	}

	return SoAStruct as unknown as {
		new (
			buffer: SharedArrayBuffer,
			startOffset: number,
			// biome-ignore lint/suspicious/noExplicitAny: Internal use
		): InferSchema<T> & { __use(index: number): any };
		getSize(): number;
	};
}

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
	// biome-ignore lint/suspicious/noExplicitAny: Dynamic class generation
	const initializers: ((instance: any) => void)[] = [];

	class SpecializedStruct {
		public __view: DataView;
		public __offset: number;

		constructor(buffer: SharedArrayBuffer, offset: number) {
			this.__view = new DataView(buffer);
			this.__offset = offset;
			for (const init of initializers) {
				init(this);
			}
		}

		static getSize() {
			return schema.size;
		}

		public __use(index: number) {
			this.__offset = index * schema.size;
			// Update nested views recursively?
			// The original implementation idea for nested views was:
			// get nested() { this._nested.__offset = this.__offset + offset; return this._nested; }
			// This means nested views are lazy-updated on access. Which is good.
			// However, if one holds a reference to nested view:
			// const n = view.nested;
			// view.use(1);
			// n.x -> Still points to old?
			// No, n.__offset is NOT updated until `view.nested` is called again.
			// This matches "Aliasing Risk" section 3.3.
			return this;
		}
	}

	for (const [key, type] of schema.fields) {
		// biome-ignore lint/style/noNonNullAssertion: We are confident that the key exists in the offsets map
		const offset = schema.offsets.get(key)!;

		if (typeof type === "object" && type.type === "struct") {
			const nestedSchema = new Schema(type.definition);
			const NestedStruct = createStructClass(nestedSchema);

			initializers.push((instance) => {
				// biome-ignore lint/suspicious/noExplicitAny: Dynamically created class
				instance[`__${String(key)}`] = new (NestedStruct as any)(
					instance.__view.buffer,
					instance.__offset + offset,
				);
			});

			Object.defineProperty(SpecializedStruct.prototype, key, {
				get: function () {
					const nested = this[`__${String(key)}`];
					nested.__offset = this.__offset + offset;
					return nested;
				},
				enumerable: true,
				configurable: false,
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
		const capKey = String(key)[0].toUpperCase() + String(key).slice(1);

		// Add Atomic operations for integer types
		if (
			["int8", "uint8", "int16", "uint16", "int32", "uint32"].includes(
				primitive,
			)
		) {
			// biome-ignore lint/suspicious/noExplicitAny: Dynamic logic
			const TypedArrayConstructor: any = {
				int8: Int8Array,
				uint8: Uint8Array,
				int16: Int16Array,
				uint16: Uint16Array,
				int32: Int32Array,
				uint32: Uint32Array,
			}[primitive as string];
			const elementSize = TYPE_SIZES[primitive];
			const shift = Math.log2(elementSize);

			initializers.push((instance) => {
				const ctorName = `__${primitive}Array`;
				if (!instance[ctorName]) {
					instance[ctorName] = new TypedArrayConstructor(
						instance.__view.buffer,
					);
				}
			});

			const arrayName = `__${primitive}Array`;

			Object.defineProperties(SpecializedStruct.prototype, {
				[`atomicAdd${capKey}`]: {
					value: function (val: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.add(this[arrayName], idx, val);
					},
					enumerable: false,
					configurable: false,
				},
				[`atomicSub${capKey}`]: {
					value: function (val: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.sub(this[arrayName], idx, val);
					},
					enumerable: false,
					configurable: false,
				},
				[`atomicAnd${capKey}`]: {
					value: function (val: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.and(this[arrayName], idx, val);
					},
					enumerable: false,
					configurable: false,
				},
				[`atomicOr${capKey}`]: {
					value: function (val: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.or(this[arrayName], idx, val);
					},
					enumerable: false,
					configurable: false,
				},
				[`atomicXor${capKey}`]: {
					value: function (val: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.xor(this[arrayName], idx, val);
					},
					enumerable: false,
					configurable: false,
				},
				[`atomicExchange${capKey}`]: {
					value: function (val: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.exchange(this[arrayName], idx, val);
					},
					enumerable: false,
					configurable: false,
				},
				[`atomicCompareExchange${capKey}`]: {
					value: function (expected: number, replacement: number) {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.compareExchange(
							this[arrayName],
							idx,
							expected,
							replacement,
						);
					},
					enumerable: false,
					configurable: false,
				},
			});
		} // End of atomic integer block

		if (primitive === "mutex") {
			// Ensure Int32Array is available
			const mutexType = "int32";
			const shift = 2; // log2(4)

			initializers.push((instance) => {
				const ctorName = `__${mutexType}Array`;
				if (!instance[ctorName]) {
					instance[ctorName] = new Int32Array(instance.__view.buffer);
				}
			});

			const arrayName = `__${mutexType}Array`;
			const canWait = typeof Atomics.wait === "function";

			Object.defineProperties(SpecializedStruct.prototype, {
				[`lock${capKey}`]: {
					value: function () {
						const idx = (this.__offset + offset) >> shift;
						while (Atomics.compareExchange(this[arrayName], idx, 0, 1) !== 0) {
							if (canWait) {
								try {
									Atomics.wait(this[arrayName], idx, 1);
								} catch {}
							}
						}
					},
					enumerable: false,
					configurable: false,
				},
				[`unlock${capKey}`]: {
					value: function () {
						const idx = (this.__offset + offset) >> shift;
						Atomics.store(this[arrayName], idx, 0);
						Atomics.notify(this[arrayName], idx, 1);
					},
					enumerable: false,
					configurable: false,
				},
				[`tryLock${capKey}`]: {
					value: function (): boolean {
						const idx = (this.__offset + offset) >> shift;
						return Atomics.compareExchange(this[arrayName], idx, 0, 1) === 0;
					},
					enumerable: false,
					configurable: false,
				},
			});
		}

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
					case "mutex":
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
					case "mutex":
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
