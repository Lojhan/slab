# @lojhan/slab

[![CI](https://github.com/lojhan/slab/actions/workflows/ci.yml/badge.svg)](https://github.com/lojhan/slab/actions)
[![npm](https://img.shields.io/npm/v/@lojhan/slab.svg)](https://www.npmjs.com/package/@lojhan/slab)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**High-performance SharedArrayBuffer structs for Node.js, Deno, Bun, and Browsers.**

`slab` allows you to create structured data layouts (structs) backed by `SharedArrayBuffer`, enabling true zero-copy data sharing between JavaScript workers and the main thread. 

It is designed for high-performance applications like game engines, simulations, and data processing pipelines where minimizing garbage collection and transfer overhead is critical.

## Features

- **Zero-Copy Transfer**: Pass complex data structures to workers instantly (12x faster than `postMessage`).
- **Parallel Processing**: Utilize all CPU cores efficiently without serialization overhead.
- **Typed Structs**: Define C-like structs with strictly typed fields (Int32, Float64, Strings, etc.).
- **Memory Efficient**: Uses a single `SharedArrayBuffer` slab for thousands of objects, reducing GC pressure.
- **Flyweight Views**: Avoid creating thousands of JS objects; reuse a single "view" to iterate over millions of entities.
- **Concurrency Primitives**: Built-in support for Atomic operations and Mutex locking.
- **Dual Layout Support**: Switch between **AoS** (Array of Structures) and **SoA** (Structure of Arrays) with a single config flag.
- **Sparse Sets**: Includes a high-performance Sparse Set implementation for Entity Component Systems (ECS).

## Installation

```bash
npm install @lojhan/slab
```

## ⚡ Quick Start

### 1. Define a Schema

```typescript
import { schema, StructCollection } from "@lojhan/slab";

// Define a "Player" struct
const PlayerSchema = {
    id: schema.uint32(),
    x: schema.float32(),
    y: schema.float32(),
    health: schema.uint8(),
    name: schema.string(16) // Fixed-size string (16 bytes)
};

// Create a collection that holds 1,000 players
const players = new StructCollection(PlayerSchema, 1000);

// Access a player at index 0
const p1 = players.get(0);
p1.id = 1;
p1.x = 10.5;
p1.y = 20.0;
p1.health = 100;
p1.name = "Hero";

console.log(p1.name); // "Hero"
console.log(p1.x);    // 10.5
```

### 2. Zero-Copy Worker Transfer

The real power of `slab` comes when using Workers. Instead of copying data, you share the underlying buffer.

**Main Thread:**
```typescript
import { Worker } from "node:worker_threads";
import { StructCollection } from "@lojhan/slab";
import { PlayerSchema } from "./schema"; 

const players = new StructCollection(PlayerSchema, 10000);
const worker = new Worker("./worker.js");

// Send the SharedArrayBuffer to the worker (Zero Copy!)
worker.postMessage(players.buffer);
```

**Worker Thread:**
```typescript
import { parentPort } from "node:worker_threads";
import { StructCollection } from "@lojhan/slab";
import { PlayerSchema } from "./schema";

parentPort.on("message", (buffer) => {
    // Reconstruct the collection from the shared buffer
    const players = new StructCollection(PlayerSchema, 10000, buffer);
    
    // Create a reusable view for iteration (Flyweight Pattern)
    const view = players.createView();
    
    for (let i = 0; i < 10000; i++) {
        view.use(i); // Point the view to the i-th struct
        view.x += 1.0; // Update shared memory directly
    }
});
```

## Benchmarks

Benchmarks run on Apple M1 (macOS).

| Benchmark | Result | Improvement |
|-----------|--------|-------------|
| **Zero-Copy Transfer** | Struct vs Native Serialized | **11.88x Faster** |
| **Allocation** | Struct vs Native Objects | **2.71x Faster** |
| **Parallel Processing** | Struct vs Native Workers | **2.61x Faster** |
| **Sparse Set Lookup** | Slab vs Native Map | **1.90x Faster** |

*Note: Single-threaded reads/writes are generally slower than native V8 objects due to the overhead of `DataView` accessors. This library is optimized for multi-threaded/shared-memory scenarios.*

## API Reference

### Schemas
Supported types:
- `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`
- `float32`, `float64`
- `boolean`
- `string(length)` (UTF-8)
- `mutex` (32-bit lock)

### Collections
- `new StructCollection(schema, capacity, buffer?, options?)`: Create a new collection.
- `collection.get(index)`: Get a view for a specific index.
- `collection.createView()`: Get a reusable flyweight view.
- `collection.buffer`: The underlying `SharedArrayBuffer`.

### Thread Safety
For safe concurrent access, use the `mutex` type and locking methods:

```typescript
const Data = {
    value: schema.int32(),
    mutex: schema.mutex()
};
const items = new StructCollection(Data, 10);
const item = items.get(0);

// Blocking lock
item.lockMutex(); 
item.value += 1;
item.unlockMutex();

// Non-blocking try-lock
if (item.tryLockMutex()) {
    item.value += 1;
    item.unlockMutex();
}
```

## License

MIT © [Vinicius Lojhan](https://github.com/Lojhan)
