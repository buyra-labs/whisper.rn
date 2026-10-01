#!/usr/bin/env bash
# Builds the operator tests against the vendored ggml (reduced shader set, as
# in the Android variant) and runs them on the host's Vulkan GPU, first as is
# and then with the Mali paths forced on, each against ggml's CPU backend.
# Usage: tools/vulkan-tests/run.sh [build-dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
build="${1:-$here/build}"
cmake -S "$here" -B "$build" -DCMAKE_BUILD_TYPE=Release \
  -DGGML_VULKAN_SHADER_TYPES=f32,f16,q5_0,iq4_nl -DGGML_VULKAN_NO_FLASH_ATTN=ON > /dev/null
cmake --build "$build" --target test-backend-ops -j > /dev/null
ops="MUL_MAT GET_ROWS CPY SOFT_MAX NORM ADD BUYRA_MM_ADD BUYRA_MM_EPILOGUE BUYRA_ATTN BUYRA_SOFT_MAX_F16 BUYRA_LAYER_NORM BUYRA_CROSS_ATTN"
for mode in default mali; do
  env=()
  if [ "$mode" = mali ]; then
    env=(GGML_VK_FORCE_MALI_MM=1 GGML_VK_FORCE_Q5_PLANAR=1 GGML_VK_FORCE_MALI_SOFTMAX=1 GGML_VK_FORCE_MALI_NORM=1)
  fi
  for op in $ops; do
    result="$(env "${env[@]}" "$build/test-backend-ops" test -b Vulkan0 -o "$op" 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g')"
    echo "[$mode] $op: $(echo "$result" | grep -E 'tests passed' | tr -s ' ')"
    if echo "$result" | grep -qE '\): FAIL'; then
      echo "$result" | grep -E '\): FAIL'
      exit 1
    fi
  done
done
