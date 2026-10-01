# Model quantizer

whisper.cpp's `quantize` example at the vendored commit, with IQ4_NL added
(upstream lists only the q/k quantizations): `common-ggml.cpp` maps
`iq4_nl` to `GGML_FTYPE_MOSTLY_IQ4_NL` and quantizes `GGML_TYPE_IQ4_NL`
tensors with `ggml_quantize_chunk`, which needs no importance matrix.

```sh
cmake -S tools/quantize -B tools/quantize/build -DCMAKE_BUILD_TYPE=Release
cmake --build tools/quantize/build
tools/quantize/build/whisper-quantize ggml-model.bin kb-whisper-small-iq4_nl.bin iq4_nl
```

Buyra's Android model is KB-Whisper small (`KBLab/kb-whisper-small`,
`ggml-model.bin`, f16) quantized this way: 145 MB, which the Mali Vulkan
path and ggml-hexagon both run.
