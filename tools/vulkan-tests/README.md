# Vulkan backend tests

ggml's operator tests (`tests/test-backend-ops.cpp` from the vendored
whisper.cpp commit) with whisper-shaped cases added (`BUYRA_*`: decoder
products with fused adds, encoder projections with bias/residual/GELU,
attention, LayerNorm, softmax with the f16 cast, decoder cross-attention).
Each case runs on the Vulkan backend and is compared with ggml's CPU backend.

```sh
tools/vulkan-tests/run.sh
```

builds against `vendor/whisper.cpp/ggml` with the Android variant's reduced
shader set and runs the relevant operators twice: as the host GPU would run
them, and with `GGML_VK_FORCE_MALI_MM`, `GGML_VK_FORCE_Q5_PLANAR`,
`GGML_VK_FORCE_MALI_SOFTMAX` and `GGML_VK_FORCE_MALI_NORM`, which route
through the Mali kernels on other GPUs (the f16 mat-vec kernel only where
subgroups have 16 lanes). `BUYRA_VK_PIPELINE_CACHE=<file>` makes the binary
use a pipeline cache file.

A GPU family is enabled in `RNWhisper.isVulkanGpuSupported` only after these
tests pass on it. On an Adreno 740 (Galaxy S23), stock ggml-vulkan already
fails there: a q5_0 matmul pipeline does not compile, the f16 model loses the
device, and whisper-sized attention and softmax graphs return wrong values.

On an Android device, build the same directory with the NDK's CMake
toolchain (`-DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake
-DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-29`), push the binary and
run it with `test`. Do not use `perf` mode on small batched shapes on
phones: thousands of tiny dispatches in one submission have crashed a Galaxy
S21's GPU driver.
