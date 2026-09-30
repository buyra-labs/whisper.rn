# ggml's operator tests (tests/test-backend-ops.cpp at the vendored whisper.cpp
# commit, plus the whisper-shaped BUYRA_* cases) against the vendored ggml with
# its Vulkan backend, on a desktop GPU. See README.md in this directory.
cmake_minimum_required(VERSION 3.19)
project(rnwhisper-vulkan-tests C CXX)
set(GGML_VULKAN ON CACHE BOOL "" FORCE)
add_subdirectory(../../vendor/whisper.cpp/ggml ggml)
add_executable(test-backend-ops test-backend-ops.cpp)
target_link_libraries(test-backend-ops PRIVATE ggml)
