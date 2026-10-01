# whisper.cpp's model quantizer (examples/quantize at the vendored commit),
# with IQ4_NL enabled. Builds against the vendored ggml, CPU only.
cmake_minimum_required(VERSION 3.19)
project(rnwhisper-quantize C CXX)
set(CMAKE_CXX_STANDARD 17)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE ON CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../../vendor/whisper.cpp/ggml ggml)
add_executable(whisper-quantize quantize.cpp common-ggml.cpp)
target_include_directories(whisper-quantize PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../../vendor/whisper.cpp/examples)
target_link_libraries(whisper-quantize PRIVATE ggml)
