import type { ParakeetTranscribeOptions, TranscribeOptions, TranscribeResult, VadOptions } from '../index';
import type { WavFileWriterFs } from '../utils/WavFileWriter';
export interface AudioStreamData {
    data: Uint8Array;
    sampleRate: number;
    channels: number;
    timestamp: number;
}
export interface AudioStreamConfig {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    bufferSize?: number;
    audioSource?: number;
}
export interface AudioStreamInterface {
    initialize(config: AudioStreamConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRecording(): boolean;
    onData(callback: (data: AudioStreamData) => void): void;
    onError(callback: (error: string) => void): void;
    onStatusChange(callback: (isRecording: boolean) => void): void;
    onEnd?(callback: () => void): void;
    release(): Promise<void>;
}
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
export declare const VAD_PRESETS: {
    default: {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    sensitive: {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    'very-sensitive': {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    conservative: {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    'very-conservative': {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    continuous: {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    meeting: {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
    noisy: {
        threshold: number;
        minSpeechDurationMs: number;
        minSilenceDurationMs: number;
        maxSpeechDurationS: number;
        speechPadMs: number;
        samplesOverlap: number;
    };
};
export interface RealtimeVadEvent {
    type: 'speech_start' | 'speech_end' | 'speech_continue' | 'silence';
    timestamp: number;
    lastSpeechDetectedTime: number;
    confidence: number;
    duration: number;
    sliceIndex: number;
    analysis?: {
        averageAmplitude: number;
        peakAmplitude: number;
        spectralCentroid?: number;
        zeroCrossingRate?: number;
    };
    currentThreshold?: number;
    environmentNoise?: number;
}
export interface RealtimeTranscribeEvent {
    type: 'start' | 'transcribe' | 'end' | 'error';
    sliceIndex: number;
    data?: TranscribeResult;
    isCapturing: boolean;
    processTime: number;
    recordingTime: number;
    memoryUsage?: {
        slicesInMemory: number;
        totalSamples: number;
        estimatedMB: number;
    };
    vadEvent?: RealtimeVadEvent;
}
export interface RealtimeOptions {
    audioSliceSec?: number;
    audioMinSec?: number;
    /** Maximum number of raw audio slices kept in memory. Default: 3. */
    maxSlicesInMemory?: number;
    /**
     * Maximum number of per-slice transcription results (transcript + segments) retained for
     * `getTranscriptionResults()`. Older results are dropped oldest-first once the limit is
     * reached, which keeps long-running (24/7) sessions bounded. Default: unlimited.
     */
    maxResultsInMemory?: number;
    /** Options for the selected Whisper or Parakeet context. */
    transcribeOptions?: TranscribeOptions | ParakeetTranscribeOptions;
    /** Initial Whisper prompt. Ignored when using ParakeetContext. */
    initialPrompt?: string;
    /** Add previous Whisper results to the next prompt. Ignored for Parakeet. Defaults to true. */
    promptPreviousSlices?: boolean;
    /**
     * Maximum number of previous slice results appended to the prompt when
     * `promptPreviousSlices` is enabled (most recent slices win). Whisper only uses the last
     * ~224 prompt tokens anyway, so a small value avoids re-tokenizing an ever-growing prompt.
     * Default: unlimited (bounded only by `maxResultsInMemory`).
     */
    maxPromptSlices?: number;
    audioOutputPath?: string;
    audioStreamConfig?: AudioStreamConfig;
    logger?: (message: string) => void;
    realtimeProcessingPauseMs?: number;
    initRealtimeAfterMs?: number;
}
export interface AudioSlice {
    index: number;
    data: Uint8Array;
    sampleCount: number;
    startTime: number;
    endTime: number;
    isProcessed: boolean;
    isReleased: boolean;
}
export interface AudioSliceNoData extends Omit<AudioSlice, 'data'> {
}
export interface MemoryUsage {
    slicesInMemory: number;
    totalSamples: number;
    estimatedMB: number;
}
export interface RealtimeStatsEvent {
    timestamp: number;
    type: 'slice_processed' | 'vad_change' | 'memory_change' | 'status_change';
    data: {
        isActive: boolean;
        isTranscribing: boolean;
        vadEnabled: boolean;
        audioStats: any;
        vadStats: any;
        sliceStats: any;
    };
}
export interface RealtimeTranscriberCallbacks {
    onBeginTranscribe?: (sliceInfo: {
        audioData: Uint8Array;
        sliceIndex: number;
        duration: number;
        vadEvent?: RealtimeVadEvent;
    }) => Promise<boolean>;
    onTranscribe?: (event: RealtimeTranscribeEvent) => void;
    onBeginVad?: (sliceInfo: {
        audioData: Uint8Array;
        sliceIndex: number;
        duration: number;
    }) => Promise<boolean>;
    onVad?: (event: RealtimeVadEvent) => void;
    onError?: (error: string) => void;
    onStatusChange?: (isActive: boolean) => void;
    onStatsUpdate?: (event: RealtimeStatsEvent) => void;
    onSliceTranscriptionStabilized?: (text: string) => void;
}
export type WhisperContextLike = {
    transcribeData: (data: ArrayBuffer, options: TranscribeOptions) => {
        stop: () => Promise<void>;
        promise: Promise<TranscribeResult>;
    };
};
export type ParakeetContextLike = {
    transcribeData: (data: ArrayBuffer, options: ParakeetTranscribeOptions) => {
        stop: () => Promise<void>;
        promise: Promise<TranscribeResult>;
    };
};
export type WhisperVadContextLike = {
    detectSpeechData: (data: ArrayBuffer, options: VadOptions) => Promise<Array<{
        t0: number;
        t1: number;
    }>>;
};
export interface RealtimeVadContextLike {
    processAudio(data: Uint8Array): void;
    onSpeechStart: (callback: (confidence: number, data: Uint8Array) => void) => void;
    onSpeechContinue: (callback: (confidence: number, data: Uint8Array) => void) => void;
    onSpeechEnd: (callback: (confidence: number) => void) => void;
    onError: (callback: (error: string) => void) => void;
    updateOptions(options: Partial<VadOptions>): void;
    flush(): Promise<void>;
    reset(): Promise<void>;
}
/**
 * Dependencies for realtime transcription. Provide exactly one transcription
 * context: `whisperContext` or `parakeetContext`.
 */
export type RealtimeTranscriberDependencies = {
    vadContext?: RealtimeVadContextLike;
    audioStream: AudioStreamInterface;
    fs?: WavFileWriterFs;
} & ({
    /** Whisper context used for realtime transcription. */
    whisperContext: WhisperContextLike;
    parakeetContext?: never;
} | {
    /** Parakeet context used for realtime transcription. */
    parakeetContext: ParakeetContextLike;
    whisperContext?: never;
});
//# sourceMappingURL=types.d.ts.map