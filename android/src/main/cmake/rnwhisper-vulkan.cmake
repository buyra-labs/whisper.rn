# Compiles ggml's Vulkan backend (vendor/whisper.cpp/ggml/src/ggml-vulkan) into
# the rnwhisper_v8fp16_va_2_vulkan core library. rnwhisper/CMakeLists.txt
# includes this file for that variant.
#
# Build host requirements: a host C/C++ compiler (the shader generator runs on
# the build machine). Shaders are compiled with the NDK's glslc, which covers
# the reduced shader set (it lacks only ggml's optional cooperative-matrix,
# integer-dot, bf16 and fp8 families).
include_guard(GLOBAL)
# Ninja rewrites the shader DEPFILEs relative to the build directory.
cmake_policy(SET CMP0116 NEW)

include(ExternalProject)

set(RNWHISPER_VULKAN_SOURCE_DIR "${RNWHISPER_WHISPER_CPP_DIR}/ggml/src/ggml-vulkan")

# Only the shaders whisper's models need: f32 activations, f16 weights and
# caches, q5_0 weights. Ops on other types and flash attention run on the CPU
# backend (see "Allow building ggml-vulkan with a reduced shader set").
set(RNWHISPER_VULKAN_SHADER_TYPES "f32,f16,q5_0")

# The NDK's Vulkan headers predate what ggml-vulkan uses and ship no vulkan.hpp.
# vendor/khronos holds the headers ggml-vulkan includes, from Vulkan-Headers and
# SPIRV-Headers vulkan-sdk-1.4.357.0, so the build needs no network access.
set(RNWHISPER_KHRONOS_DIR "${RNWHISPER_ROOT_DIR}/vendor/khronos")

find_program(RNWHISPER_GLSLC glslc
    HINTS "${ANDROID_NDK}/shader-tools/${ANDROID_HOST_TAG}"
    NO_DEFAULT_PATH
    NO_CMAKE_FIND_ROOT_PATH)
if (NOT RNWHISPER_GLSLC)
    message(FATAL_ERROR "rnwhisper: no glslc in ${ANDROID_NDK}/shader-tools/${ANDROID_HOST_TAG}")
endif ()
message(STATUS "rnwhisper: compiling Vulkan shaders with ${RNWHISPER_GLSLC}")
# gcc first, like upstream: the NDK's clang is on the search path and cannot
# build against the host's libstdc++.
find_program(RNWHISPER_HOST_C_COMPILER NAMES gcc clang NO_CMAKE_FIND_ROOT_PATH REQUIRED)
find_program(RNWHISPER_HOST_CXX_COMPILER NAMES g++ clang++ NO_CMAKE_FIND_ROOT_PATH REQUIRED)
# The NDK's libvulkan.so stub for the minimum API level exports Vulkan 1.0
# only; ggml-vulkan calls 1.1 entry points directly. Link the Android 10 (API
# 29) stub: on older devices this variant fails to load and whisper.rn loads
# the CPU variant instead.
find_library(RNWHISPER_VULKAN_MIN_API_LIB vulkan REQUIRED)
get_filename_component(RNWHISPER_VULKAN_LIB_ROOT "${RNWHISPER_VULKAN_MIN_API_LIB}" DIRECTORY)
get_filename_component(RNWHISPER_VULKAN_LIB_ROOT "${RNWHISPER_VULKAN_LIB_ROOT}" DIRECTORY)
set(RNWHISPER_VULKAN_LIB "${RNWHISPER_VULKAN_LIB_ROOT}/29/libvulkan.so")
if (NOT EXISTS "${RNWHISPER_VULKAN_LIB}")
    message(FATAL_ERROR "rnwhisper: no API 29 libvulkan.so stub at ${RNWHISPER_VULKAN_LIB}")
endif ()

# ggml's optional shader families (cooperative matrices, integer dot products,
# bf16, fp8) stay disabled: the Mali GPUs this variant targets have none of
# them, and each multiplies the shader count.

function(rnwhisper_add_vulkan_backend target)
    # The shader generator is a host tool; the NDK toolchain must not reach it.
    set(gen_prefix "${CMAKE_CURRENT_BINARY_DIR}/vulkan-shaders-gen")
    ExternalProject_Add(${target}-vulkan-shaders-gen
        SOURCE_DIR ${RNWHISPER_VULKAN_SOURCE_DIR}/vulkan-shaders
        PREFIX ${gen_prefix}
        CMAKE_ARGS -DCMAKE_C_COMPILER=${RNWHISPER_HOST_C_COMPILER}
                   -DCMAKE_CXX_COMPILER=${RNWHISPER_HOST_CXX_COMPILER}
                   -DCMAKE_BUILD_TYPE=Release
                   -DCMAKE_INSTALL_PREFIX=${gen_prefix}
                   -DCMAKE_INSTALL_BINDIR=.
        BUILD_ALWAYS TRUE
        INSTALL_COMMAND ${CMAKE_COMMAND} -E env --unset=DESTDIR
                        ${CMAKE_COMMAND} --install . --config Release
    )

    set(gen_cmd "${gen_prefix}/vulkan-shaders-gen")
    set(input_dir "${RNWHISPER_VULKAN_SOURCE_DIR}/vulkan-shaders")
    set(output_dir "${CMAKE_CURRENT_BINARY_DIR}/vulkan-shaders.spv")
    set(header "${CMAKE_CURRENT_BINARY_DIR}/ggml-vulkan-shaders.hpp")
    file(GLOB gen_sources "${input_dir}/*.cpp" "${input_dir}/*.h")
    file(GLOB shader_files "${input_dir}/*.comp")

    add_custom_command(
        OUTPUT ${header}
        COMMAND ${gen_cmd} --output-dir ${output_dir} --target-hpp ${header}
        DEPENDS ${gen_sources} ${target}-vulkan-shaders-gen
        COMMENT "Generate vulkan shaders header"
    )
    set(generated ${header})
    foreach (shader IN LISTS shader_files)
        get_filename_component(name ${shader} NAME)
        set(shader_cpp "${CMAKE_CURRENT_BINARY_DIR}/${name}.cpp")
        add_custom_command(
            OUTPUT ${shader_cpp}
            DEPFILE ${shader_cpp}.d
            COMMAND ${gen_cmd}
                --glslc ${RNWHISPER_GLSLC}
                --source ${shader}
                --output-dir ${output_dir}
                --target-hpp ${header}
                --target-cpp ${shader_cpp}
                --types ${RNWHISPER_VULKAN_SHADER_TYPES}
                --no-flash-attn
            DEPENDS ${shader} ${gen_sources} ${target}-vulkan-shaders-gen
            COMMENT "Generate vulkan shaders for ${name}"
        )
        list(APPEND generated ${shader_cpp})
    endforeach ()

    target_sources(${target} PRIVATE
        ${RNWHISPER_VULKAN_SOURCE_DIR}/ggml-vulkan.cpp
        ${generated}
    )
    target_include_directories(${target} BEFORE PRIVATE
        ${RNWHISPER_KHRONOS_DIR}/Vulkan-Headers/include
        ${RNWHISPER_KHRONOS_DIR}/SPIRV-Headers/include
        ${CMAKE_CURRENT_BINARY_DIR}
    )
    # GGML_BACKEND_* export the backend API (the JNI wrapper calls
    # ggml_backend_vk_set_pipeline_cache_path); the core is built with hidden
    # visibility otherwise.
    target_compile_definitions(${target} PRIVATE
        GGML_USE_VULKAN
        GGML_BACKEND_SHARED GGML_BACKEND_BUILD
        GGML_VK_SHADER_TYPES="${RNWHISPER_VULKAN_SHADER_TYPES}"
        GGML_VK_NO_FLASH_ATTN
    )
    target_link_libraries(${target} PRIVATE ${RNWHISPER_VULKAN_LIB})
endfunction()
