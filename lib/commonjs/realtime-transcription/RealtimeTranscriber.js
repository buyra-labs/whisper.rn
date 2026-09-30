"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RealtimeTranscriber = void 0;
var _SliceManager = require("./SliceManager");
var _WavFileWriter = require("../utils/WavFileWriter");
/* eslint-disable class-methods-use-this */

const SILENCE_SEGMENT_REGEX = /\[(\s*\w+\s*)]/i;

/** Treat undefined / non-positive limits as "unbounded". */
const normalizeLimit = value => value && value > 0 ? Math.floor(value) : Infinity;

/** Drop the oldest entries (Map insertion order) until the map fits the limit. */
const trimMapToLimit = (map, limit) => {
  const keys = map.keys();
  let excess = map.size - limit;
  while (excess > 0) {
    const {
      value: oldestKey
    } = keys.next();
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
    excess -= 1;
  }
};

/**
 * RealtimeTranscriber provides real-time audio transcription with VAD support.
 *
 * Features:
 * - Automatic slice management based on duration
 * - VAD-based speech detection and auto-slicing
 * - Configurable auto-slice mechanism that triggers on speech_end/silence events
 * - Memory management for audio slices
 * - Queue-based transcription processing
 */
class RealtimeTranscriber {
  callbacks = {};
  isActive = false;
  isTranscribing = false;
  vadEnabled = false;
  isSpeechActive = false;
  transcriptionQueue = [];
  wavFileWriter = null;

  // Simplified VAD state management
  lastSpeechDetectedTime = 0;

  // Track last stats to emit only when changed
  lastStatsSnapshot = null;

  // Track last realtime transcription time for throttling
  lastRealtimeTranscriptionTime = 0;

  // Store transcription results by slice index. Bounded by maxResultsInMemory so
  // long-running sessions don't retain every slice's transcript and segments forever.
  transcriptionResults = new Map();

  // Store VAD events by slice index for inclusion in transcribe events. Normally deleted once
  // the slice's final transcription lands, but a slice that never reaches that point (filtered,
  // errored, empty) would leak its entry, so the map is also bounded by maxSlicesInMemory.
  vadEvents = new Map();

  // Track active async operations
  activeTranscriptions = new Set();
  constructor(dependencies) {
    var _this$audioStream$onE, _this$audioStream;
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    let callbacks = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    if (dependencies.parakeetContext) {
      this.transcriptionContext = {
        type: 'parakeet',
        context: dependencies.parakeetContext
      };
    } else if (dependencies.whisperContext) {
      this.transcriptionContext = {
        type: 'whisper',
        context: dependencies.whisperContext
      };
    } else {
      throw new Error('RealtimeTranscriber requires either whisperContext or parakeetContext');
    }
    this.vadContext = dependencies.vadContext;
    this.audioStream = dependencies.audioStream;
    this.fs = dependencies.fs;
    this.callbacks = callbacks;

    // Set default options with proper types
    this.options = {
      audioSliceSec: options.audioSliceSec || 30,
      audioMinSec: options.audioMinSec || 1,
      maxSlicesInMemory: options.maxSlicesInMemory || 3,
      maxResultsInMemory: normalizeLimit(options.maxResultsInMemory),
      transcribeOptions: options.transcribeOptions || {},
      initialPrompt: options.initialPrompt,
      promptPreviousSlices: options.promptPreviousSlices ?? true,
      maxPromptSlices: normalizeLimit(options.maxPromptSlices),
      audioOutputPath: options.audioOutputPath,
      realtimeProcessingPauseMs: options.realtimeProcessingPauseMs || 200,
      initRealtimeAfterMs: options.initRealtimeAfterMs || 200,
      logger: options.logger || (() => {})
    };

    // Enable VAD if context is provided
    this.vadEnabled = !!this.vadContext;
    if (this.vadContext) {
      this.vadContext.onSpeechStart(this.handleSpeechDetected.bind(this));
      this.vadContext.onSpeechContinue(this.handleSpeechContinue.bind(this));
      this.vadContext.onSpeechEnd(this.handleSpeechEnded.bind(this));
      this.vadContext.onError(this.handleError.bind(this));
    }

    // Initialize managers
    this.sliceManager = new _SliceManager.SliceManager(this.options.audioSliceSec, this.options.maxSlicesInMemory);

    // Set up audio stream callbacks
    this.audioStream.onData(this.handleAudioData.bind(this));
    this.audioStream.onError(this.handleError.bind(this));
    this.audioStream.onStatusChange(this.handleAudioStatusChange.bind(this));
    (_this$audioStream$onE = (_this$audioStream = this.audioStream).onEnd) === null || _this$audioStream$onE === void 0 ? void 0 : _this$audioStream$onE.call(_this$audioStream, this.handleAudioEnd.bind(this));
  }

  /**
   * Start realtime transcription
   */
  async start() {
    if (this.isActive) {
      throw new Error('Realtime transcription is already active');
    }
    try {
      var _this$callbacks$onSta, _this$callbacks, _this$options$audioSt4, _this$options$audioSt5, _this$options$audioSt6, _this$options$audioSt7, _this$options$audioSt8;
      this.isActive = true;
      (_this$callbacks$onSta = (_this$callbacks = this.callbacks).onStatusChange) === null || _this$callbacks$onSta === void 0 ? void 0 : _this$callbacks$onSta.call(_this$callbacks, true);

      // Reset all state to ensure clean start
      this.reset();

      // Initialize WAV file writer if output path is specified
      if (this.fs && this.options.audioOutputPath) {
        var _this$options$audioSt, _this$options$audioSt2, _this$options$audioSt3;
        this.wavFileWriter = new _WavFileWriter.WavFileWriter(this.fs, this.options.audioOutputPath, {
          sampleRate: ((_this$options$audioSt = this.options.audioStreamConfig) === null || _this$options$audioSt === void 0 ? void 0 : _this$options$audioSt.sampleRate) || 16000,
          channels: ((_this$options$audioSt2 = this.options.audioStreamConfig) === null || _this$options$audioSt2 === void 0 ? void 0 : _this$options$audioSt2.channels) || 1,
          bitsPerSample: ((_this$options$audioSt3 = this.options.audioStreamConfig) === null || _this$options$audioSt3 === void 0 ? void 0 : _this$options$audioSt3.bitsPerSample) || 16
        });
        await this.wavFileWriter.initialize();
      }

      // Start audio recording
      await this.audioStream.initialize({
        sampleRate: ((_this$options$audioSt4 = this.options.audioStreamConfig) === null || _this$options$audioSt4 === void 0 ? void 0 : _this$options$audioSt4.sampleRate) || 16000,
        channels: ((_this$options$audioSt5 = this.options.audioStreamConfig) === null || _this$options$audioSt5 === void 0 ? void 0 : _this$options$audioSt5.channels) || 1,
        bitsPerSample: ((_this$options$audioSt6 = this.options.audioStreamConfig) === null || _this$options$audioSt6 === void 0 ? void 0 : _this$options$audioSt6.bitsPerSample) || 16,
        audioSource: ((_this$options$audioSt7 = this.options.audioStreamConfig) === null || _this$options$audioSt7 === void 0 ? void 0 : _this$options$audioSt7.audioSource) || 6,
        bufferSize: ((_this$options$audioSt8 = this.options.audioStreamConfig) === null || _this$options$audioSt8 === void 0 ? void 0 : _this$options$audioSt8.bufferSize) || 16 * 1024
      });
      await this.audioStream.start();

      // Emit stats update for status change
      this.emitStatsUpdate('status_change');
      this.log('Realtime transcription started');
    } catch (error) {
      var _this$callbacks$onSta2, _this$callbacks2;
      this.isActive = false;
      (_this$callbacks$onSta2 = (_this$callbacks2 = this.callbacks).onStatusChange) === null || _this$callbacks$onSta2 === void 0 ? void 0 : _this$callbacks$onSta2.call(_this$callbacks2, false);
      throw error;
    }
  }

  /**
   * Stop realtime transcription
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    try {
      var _this$callbacks$onSta3, _this$callbacks3;
      this.isActive = false;

      // Stop audio recording first to stop new data coming in
      await this.audioStream.stop();

      // Process any remaining queued transcriptions
      await this.processTranscriptionQueue();

      // Wait for all active transcriptions to complete
      await Promise.allSettled([...this.activeTranscriptions].map(t => t.promise));
      this.activeTranscriptions.clear();

      // Reset VAD context (waits for its internal active promises)
      if (this.vadContext) {
        await this.vadContext.reset();
      }

      // Finalize WAV file
      if (this.wavFileWriter) {
        await this.wavFileWriter.finalize();
        this.wavFileWriter = null;
      }

      // Reset all state completely
      this.reset();
      (_this$callbacks$onSta3 = (_this$callbacks3 = this.callbacks).onStatusChange) === null || _this$callbacks$onSta3 === void 0 ? void 0 : _this$callbacks$onSta3.call(_this$callbacks3, false);

      // Emit stats update for status change
      this.emitStatsUpdate('status_change');
      this.log('Realtime transcription stopped');
    } catch (error) {
      this.handleError(`Stop error: ${error}`);
    }
  }

  /**
   * Handle incoming audio data
   */
  handleAudioData(streamData) {
    if (!this.isActive) return;
    this.processAudioChunk(streamData.data).catch(error => {
      this.handleError(`Audio processing error: ${error}`);
    });

    // Write to WAV file if enabled
    if (this.wavFileWriter) {
      this.wavFileWriter.appendAudioData(streamData.data).catch(error => {
        this.log(`Failed to write audio to WAV file: ${error}`);
      });
    }
  }

  /**
   * Process audio chunk through the VAD pipeline
   */
  async processAudioChunk(data) {
    // Push directly to VAD context
    if (this.vadContext) {
      // Check pre-VAD filter if exists (optional callback)
      if (this.callbacks.onBeginVad) {
        const {
          sampleRate = 16000
        } = this.options.audioStreamConfig || {};
        const duration = data.length / 2 / (sampleRate / 1000); // ms

        const shouldContinue = await this.callbacks.onBeginVad({
          audioData: data,
          sliceIndex: -1,
          // No slice index yet for raw chunks
          duration
        });
        if (!shouldContinue) {
          // User cancelled VAD for this chunk
          return;
        }
      }
      this.vadContext.processAudio(data);
    } else {
      // Fallback: If no VAD context, treat everything as speech/audio to be processed
      this.sliceManager.addAudioData(data);
      this.triggerTranscription(false);
    }
  }

  // --- VAD Handlers ---

  async handleSpeechDetected(confidence, data) {
    if (!this.isActive) return;
    if (!this.isSpeechActive) {
      // Speech Start
      this.isSpeechActive = true;
      this.log('VAD: Speech Start detected');
      this.lastSpeechDetectedTime = Date.now();
      this.emitVadEvent('speech_start', confidence);
      this.sliceManager.addAudioData(data);
      this.triggerTranscription(false);
    }
  }
  async handleSpeechContinue(confidence, data) {
    if (!this.isActive || !this.isSpeechActive) return;
    this.emitVadEvent('speech_continue', confidence);
    this.sliceManager.addAudioData(data);
    this.triggerTranscription(false);
  }
  async handleSpeechEnded(confidence) {
    if (!this.isActive) return;
    this.isSpeechActive = false;
    this.emitVadEvent('speech_end', confidence);
    await this.nextSlice();
  }

  /**
   * Trigger transcription for the current slice
   */
  triggerTranscription(isFinal) {
    const sliceInfo = this.sliceManager.getCurrentSliceInfo();
    const slice = this.sliceManager.getSliceByIndex(sliceInfo.currentSliceIndex);
    if (!slice || slice.sampleCount === 0) return;

    // Queue transcription
    const audioData = this.sliceManager.getAudioDataForTranscription(slice.index);
    if (audioData) {
      // Throttling logic for realtime (non-final) transcriptions
      if (!isFinal) {
        const {
          sampleRate = 16000
        } = this.options.audioStreamConfig || {};
        const durationMs = audioData.length / 2 / (sampleRate / 1000);
        const now = Date.now();

        // 1. Initial wait: Don't transcribe if slice is too short (unless it's final, which checks above handle)
        if (durationMs < this.options.initRealtimeAfterMs) {
          return;
        }

        // 2. Throttling: Don't transcribe if too soon after last update
        if (now - this.lastRealtimeTranscriptionTime < this.options.realtimeProcessingPauseMs) {
          return;
        }
        this.lastRealtimeTranscriptionTime = now;
      }
      this.transcriptionQueue.push({
        sliceIndex: slice.index,
        audioData,
        isFinal // Pass flag to processTranscription (need update)
      });

      this.processTranscriptionQueue().catch(e => this.handleError(e));
    }
  }
  emitVadEvent(type, confidence) {
    var _this$sliceManager$ge, _this$callbacks$onVad, _this$callbacks4;
    const sliceInfo = this.sliceManager.getCurrentSliceInfo();
    const event = {
      type,
      timestamp: Date.now(),
      sliceIndex: sliceInfo.currentSliceIndex,
      confidence,
      lastSpeechDetectedTime: this.lastSpeechDetectedTime,
      duration: (_this$sliceManager$ge = this.sliceManager.getSliceByIndex(sliceInfo.currentSliceIndex)) !== null && _this$sliceManager$ge !== void 0 && _this$sliceManager$ge.data.length ? this.sliceManager.getSliceByIndex(sliceInfo.currentSliceIndex).data.length / 32000 : 0
    };
    this.vadEvents.set(sliceInfo.currentSliceIndex, event);
    trimMapToLimit(this.vadEvents, this.options.maxSlicesInMemory);
    (_this$callbacks$onVad = (_this$callbacks4 = this.callbacks).onVad) === null || _this$callbacks$onVad === void 0 ? void 0 : _this$callbacks$onVad.call(_this$callbacks4, event);
  }
  isProcessingTranscriptionQueue = false;
  processingPromise = null;

  /**
   * Process the transcription queue
   */
  async processTranscriptionQueue() {
    if (this.isProcessingTranscriptionQueue && this.processingPromise) {
      return this.processingPromise;
    }
    this.isProcessingTranscriptionQueue = true;
    this.processingPromise = (async () => {
      while (this.transcriptionQueue.length > 0) {
        const item = this.transcriptionQueue.shift(); // shift() modifies the array
        if (item) {
          // eslint-disable-next-line no-await-in-loop
          await this.processTranscription(item).catch(error => {
            this.handleError(`Transcription error: ${error}`);
          });
        }
      }
      this.isProcessingTranscriptionQueue = false;
      this.processingPromise = null;
    })();
    return this.processingPromise;
  }

  /**
   * Build prompt from initial prompt and previous slices
   */
  buildPrompt(currentSliceIndex) {
    const promptParts = [];

    // Add initial prompt if provided
    if (this.options.initialPrompt) {
      promptParts.push(this.options.initialPrompt);
    }

    // Add previous slice results if enabled
    if (this.options.promptPreviousSlices) {
      promptParts.push(...this.getPreviousResultTexts(currentSliceIndex));
    }
    return promptParts.join(' ') || undefined;
  }

  /**
   * Texts of the most recent non-empty results before the given slice, oldest first,
   * limited to maxPromptSlices so the prompt stays bounded regardless of session length.
   */
  getPreviousResultTexts(currentSliceIndex) {
    const previous = [];
    this.transcriptionResults.forEach((result, sliceIndex) => {
      var _result$transcribeEve;
      const text = (_result$transcribeEve = result.transcribeEvent.data) === null || _result$transcribeEve === void 0 ? void 0 : _result$transcribeEve.result;
      if (sliceIndex < currentSliceIndex && text) previous.push([sliceIndex, text]);
    });
    previous.sort((_ref, _ref2) => {
      let [a] = _ref;
      let [b] = _ref2;
      return a - b;
    });
    const {
      maxPromptSlices
    } = this.options;
    if (previous.length > maxPromptSlices) {
      previous.splice(0, previous.length - maxPromptSlices);
    }
    return previous.map(_ref3 => {
      let [, text] = _ref3;
      return text;
    });
  }

  /**
   * Process a single transcription
   */
  async processTranscription(item) {
    if (!this.isActive) {
      return;
    }
    this.isTranscribing = true;

    // Emit stats update for status change
    this.emitStatsUpdate('status_change');
    const startTime = Date.now();
    try {
      var _this$transcriptionRe, _this$callbacks$onTra, _this$callbacks5, _result$result;
      const audioBuffer = item.audioData.buffer;
      let transcribeRequest;
      if (this.transcriptionContext.type === 'parakeet') {
        const {
          maxThreads
        } = this.options.transcribeOptions;
        const audioCtx = 'audioCtx' in this.options.transcribeOptions ? this.options.transcribeOptions.audioCtx : undefined;
        const parakeetOptions = {};
        if (maxThreads !== undefined) parakeetOptions.maxThreads = maxThreads;
        if (audioCtx !== undefined) parakeetOptions.audioCtx = audioCtx;
        transcribeRequest = this.transcriptionContext.context.transcribeData(audioBuffer, parakeetOptions);
      } else {
        // Prompt chaining and progress callbacks are Whisper-only features.
        const prompt = this.buildPrompt(item.sliceIndex);
        const whisperOptions = {
          ...this.options.transcribeOptions
        };
        delete whisperOptions.audioCtx;
        const options = {
          ...whisperOptions,
          prompt,
          onProgress: undefined
        };
        transcribeRequest = this.transcriptionContext.context.transcribeData(audioBuffer, options);
      }

      // Track active transcription
      this.activeTranscriptions.add(transcribeRequest);
      let result;
      try {
        result = await transcribeRequest.promise;
      } finally {
        this.activeTranscriptions.delete(transcribeRequest);
      }

      // Check if stopped during transcription
      if (!this.isActive) return;
      const endTime = Date.now();

      // Normalize result and segments, remove "[ silence ]" or "[BLANK]"
      result.result = result.result.replace(SILENCE_SEGMENT_REGEX, '').trim();
      const slice = this.sliceManager.getSliceByIndex(item.sliceIndex);
      if (!slice) {
        this.log(`Slice not found for index ${item.sliceIndex}, skipping transcription processing.`);
        return;
      }

      // Check if user wants to filter this transcription
      if (this.callbacks.onBeginTranscribe) {
        const {
          sampleRate = 16000
        } = this.options.audioStreamConfig || {};
        const duration = item.audioData.length / 2 / (sampleRate / 1000); // ms

        const shouldContinue = await this.callbacks.onBeginTranscribe({
          audioData: item.audioData,
          sliceIndex: slice.index,
          duration,
          vadEvent: this.vadEvents.get(item.sliceIndex)
        });
        if (!shouldContinue) {
          this.log(`Transcription filtered by onBeginTranscribe for slice ${slice.index}`);
          return;
        }
      }

      // Create new transcription event
      const {
        sampleRate = 16000
      } = this.options.audioStreamConfig || {};
      const transcribeEvent = {
        type: 'transcribe',
        sliceIndex: item.sliceIndex,
        data: result,
        isCapturing: this.audioStream.isRecording(),
        processTime: endTime - startTime,
        recordingTime: item.audioData.length / (sampleRate / 1000) / 2,
        // ms,
        memoryUsage: this.sliceManager.getMemoryUsage(),
        vadEvent: this.vadEvents.get(item.sliceIndex)
      };

      // if the current result is invalid, use the previous result
      const previousTranscribe = (_this$transcriptionRe = this.transcriptionResults.get(item.sliceIndex)) === null || _this$transcriptionRe === void 0 ? void 0 : _this$transcriptionRe.transcribeEvent;
      if (previousTranscribe && result.result.trim() === '.') {
        transcribeEvent.data = previousTranscribe.data;
      }

      // Save transcription results
      if (slice) {
        this.transcriptionResults.set(item.sliceIndex, {
          slice: {
            // Don't keep data in the slice
            index: slice.index,
            sampleCount: slice.sampleCount,
            startTime: slice.startTime,
            endTime: slice.endTime,
            isProcessed: slice.isProcessed,
            isReleased: slice.isReleased
          },
          transcribeEvent
        });
        trimMapToLimit(this.transcriptionResults, this.options.maxResultsInMemory);
      }

      // Emit transcribe event
      (_this$callbacks$onTra = (_this$callbacks5 = this.callbacks).onTranscribe) === null || _this$callbacks$onTra === void 0 ? void 0 : _this$callbacks$onTra.call(_this$callbacks5, transcribeEvent);

      // Feed result to stabilizer for realtime updates
      // Only stabilize final results (speech_end) to match legacy behavior
      const resultText = ((_result$result = result.result) === null || _result$result === void 0 ? void 0 : _result$result.trim()) || '';
      if (item.isFinal) {
        var _this$callbacks$onSli, _this$callbacks6;
        (_this$callbacks$onSli = (_this$callbacks6 = this.callbacks).onSliceTranscriptionStabilized) === null || _this$callbacks$onSli === void 0 ? void 0 : _this$callbacks$onSli.call(_this$callbacks6, resultText);
        this.vadEvents.delete(item.sliceIndex);
      }

      // Emit stats update for memory/slice changes
      this.emitStatsUpdate('memory_change');
      this.log(`Transcribed speech segment ${item.sliceIndex} (Final=${!!item.isFinal}): "${result.result}"`);
    } catch (error) {
      // ... error handling ...
      this.handleError(`Transcription error: ${error}`);
    } finally {
      if (this.transcriptionQueue.length === 0) {
        this.isTranscribing = false;
      }
    }
  }

  /**
   * Handle audio stream end
   */
  async handleAudioEnd() {
    this.log('Audio stream ended');
    if (this.vadContext) {
      await this.vadContext.flush();
    }

    // If speech is still active after flush, force end it
    if (this.isSpeechActive) {
      this.log('Speech still active after stream end, forcing speech end');
      await this.handleSpeechEnded(1.0);
    }

    // Ensure last slice is processed if it has data
    await this.nextSlice();
  }

  /**
   * Handle audio status changes
   */
  handleAudioStatusChange(isRecording) {
    this.log(`Audio recording: ${isRecording ? 'started' : 'stopped'}`);
  }

  /**
   * Handle errors from components
   */
  handleError(error) {
    var _this$callbacks$onErr, _this$callbacks7;
    this.log(`Error: ${error}`);
    (_this$callbacks$onErr = (_this$callbacks7 = this.callbacks).onError) === null || _this$callbacks$onErr === void 0 ? void 0 : _this$callbacks$onErr.call(_this$callbacks7, error);
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks) {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks
    };
  }

  /**
   * Update VAD options dynamically (delegates to VAD context)
   */
  updateVadOptions(options) {
    if (this.vadContext) {
      this.vadContext.updateOptions(options);
    }
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return {
      isActive: this.isActive,
      isTranscribing: this.isTranscribing,
      vadEnabled: this.vadEnabled,
      audioStats: {
        isRecording: this.audioStream.isRecording(),
        accumulatedSamples: this.sliceManager.getCurrentSliceInfo().memoryUsage.totalSamples
      },
      vadStats: this.vadEnabled ? {
        enabled: true,
        contextAvailable: !!this.vadContext,
        lastSpeechDetectedTime: this.lastSpeechDetectedTime
      } : null,
      sliceStats: this.sliceManager.getCurrentSliceInfo()
    };
  }

  /**
   * Get the retained transcription results, oldest first.
   *
   * When `maxResultsInMemory` is set this is only the most recent window; callers that need
   * every result should collect them from the `onTranscribe` callback as they arrive.
   */
  getTranscriptionResults() {
    return Array.from(this.transcriptionResults.values());
  }

  /**
   * Force move to the next slice, finalizing the current one regardless of capacity
   */
  async nextSlice() {
    var _this$callbacks$onTra2, _this$callbacks8;
    if (!this.isActive) {
      this.log('Cannot force next slice - transcriber is not active');
      return;
    }

    // Emit start event to indicate slice processing has started
    const startEvent = {
      type: 'start',
      sliceIndex: -1,
      // Use -1 to indicate forced slice
      data: undefined,
      isCapturing: this.audioStream.isRecording(),
      processTime: 0,
      recordingTime: 0,
      memoryUsage: this.sliceManager.getMemoryUsage()
    };
    (_this$callbacks$onTra2 = (_this$callbacks8 = this.callbacks).onTranscribe) === null || _this$callbacks$onTra2 === void 0 ? void 0 : _this$callbacks$onTra2.call(_this$callbacks8, startEvent);

    // Check if there are pending transcriptions or currently transcribing
    // We don't need to wait explicitly because the queue handles serialization
    if (this.isTranscribing || this.transcriptionQueue.length > 0) {
      this.log('Queuing forced slice after pending transcriptions...');
    }
    const result = this.sliceManager.forceNextSlice();
    if (result.slice) {
      this.log(`Forced slice ${result.slice.index} ready (${result.slice.data.length} bytes)`);

      // Queue for transcription (Final)
      if (result.slice.data.length > 0) {
        this.transcriptionQueue.push({
          sliceIndex: result.slice.index,
          audioData: result.slice.data,
          isFinal: true
        });
        this.processTranscriptionQueue().catch(error => {
          this.handleError(`Failed to process forced slice: ${error}`);
        });
      }
      this.emitStatsUpdate('memory_change');
    } else {
      this.log('Forced next slice but no slice data to process');
    }
  }

  /**
   * Reset all components
   */
  reset() {
    this.sliceManager.reset();
    this.transcriptionQueue = [];
    this.isTranscribing = false;

    // Reset VAD state
    this.lastSpeechDetectedTime = -1;

    // Reset stats snapshot for clean start
    this.lastStatsSnapshot = null;
    this.lastRealtimeTranscriptionTime = 0;

    // Cancel WAV file writing if in progress
    if (this.wavFileWriter) {
      this.wavFileWriter.cancel().catch(error => {
        this.log(`Failed to cancel WAV file writing: ${error}`);
      });
      this.wavFileWriter = null;
    }

    // Clear transcription results
    this.transcriptionResults.clear();

    // Clear VAD events
    this.vadEvents.clear();
    this.isSpeechActive = !this.vadContext;

    // vadContext is reset in stop(), but if we just call reset() directly:
    if (this.vadContext) {
      this.vadContext.reset().catch(e => this.log(`VAD reset error: ${e}`));
    }
  }

  /**
   * Release all resources
   */
  async release() {
    var _this$wavFileWriter;
    if (this.isActive) {
      await this.stop();
    }
    await this.audioStream.release();
    await ((_this$wavFileWriter = this.wavFileWriter) === null || _this$wavFileWriter === void 0 ? void 0 : _this$wavFileWriter.finalize());

    // reset/clear VAD context
    if (this.vadContext) {
      await this.vadContext.reset();
    }
    this.vadContext = undefined;
  }

  /**
   * Emit stats update event if stats have changed significantly
   */
  emitStatsUpdate(eventType) {
    const currentStats = this.getStatistics();

    // Check if stats have changed significantly
    if (!this.lastStatsSnapshot || RealtimeTranscriber.shouldEmitStatsUpdate(currentStats, this.lastStatsSnapshot)) {
      var _this$callbacks$onSta4, _this$callbacks9;
      const statsEvent = {
        timestamp: Date.now(),
        type: eventType,
        data: currentStats
      };
      (_this$callbacks$onSta4 = (_this$callbacks9 = this.callbacks).onStatsUpdate) === null || _this$callbacks$onSta4 === void 0 ? void 0 : _this$callbacks$onSta4.call(_this$callbacks9, statsEvent);
      this.lastStatsSnapshot = {
        ...currentStats
      };
    }
  }

  /**
   * Determine if stats update should be emitted
   */
  static shouldEmitStatsUpdate(current, previous) {
    var _current$sliceStats, _current$sliceStats$m, _previous$sliceStats, _previous$sliceStats$;
    // Always emit on status changes
    if (current.isActive !== previous.isActive || current.isTranscribing !== previous.isTranscribing) {
      return true;
    }

    // Emit on significant memory changes (>10% or >5MB)
    const currentMemory = ((_current$sliceStats = current.sliceStats) === null || _current$sliceStats === void 0 ? void 0 : (_current$sliceStats$m = _current$sliceStats.memoryUsage) === null || _current$sliceStats$m === void 0 ? void 0 : _current$sliceStats$m.estimatedMB) || 0;
    const previousMemory = ((_previous$sliceStats = previous.sliceStats) === null || _previous$sliceStats === void 0 ? void 0 : (_previous$sliceStats$ = _previous$sliceStats.memoryUsage) === null || _previous$sliceStats$ === void 0 ? void 0 : _previous$sliceStats$.estimatedMB) || 0;
    const memoryDiff = Math.abs(currentMemory - previousMemory);
    if (memoryDiff > 5 || previousMemory > 0 && memoryDiff / previousMemory > 0.1) {
      return true;
    }
    return false;
  }

  /**
   * Logger function
   */
  log(message) {
    this.options.logger(`[RealtimeTranscriber] ${message}`);
  }
}
exports.RealtimeTranscriber = RealtimeTranscriber;
//# sourceMappingURL=RealtimeTranscriber.js.map