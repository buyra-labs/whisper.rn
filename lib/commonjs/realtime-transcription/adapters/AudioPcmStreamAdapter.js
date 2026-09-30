"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AudioPcmStreamAdapter = void 0;
var _reactNativeAudioPcmStream = _interopRequireDefault(require("@fugood/react-native-audio-pcm-stream"));
var _common = require("../../utils/common");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/* eslint-disable import/no-extraneous-dependencies */
// @ts-ignore

class AudioPcmStreamAdapter {
  isInitialized = false;
  recording = false;
  config = null;
  async initialize(config) {
    if (this.isInitialized) {
      await this.release();
    }
    try {
      this.config = config || null;

      // Initialize LiveAudioStream
      _reactNativeAudioPcmStream.default.init({
        sampleRate: config.sampleRate || 16000,
        channels: config.channels || 1,
        bitsPerSample: config.bitsPerSample || 16,
        audioSource: config.audioSource || 6,
        bufferSize: config.bufferSize || 16 * 1024,
        wavFile: '' // We handle file writing separately
      });

      // Set up data listener
      _reactNativeAudioPcmStream.default.on('data', this.handleAudioData.bind(this));
      this.isInitialized = true;
    } catch (error) {
      var _this$errorCallback;
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      (_this$errorCallback = this.errorCallback) === null || _this$errorCallback === void 0 ? void 0 : _this$errorCallback.call(this, errorMessage);
      throw new Error(`Failed to initialize LiveAudioStream: ${errorMessage}`);
    }
  }
  async start() {
    if (!this.isInitialized) {
      throw new Error('AudioStream not initialized');
    }
    if (this.recording) {
      return;
    }
    try {
      var _this$statusCallback;
      _reactNativeAudioPcmStream.default.start();
      this.recording = true;
      (_this$statusCallback = this.statusCallback) === null || _this$statusCallback === void 0 ? void 0 : _this$statusCallback.call(this, true);
    } catch (error) {
      var _this$errorCallback2;
      const errorMessage = error instanceof Error ? error.message : 'Unknown start error';
      (_this$errorCallback2 = this.errorCallback) === null || _this$errorCallback2 === void 0 ? void 0 : _this$errorCallback2.call(this, errorMessage);
      throw new Error(`Failed to start recording: ${errorMessage}`);
    }
  }
  async stop() {
    if (!this.recording) {
      return;
    }
    try {
      var _this$statusCallback2;
      await _reactNativeAudioPcmStream.default.stop();
      this.recording = false;
      (_this$statusCallback2 = this.statusCallback) === null || _this$statusCallback2 === void 0 ? void 0 : _this$statusCallback2.call(this, false);
    } catch (error) {
      var _this$errorCallback3;
      const errorMessage = error instanceof Error ? error.message : 'Unknown stop error';
      (_this$errorCallback3 = this.errorCallback) === null || _this$errorCallback3 === void 0 ? void 0 : _this$errorCallback3.call(this, errorMessage);
      throw new Error(`Failed to stop recording: ${errorMessage}`);
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
    try {
      // LiveAudioStream doesn't have an explicit release method
      // But we should remove listeners and reset state
      this.isInitialized = false;
      this.config = null;
      this.dataCallback = undefined;
      this.errorCallback = undefined;
      this.statusCallback = undefined;
    } catch (error) {
      console.warn('Error during LiveAudioStream release:', error);
    }
  }

  /**
   * Handle incoming audio data from LiveAudioStream
   */
  handleAudioData(base64Data) {
    if (!this.dataCallback) {
      return;
    }
    try {
      var _this$config, _this$config2;
      const audioData = (0, _common.base64ToUint8Array)(base64Data);
      const streamData = {
        data: audioData,
        sampleRate: ((_this$config = this.config) === null || _this$config === void 0 ? void 0 : _this$config.sampleRate) || 16000,
        channels: ((_this$config2 = this.config) === null || _this$config2 === void 0 ? void 0 : _this$config2.channels) || 1,
        timestamp: Date.now()
      };
      this.dataCallback(streamData);
    } catch (error) {
      var _this$errorCallback4;
      const errorMessage = error instanceof Error ? error.message : 'Audio processing error';
      (_this$errorCallback4 = this.errorCallback) === null || _this$errorCallback4 === void 0 ? void 0 : _this$errorCallback4.call(this, errorMessage);
    }
  }
}
exports.AudioPcmStreamAdapter = AudioPcmStreamAdapter;
//# sourceMappingURL=AudioPcmStreamAdapter.js.map