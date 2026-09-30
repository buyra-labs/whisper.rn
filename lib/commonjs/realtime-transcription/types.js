"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VAD_PRESETS = void 0;
// === Audio Stream Interfaces ===

// === Enhanced VAD Options ===

// Pre-defined VAD configurations for different use cases
/**
 * VAD Presets Overview:
 *
 *                            VAD Presets
 *                         /      |      \
 *                Conservative  Default  Sensitive
 *                /        |        |        \
 *        conservative  very-conservative  sensitive  very-sensitive
 *        (0.7 thresh)   (0.8 thresh)    (0.3 thresh) (0.2 thresh)
 *        500ms min      750ms min       100ms min    100ms min
 *        Clear speech   Very clear      Quiet env    Catches whispers
 *
 *                         Specialized Presets
 *                      /        |        \
 *                continuous   meeting    noisy
 *                (60s max)    (45s max)  (0.75 thresh)
 *                Lectures     Multi-spk   Strict for noise
 *
 * Key Parameters:
 * - threshold: 0.0-1.0 (lower = more sensitive)
 * - minSpeechDurationMs: Min duration to consider speech
 * - minSilenceDurationMs: Min silence before ending speech
 * - maxSpeechDurationS: Max continuous speech duration
 * - speechPadMs: Padding around detected speech
 * - samplesOverlap: Analysis window overlap (0.0-1.0)
 */
const VAD_PRESETS = {
  // Default - balanced performance
  default: {
    threshold: 0.5,
    minSpeechDurationMs: 250,
    minSilenceDurationMs: 100,
    maxSpeechDurationS: 30,
    speechPadMs: 30,
    samplesOverlap: 0.1
  },
  // Sensitive - good for quiet environments
  sensitive: {
    threshold: 0.3,
    minSpeechDurationMs: 100,
    minSilenceDurationMs: 50,
    maxSpeechDurationS: 15,
    speechPadMs: 50,
    samplesOverlap: 0.2
  },
  // Very sensitive - catches even quiet speech
  'very-sensitive': {
    threshold: 0.2,
    minSpeechDurationMs: 100,
    minSilenceDurationMs: 50,
    maxSpeechDurationS: 15,
    speechPadMs: 100,
    samplesOverlap: 0.3
  },
  // Conservative - avoids false positives
  conservative: {
    threshold: 0.7,
    minSpeechDurationMs: 500,
    minSilenceDurationMs: 200,
    maxSpeechDurationS: 25,
    speechPadMs: 20,
    samplesOverlap: 0.05
  },
  // Very conservative - only clear speech
  'very-conservative': {
    threshold: 0.8,
    minSpeechDurationMs: 750,
    minSilenceDurationMs: 300,
    maxSpeechDurationS: 20,
    speechPadMs: 10,
    samplesOverlap: 0.05
  },
  // Continuous speech - for presentations/lectures
  continuous: {
    threshold: 0.4,
    minSpeechDurationMs: 200,
    minSilenceDurationMs: 300,
    maxSpeechDurationS: 60,
    // Longer segments
    speechPadMs: 50,
    samplesOverlap: 0.15
  },
  // Meeting mode - handles multiple speakers
  meeting: {
    threshold: 0.45,
    minSpeechDurationMs: 300,
    minSilenceDurationMs: 150,
    maxSpeechDurationS: 45,
    speechPadMs: 75,
    samplesOverlap: 0.2
  },
  // Noisy environment - more strict thresholds
  noisy: {
    threshold: 0.75,
    minSpeechDurationMs: 400,
    minSilenceDurationMs: 100,
    maxSpeechDurationS: 25,
    speechPadMs: 40,
    samplesOverlap: 0.1
  }
};
exports.VAD_PRESETS = VAD_PRESETS;
//# sourceMappingURL=types.js.map