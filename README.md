# slab

**High-Performance Shared Memory Structs for JavaScript & TypeScript.**

[![CI](https://github.com/viniciuslojhan/slab/actions/workflows/ci.yml/badge.svg)](https://github.com/viniciuslojhan/slab/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

**Slab** provides a strictly typed, C-style struct system backed by `SharedArrayBuffer`. It enables **zero-copy data sharing** between the main thread and Worker threads, eliminating serialization overhead and garbage collection pauses for high-frequency objects.

## 🚀 Features

- **Zero-Copy Concurrency**: Pass data to Workers instantly. No `postMessage` serialization.
- **Predictable Memory**: backed by a single `SharedArrayBuffer`. Zero GC pressure for updates.
- **Type Safe**: Infers TypeScript interfaces directly from your schema definitions.
- **C-Style Structs**: Define strict memory layouts (int8, float64, fixed-length strings).

## 📦 Installation

```bash
npm install slab
# or
bun add slab
```

## ⚡ Quick Start

### 1. Define your Schema

```typescript
import { StructCollection, schema } from 'slab';

// Define a reusable Point struct (Nested Schema)
const Point = schema.create({
  x: schema.float64(),
  y: schema.float64()
});

// Define the main Entity struct
const Player = schema.create({
  id: schema.uint32(),
  pos: Point, // Nesting works naturally
  health: schema.uint8(),
  name: schema.string(16)
});

// Allocate memory for 10,000 players (Single contiguous buffer)
const players = new StructCollection(Player.definition, 10_000);
```

### 2. Read & Write Data

```typescript
// Access the first player
const player = players.get(0);

// Writing values updates the underlying SharedArrayBuffer directly
player.id = 1;
player.pos.x = 100.5; // Nested access
player.pos.y = 200.5;
player.health = 255;
player.name = "Hero"; // Automatically encoded to UTF-8 bytes

// Reading values decodes from the buffer
console.log(player.name); // "Hero"
console.log(player.pos.x); // 100.5
```

### 3. Share with Workers (The Killer Feature)

Pass the raw buffer to a worker. The worker can view the *exact same memory* instantly.

**Main Thread:**
```typescript
const worker = new Worker('worker.js');

// ZERO COPY transfer. Just passing the reference.
worker.postMessage({
  buffer: players.buffer
});
```

**Worker Thread (`worker.js`):**
```typescript
import { StructCollection } from 'slab';
import { PlayerSchema } from './shared-schema'; // Shared definition

self.onmessage = (e) => {
  const { buffer } = e.data;

  // Reconstruct the view over the existing memory
  const players = new StructCollection(PlayerSchema, 10_000, buffer);

  // Process 10,000 entities in parallel without copying data back and forth
  for (let i = 0; i < 10_000; i++) {
    const p = players.get(i);
    p.x += 1.0; // Updates are visible to Main Thread immediately!
  }

  self.postMessage("done");
};
```

## 📊 Performance & Benchmarks

When should you use Slab?

| Operation | Native Objects (V8) | Slab (SharedArrayBuffer) | Winner |
| :--- | :--- | :--- | :--- |
| **Allocation** | Slow (Heap Alloc + GC) | **Instant** (Single Buffer) | 🏆 Slab |
| **Single-Thread Access** | **Fast** (Inline Caching) | Slower (DataView Overhead) | 🏆 Native |
| **Worker Transfer** | Slow (Serialization/Copy) | **Instant** (Zero Copy) | 🏆 Slab |

### Benchmark Results (1 Million Entities)

1. **Allocation**: Slab is **~3x Faster** to allocate than creating 1M JS objects.
2. **Read/Write**: Native JS objects are **~2x Faster** for single-threaded property access due to V8 optimization.
3. **Parallel Processing**: Slab is **~6x Faster** when sharing data with workers because it avoids the structured clone algorithm overhead entirely.

### 💡 Recommendation

- **Use Slab** for:
  - Particle systems (10k+ entities).
  - Physics engines running in workers.
  - Shared state in multiplayer games.
  - High-frequency trading simulations.
  - Any scenario where Garbage Collection pauses are unacceptable.

- **Use Native Objects** for:
  - Deeply nested data structures.
  - General UI state.
  - Simple, single-threaded applications.

## 🛠 API

### `StructCollection<Schema>`

The main entry point. Manages the memory buffer.

- `constructor(schema, capacity)`: Allocates new memory.
- `constructor(schema, capacity, buffer)`: Uses existing memory (for Workers).
- `get(index)`: Returns a view (Accessor) for the item at that index.
- `buffer`: Access the raw `SharedArrayBuffer`.

### `schema` Builder

The recommended way to define schemas. It provides strict typing and enables nesting.

```typescript
import { schema } from 'slab';

const User = schema.create({
  id: schema.uint32(),
  active: schema.boolean(),
  name: schema.string(32),
  stats: schema.create({ // Nested definition
    score: schema.float32(),
    rank: schema.uint8()
  })
});

// Pass User.definition to StructCollection
const users = new StructCollection(User.definition, 100);
```

### Schema Types

| Helper | Description | Size |
| :--- | :--- | :--- |
| `schema.int8()` / `uint8()` | 8-bit integer | 1 |
| `schema.int16()` / `uint16()` | 16-bit integer | 2 |
| `schema.int32()` / `uint32()` | 32-bit integer | 4 |
| `schema.float32()` | 32-bit float | 4 |
| `schema.float64()` | 64-bit float | 8 |
| `schema.boolean()` | Boolean (0/1) | 1 |
| `schema.string(N)` | Fixed-length UTF-8 string | N |
| `schema.create({...})` | Nested struct definition | Variadic |

## License

ISC © Vinicius Lojhan