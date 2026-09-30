"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SimulateFileAudioStreamAdapter = void 0;
var _WavFileReader = require("../../utils/WavFileReader");
class SimulateFileAudioStreamAdapter {
  config = null;
  isInitialized = false;
  recording = false;
  currentBytePosition = 0;
  startTime = 0;
  pausedTime = 0;
  hasReachedEnd = false;
  constructor(options) {
    this.options = {
      playbackSpeed: 1.0,
      chunkDurationMs: 100,
      loop: false,
      logger: () => {},
      ...options
    };
    this.fileReader = new _WavFileReader.WavFileReader(this.options.fs, this.options.filePath);
  }
  async initialize(config) {
    if (this.isInitialized) {
      await this.release();
    }
    try {
      this.config = config;

      // Initialize the WAV file reader
      await this.fileReader.initialize();

      // Validate file format matches config
      const header = this.fileReader.getHeader();
      if (!header) {
        throw new Error('Failed to read WAV file header');
      }

      // Warn about mismatched formats but allow processing
      if (header.sampleRate !== config.sampleRate) {
        this.log(`WAV file sample rate (${header.sampleRate}Hz) differs from config (${config.sampleRate}Hz)`);
      }
      if (header.channels !== config.channels) {
        this.log(`WAV file channels (${header.channels}) differs from config (${config.channels})`);
      }
      if (header.bitsPerSample !== config.bitsPerSample) {
        this.log(`WAV file bits per sample (${header.bitsPerSample}) differs from config (${config.bitsPerSample})`);
      }
      this.isInitialized = true;
      this.log(`Simulate audio stream initialized: ${header.duration.toFixed(2)}s at ${this.options.playbackSpeed}x speed`);
    } catch (error) {
      var _this$errorCallback;
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      (_this$errorCallback = this.errorCallback) === null || _this$errorCallback === void 0 ? void 0 : _this$errorCallback.call(this, errorMessage);
      throw new Error(`Failed to initialize SimulateFileAudioStreamAdapter: ${errorMessage}`);
    }
  }
  async start() {
    if (!this.isInitialized || !this.config) {
      throw new Error('Adapter not initialized');
    }
    if (this.recording) {
      return;
    }
    try {
      var _this$statusCallback;
      this.recording = true;
      this.hasReachedEnd = false;
      this.startTime = Date.now() - this.pausedTime;
      (_this$statusCallback = this.statusCallback) === null || _this$statusCallback === void 0 ? void 0 : _this$statusCallback.call(this, true);

      // Start streaming chunks
      this.startStreaming();
      this.log('File audio simulation started');
    } catch (error) {
      var _this$statusCallback2, _this$errorCallback2;
      this.recording = false;
      (_this$statusCallback2 = this.statusCallback) === null || _this$statusCallback2 === void 0 ? void 0 : _this$statusCallback2.call(this, false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown start error';
      (_this$errorCallback2 = this.errorCallback) === null || _this$errorCallback2 === void 0 ? void 0 : _this$errorCallback2.call(this, errorMessage);
      throw error;
    }
  }
  async stop() {
    if (!this.recording) {
      return;
    }
    try {
      var _this$statusCallback3;
      this.recording = false;
      this.pausedTime = Date.now() - this.startTime;

      // Stop the streaming interval
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = undefined;
      }
      (_this$statusCallback3 = this.statusCallback) === null || _this$statusCallback3 === void 0 ? void 0 : _this$statusCallback3.call(this, false);
      this.log('File audio simulation stopped');
    } catch (error) {
      var _this$errorCallback3;
      const errorMessage = error instanceof Error ? error.message : 'Unknown stop error';
      (_this$errorCallback3 = this.errorCallback) === null || _this$errorCallback3 === void 0 ? void 0 : _this$errorCallback3.call(this, errorMessage);
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
  onEnd(callback) {
    this.options.onEndOfFile = callback;
  }
  async release() {
    await this.stop();
    this.isInitialized = false;
    this.currentBytePosition = 0;
    this.pausedTime = 0;
    this.log('SimulateFileAudioStreamAdapter released');
  }

  /**
   * Start the streaming process
   */
  startStreaming() {
    if (!this.config || !this.isInitialized) {
      return;
    }
    const header = this.fileReader.getHeader();
    if (!header) {
      var _this$errorCallback4;
      (_this$errorCallback4 = this.errorCallback) === null || _this$errorCallback4 === void 0 ? void 0 : _this$errorCallback4.call(this, 'WAV file header not available');
      return;
    }

    // Calculate chunk size based on desired duration
    const chunkDurationSec = (this.options.chunkDurationMs || 100) / 1000;
    const bytesPerSecond = header.sampleRate * header.channels * (header.bitsPerSample / 8);
    const chunkSizeBytes = Math.floor(chunkDurationSec * bytesPerSecond);

    // Adjust interval timing based on playback speed
    const intervalMs = (this.options.chunkDurationMs || 100) / (this.options.playbackSpeed || 1.0);
    this.streamInterval = setInterval(() => {
      if (!this.recording) {
        return;
      }
      try {
        this.streamNextChunk(chunkSizeBytes);
      } catch (error) {
        var _this$errorCallback5;
        const errorMessage = error instanceof Error ? error.message : 'Streaming error';
        (_this$errorCallback5 = this.errorCallback) === null || _this$errorCallback5 === void 0 ? void 0 : _this$errorCallback5.call(this, errorMessage);
        this.stop();
      }
    }, intervalMs);
  }

  /**
   * Stream the next audio chunk
   */
  streamNextChunk(chunkSizeBytes) {
    if (!this.dataCallback || !this.config) {
      return;
    }
    const header = this.fileReader.getHeader();
    if (!header) {
      return;
    }

    // Get the next chunk of audio data
    const audioChunk = this.fileReader.getAudioSlice(this.currentBytePosition, chunkSizeBytes);
    if (!audioChunk || audioChunk.length === 0) {
      // End of file reached
      if (this.options.loop) {
        // Reset to beginning for looping
        this.currentBytePosition = 0;
        this.startTime = Date.now();
        this.pausedTime = 0;
        this.hasReachedEnd = false;
        this.log('Looping audio file simulation');
        return;
      }

      // Stop streaming due to no new buffer
      this.log('Audio file simulation completed - no new buffer available');
      this.hasReachedEnd = true;

      // Call the end-of-file callback if provided
      if (this.options.onEndOfFile) {
        this.log('Calling onEndOfFile callback');
        this.options.onEndOfFile();
      }

      // Stop the stream
      this.stop();
      return;
    }

    // Update position
    this.currentBytePosition += audioChunk.length;

    // Create stream data using the original file's format
    const streamData = {
      data: audioChunk,
      sampleRate: header.sampleRate,
      channels: header.channels,
      timestamp: Date.now()
    };

    // Send the chunk
    this.dataCallback(streamData);
  }

  /**
   * Get current playback statistics
   */
  getStatistics() {
    const header = this.fileReader.getHeader();
    const currentTime = this.fileReader.byteToTime(this.currentBytePosition);
    return {
      filePath: this.options.filePath,
      isRecording: this.recording,
      currentTime,
      totalDuration: (header === null || header === void 0 ? void 0 : header.duration) || 0,
      progress: header ? currentTime / header.duration : 0,
      playbackSpeed: this.options.playbackSpeed,
      currentBytePosition: this.currentBytePosition,
      totalBytes: this.fileReader.getTotalDataSize(),
      hasReachedEnd: this.hasReachedEnd,
      header
    };
  }

  /**
   * Seek to a specific time position
   */
  seekToTime(timeSeconds) {
    const header = this.fileReader.getHeader();
    if (!header) {
      return;
    }
    const clampedTime = Math.max(0, Math.min(timeSeconds, header.duration));
    this.currentBytePosition = this.fileReader.timeToByte(clampedTime);

    // Reset timing if we're currently playing
    if (this.recording) {
      this.startTime = Date.now() - clampedTime * 1000 / (this.options.playbackSpeed || 1.0);
      this.pausedTime = 0;
    }
    this.log(`Seeked to ${clampedTime.toFixed(2)}s`);
  }

  /**
   * Set playback speed
   */
  setPlaybackSpeed(speed) {
    if (speed <= 0) {
      throw new Error('Playback speed must be greater than 0');
    }
    this.options.playbackSpeed = speed;

    // If currently playing, restart streaming with new speed
    if (this.recording) {
      this.stop().then(() => {
        this.start();
      });
    }
    this.log(`Playback speed set to ${speed}x`);
  }

  /**
   * Reset file buffer to beginning
   */
  resetBuffer() {
    this.log('Resetting file buffer to beginning');

    // Reset position and timing
    this.currentBytePosition = 0;
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.hasReachedEnd = false;

    // If currently playing, restart streaming from beginning
    if (this.recording) {
      this.log('Restarting streaming from beginning');
      // Stop and restart to apply the reset
      this.stop().then(() => {
        this.start();
      });
    }
  }

  /**
   * Logger function
   */
  log(message) {
    var _this$options$logger, _this$options;
    (_this$options$logger = (_this$options = this.options).logger) === null || _this$options$logger === void 0 ? void 0 : _this$options$logger.call(_this$options, `[SimulateFileAudioStreamAdapter] ${message}`);
  }
}
exports.SimulateFileAudioStreamAdapter = SimulateFileAudioStreamAdapter;
//# sourceMappingURL=SimulateFileAudioStreamAdapter.js.map