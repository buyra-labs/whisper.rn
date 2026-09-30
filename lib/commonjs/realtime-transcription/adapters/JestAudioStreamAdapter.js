"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JestAudioStreamAdapter = void 0;
class JestAudioStreamAdapter {
  config = null;
  isInitialized = false;
  recording = false;
  chunksSent = 0;
  startTime = 0;
  constructor() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    this.options = {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      simulateLatency: 0,
      simulateErrors: false,
      chunkSize: 3200,
      // 100ms at 16kHz, 16-bit, mono
      chunkInterval: 100,
      // 100ms
      maxChunks: -1,
      // unlimited
      generateSilence: true,
      ...options
    };
  }
  async initialize(config) {
    if (this.isInitialized) {
      await this.release();
    }
    if (this.options.simulateLatency > 0) {
      await JestAudioStreamAdapter.delay(this.options.simulateLatency);
    }
    if (this.options.simulateErrors && !this.options.simulateStartErrorOnly) {
      throw new Error('Simulated initialization error');
    }
    this.config = config;
    this.isInitialized = true;
  }
  async start() {
    var _this$statusCallback;
    if (!this.isInitialized) {
      throw new Error('AudioStream not initialized');
    }
    if (this.recording) {
      return;
    }
    if (this.options.simulateLatency > 0) {
      await JestAudioStreamAdapter.delay(this.options.simulateLatency);
    }
    if (this.options.simulateErrors) {
      throw new Error('Simulated start error');
    }
    this.recording = true;
    this.chunksSent = 0;
    this.startTime = Date.now();
    (_this$statusCallback = this.statusCallback) === null || _this$statusCallback === void 0 ? void 0 : _this$statusCallback.call(this, true);
    this.startStreaming();
  }
  async stop() {
    var _this$statusCallback2;
    if (!this.recording) {
      return;
    }
    if (this.options.simulateLatency > 0) {
      await JestAudioStreamAdapter.delay(this.options.simulateLatency);
    }
    this.recording = false;
    (_this$statusCallback2 = this.statusCallback) === null || _this$statusCallback2 === void 0 ? void 0 : _this$statusCallback2.call(this, false);
    if (this.streamInterval) {
      clearTimeout(this.streamInterval);
      this.streamInterval = undefined;
    }
  }
  isRecording() {
    return this.recording;
  }
  onData(callback) {
    this.dataCallback = callback;
  }
  onError(callback) {
    this.errorCallback = callback;
  }
  onStatusChange(callback) {
    this.statusCallback = callback;
  }
  async release() {
    if (this.recording) {
      await this.stop();
    }
    this.isInitialized = false;
    this.config = null;
    this.dataCallback = undefined;
    this.errorCallback = undefined;
    this.statusCallback = undefined;
    this.chunksSent = 0;
  }

  // Test helper methods
  simulateError(error) {
    var _this$errorCallback;
    (_this$errorCallback = this.errorCallback) === null || _this$errorCallback === void 0 ? void 0 : _this$errorCallback.call(this, error);
  }
  simulateDataChunk(data) {
    if (!this.dataCallback || !this.config) {
      return;
    }
    const streamData = {
      data,
      sampleRate: this.config.sampleRate || this.options.sampleRate,
      channels: this.config.channels || this.options.channels,
      timestamp: Date.now()
    };
    this.dataCallback(streamData);
  }
  getChunksSent() {
    return this.chunksSent;
  }
  getTotalBytesStreamed() {
    return this.chunksSent * this.options.chunkSize;
  }
  getStreamDuration() {
    return this.recording ? Date.now() - this.startTime : 0;
  }
  startStreaming() {
    if (!this.dataCallback || !this.config) {
      return;
    }
    const streamChunk = () => {
      if (!this.recording) {
        return;
      }

      // Check if we've reached the maximum chunks
      if (this.options.maxChunks > 0 && this.chunksSent >= this.options.maxChunks) {
        this.stop();
        return;
      }

      // Generate or use provided audio data
      const audioData = this.generateAudioChunk();
      if (audioData) {
        this.simulateDataChunk(audioData);
        this.chunksSent += 1;
      }

      // Schedule next chunk if still recording
      if (this.recording) {
        this.streamInterval = setTimeout(streamChunk, this.options.chunkInterval);
      }
    };

    // Start streaming after a short delay
    this.streamInterval = setTimeout(streamChunk, this.options.chunkInterval);
  }
  generateAudioChunk() {
    // If we have pre-defined audio data, use it
    if (this.options.audioData) {
      const startByte = this.chunksSent * this.options.chunkSize;
      const endByte = Math.min(startByte + this.options.chunkSize, this.options.audioData.length);
      if (startByte >= this.options.audioData.length) {
        return null; // No more data
      }

      return this.options.audioData.subarray(startByte, endByte);
    }

    // Generate silence or simple tone
    const chunkSize = this.options.chunkSize;
    const audioData = new Uint8Array(chunkSize);
    if (this.options.generateSilence) {
      // Generate silence (all zeros)
      audioData.fill(0);
    } else {
      // Generate a simple sine wave tone for testing
      const sampleRate = this.options.sampleRate;
      const frequency = 440; // A4 note
      const samplesPerChunk = chunkSize / 2; // 16-bit samples
      const timeOffset = this.chunksSent * samplesPerChunk / sampleRate;
      for (let i = 0; i < samplesPerChunk; i += 1) {
        const time = timeOffset + i / sampleRate;
        const amplitude = Math.sin(2 * Math.PI * frequency * time) * 0.5;
        const sample = Math.round(amplitude * 32767); // 16-bit signed sample

        // Convert to little-endian bytes
        audioData[i * 2] = sample % 256;
        audioData[i * 2 + 1] = Math.floor(sample / 256) % 256;
      }
    }
    return audioData;
  }
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
exports.JestAudioStreamAdapter = JestAudioStreamAdapter;
//# sourceMappingURL=JestAudioStreamAdapter.js.map