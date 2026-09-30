import { RingBuffer } from './RingBuffer';
import { VAD_PRESETS } from './types';
export class RingBufferVad {
  isSpeechActive = false;
  silenceStartTime = 0;
  currentSpeechStartTime = 0;
  activeVadPromises = new Set();
  vadInferenceQueue = [];
  isProcessingVad = false;
  speechDetectedCallback = null;
  speechContinueCallback = null;
  speechEndedCallback = null;
  errorCallback = null;
  chunkAccumulated = 0;
  accumulatedChunks = [];
  constructor(vadContext) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    this.vadContext = vadContext;
    this.options = {
      vadOptions: options.vadOptions || VAD_PRESETS.default,
      vadPreset: options.vadPreset,
      preRecordingBufferMs: options.preRecordingBufferMs ?? 1000,
      sampleRate: options.sampleRate || 16000,
      inferenceIntervalMs: options.inferenceIntervalMs || 500,
      speechRateThreshold: options.speechRateThreshold || 0.3,
      logger: options.logger || (() => {})
    };

    // Apply preset
    if (this.options.vadPreset && VAD_PRESETS[this.options.vadPreset]) {
      this.options.vadOptions = {
        ...VAD_PRESETS[this.options.vadPreset],
        ...this.options.vadOptions
      };
    }

    // Check preRecordingBufferSec should > inferenceIntervalMs
    if (this.options.preRecordingBufferMs < this.options.inferenceIntervalMs) {
      throw new Error('preRecordingBufferMs must be greater than inferenceIntervalMs');
    }

    // Initialize RingBuffer
    const bufferSize = Math.floor(this.options.preRecordingBufferMs * this.options.sampleRate * 2); // 16-bit samples
    this.ringBuffer = new RingBuffer(bufferSize);
    this.targetChunkSize = Math.floor(this.options.inferenceIntervalMs / 1000 * this.options.sampleRate * 2);
  }
  onSpeechStart(callback) {
    this.speechDetectedCallback = callback;
  }
  onSpeechContinue(callback) {
    this.speechContinueCallback = callback;
  }
  onSpeechEnd(callback) {
    this.speechEndedCallback = callback;
  }
  onError(callback) {
    this.errorCallback = callback;
  }
  processAudio(data) {
    const u8Data = data;

    // 1. Push to Ring Buffer
    this.ringBuffer.write(u8Data);
    this.accumulatedChunks.push(u8Data);
    this.chunkAccumulated += u8Data.byteLength;

    // 2. Run VAD
    if (this.chunkAccumulated >= this.targetChunkSize) {
      // Merge accumulated chunks for this VAD interval
      const newData = new Uint8Array(this.chunkAccumulated);
      let offset = 0;
      this.accumulatedChunks.forEach(chunk => {
        newData.set(chunk, offset);
        offset += chunk.length;
      });
      this.accumulatedChunks = [];
      this.chunkAccumulated = 0;
      const vadPromise = this.processVad(newData);
      this.activeVadPromises.add(vadPromise);
      vadPromise.finally(() => {
        this.activeVadPromises.delete(vadPromise);
      });
    }
  }
  async flush() {
    // Force process last chunk if any
    if (this.chunkAccumulated > 0) {
      // Merge accumulated chunks for this last VAD interval
      const newData = new Uint8Array(this.chunkAccumulated);
      let offset = 0;
      this.accumulatedChunks.forEach(chunk => {
        newData.set(chunk, offset);
        offset += chunk.length;
      });
      this.accumulatedChunks = [];
      const vadPromise = this.processVad(newData);
      this.activeVadPromises.add(vadPromise);
      vadPromise.finally(() => {
        this.activeVadPromises.delete(vadPromise);
      });
    }
    // Wait for any active VAD processing to finish
    await Promise.allSettled([...this.activeVadPromises]);
  }
  async reset() {
    await this.flush();
    this.activeVadPromises.clear();
    this.vadInferenceQueue.length = 0;
    this.isProcessingVad = false;
    this.ringBuffer.clear();
    this.accumulatedChunks = [];
    this.chunkAccumulated = 0;
    this.isSpeechActive = false;
    this.silenceStartTime = 0;
    this.currentSpeechStartTime = 0;
  }
  async processVad(newData) {
    return new Promise(resolve => {
      // Enqueue the VAD task
      this.vadInferenceQueue.push(async () => {
        let lastSpeechOffset = -1;
        let speechRate = 0;
        let vadInput;
        try {
          vadInput = this.ringBuffer.read();
          if (vadInput.byteLength > 0) {
            const vadInputBuffer = vadInput.buffer;

            // This is now guaranteed to run sequentially
            const segments = await this.vadContext.detectSpeechData(vadInputBuffer, this.options.vadOptions);
            const audioLength = vadInput.byteLength / 2 / (this.options.sampleRate || 16000);
            // t0/t1 is 10ms unit
            speechRate = segments.reduce((acc, _ref) => {
              let {
                t0,
                t1
              } = _ref;
              return acc + (t1 - t0) / 100;
            }, 0) / audioLength;
            lastSpeechOffset = segments.length > 0 ? segments[segments.length - 1].t1 * 10 : -1;
          }
        } catch (error) {
          var _this$errorCallback;
          this.log(`VAD error: ${error}`);
          (_this$errorCallback = this.errorCallback) === null || _this$errorCallback === void 0 ? void 0 : _this$errorCallback.call(this, `VAD processing error: ${error.message || error}`);
          resolve();
          return;
        }
        await this.handleVadStateChange(lastSpeechOffset, speechRate, vadInput, newData);
        resolve();
      });

      // Start processing the queue
      this.processVadQueue();
    });
  }
  async processVadQueue() {
    // If already processing, return (the current processor will handle the queue)
    if (this.isProcessingVad) {
      return;
    }
    this.isProcessingVad = true;
    while (this.vadInferenceQueue.length > 0) {
      const task = this.vadInferenceQueue.shift();
      if (task) {
        await task(); // eslint-disable-line no-await-in-loop
      }
    }

    this.isProcessingVad = false;
  }
  async handleVadStateChange(lastSpeechOffset, speechRate, vadContextData, newChunkData) {
    var _this$options$vadOpti;
    const timeOffset = this.options.preRecordingBufferMs - lastSpeechOffset;
    const minSpeechDurationMs = ((_this$options$vadOpti = this.options.vadOptions) === null || _this$options$vadOpti === void 0 ? void 0 : _this$options$vadOpti.minSpeechDurationMs) || 100;

    // Logic ported from RealtimeTranscriber.ts
    if (speechRate > this.options.speechRateThreshold) {
      this.silenceStartTime = 0;
      if (!this.isSpeechActive) {
        var _this$speechDetectedC;
        // Speech Start
        this.isSpeechActive = true;
        this.currentSpeechStartTime = Date.now() - timeOffset;
        (_this$speechDetectedC = this.speechDetectedCallback) === null || _this$speechDetectedC === void 0 ? void 0 : _this$speechDetectedC.call(this, speechRate, vadContextData);
      } else {
        var _this$options$vadOpti2;
        // Check max duration
        const maxDurationS = ((_this$options$vadOpti2 = this.options.vadOptions) === null || _this$options$vadOpti2 === void 0 ? void 0 : _this$options$vadOpti2.maxSpeechDurationS) || 30;
        const currentDurationMs = Date.now() - this.currentSpeechStartTime;
        if (currentDurationMs > maxDurationS * 1000) {
          var _this$speechEndedCall, _this$speechDetectedC2;
          this.isSpeechActive = false;
          (_this$speechEndedCall = this.speechEndedCallback) === null || _this$speechEndedCall === void 0 ? void 0 : _this$speechEndedCall.call(this, 1.0);

          // Immediately restart
          this.isSpeechActive = true;
          this.currentSpeechStartTime = Date.now();
          (_this$speechDetectedC2 = this.speechDetectedCallback) === null || _this$speechDetectedC2 === void 0 ? void 0 : _this$speechDetectedC2.call(this, speechRate, vadContextData);
        } else {
          var _this$speechContinueC;
          // Speech Continue
          (_this$speechContinueC = this.speechContinueCallback) === null || _this$speechContinueC === void 0 ? void 0 : _this$speechContinueC.call(this, speechRate, newChunkData);
        }
      }
    } else if (this.isSpeechActive && Date.now() - this.currentSpeechStartTime > minSpeechDurationMs) {
      var _this$options$vadOpti3;
      // Silence
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = Date.now() + timeOffset;
      }
      const silenceDuration = (Date.now() - this.silenceStartTime) / 1000;
      const minSilenceDurationMs = ((_this$options$vadOpti3 = this.options.vadOptions) === null || _this$options$vadOpti3 === void 0 ? void 0 : _this$options$vadOpti3.minSilenceDurationMs) || 100;
      if (silenceDuration > minSilenceDurationMs / 1000) {
        var _this$speechEndedCall2;
        this.isSpeechActive = false;
        this.silenceStartTime = 0;
        (_this$speechEndedCall2 = this.speechEndedCallback) === null || _this$speechEndedCall2 === void 0 ? void 0 : _this$speechEndedCall2.call(this, 1 - speechRate);
      }
    } else if (this.isSpeechActive) {
      var _this$speechContinueC2;
      // Emit continue to keep recording during silence/gaps
      (_this$speechContinueC2 = this.speechContinueCallback) === null || _this$speechContinueC2 === void 0 ? void 0 : _this$speechContinueC2.call(this, speechRate, newChunkData);
    }
  }
  log(message) {
    var _this$options$logger, _this$options;
    (_this$options$logger = (_this$options = this.options).logger) === null || _this$options$logger === void 0 ? void 0 : _this$options$logger.call(_this$options, `[RingBufferVad] ${message}`);
  }

  // Helper to update options
  updateOptions(options) {
    this.options.vadOptions = {
      ...this.options.vadOptions,
      ...options
    };
  }
}
//# sourceMappingURL=RingBufferVad.js.map