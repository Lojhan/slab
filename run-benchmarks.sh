#!/bin/bash

# Ensure hyperfine is installed
if ! command -v hyperfine &> /dev/null
then
    echo "hyperfine could not be found. Please install it to run benchmarks."
    exit
fi

echo "--- 1. Allocation Benchmark ---"
hyperfine --warmup 3 \
  --export-markdown bench-results-allocation.md \
  'bun run benchmarks/common.ts allocation native' 'bun run benchmarks/common.ts allocation struct'

echo "--- 2. Single-Threaded Write Benchmark ---"
hyperfine --warmup 3 \
  --export-markdown bench-results-write.md \
  'bun run benchmarks/common.ts write native' 'bun run benchmarks/common.ts write struct'

echo "--- 3. Single-Threaded Read Benchmark ---"
hyperfine --warmup 3 \
  --export-markdown bench-results-read.md \
  'bun run benchmarks/common.ts read native' 'bun run benchmarks/common.ts read struct'

echo "--- 4. Parallel Processing (The Real Test) ---"
hyperfine --warmup 2 \
  --export-markdown bench-results-parallel.md \
  'bun run benchmarks/parallel.ts native' 'bun run benchmarks/parallel.ts struct'

echo "Done! Results saved to bench-results-*.md files."
