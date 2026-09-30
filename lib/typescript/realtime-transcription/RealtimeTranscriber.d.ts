import type { VadOptions } from '../index';
import type { RealtimeOptions, RealtimeTranscribeEvent, RealtimeTranscriberCallbacks, RealtimeTranscriberDependencies, AudioSliceNoData } from './types';
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
export declare class RealtimeTranscriber {
    private transcriptionContext;
    private vadContext?;
    private audioStream;
    private fs?;
    private sliceManager;
    private callbacks;
    private options;
    private isActive;
    private isTranscribing;
    private vadEnabled;
    private isSpeechActive;
    private transcriptionQueue;
    private wavFileWriter;
    private lastSpeechDetectedTime;
    private lastStatsSnapshot;
    private lastRealtimeTranscriptionTime;
    private transcriptionResults;
    private vadEvents;
    private activeTranscriptions;
    constructor(dependencies: RealtimeTranscriberDependencies, options?: RealtimeOptions, callbacks?: RealtimeTranscriberCallbacks);
    /**
     * Start realtime transcription
     */
    start(): Promise<void>;
    /**
     * Stop realtime transcription
     */
    stop(): Promise<void>;
    /**
     * Handle incoming audio data
     */
    private handleAudioData;
    /**
     * Process audio chunk through the VAD pipeline
     */
    private processAudioChunk;
    private handleSpeechDetected;
    private handleSpeechContinue;
    private handleSpeechEnded;
    /**
     * Trigger transcription for the current slice
     */
    private triggerTranscription;
    private emitVadEvent;
    private isProcessingTranscriptionQueue;
    private processingPromise;
    /**
     * Process the transcription queue
     */
    private processTranscriptionQueue;
    /**
     * Build prompt from initial prompt and previous slices
     */
    private buildPrompt;
    /**
     * Texts of the most recent non-empty results before the given slice, oldest first,
     * limited to maxPromptSlices so the prompt stays bounded regardless of session length.
     */
    private getPreviousResultTexts;
    /**
     * Process a single transcription
     */
    private processTranscription;
    /**
     * Handle audio stream end
     */
    private handleAudioEnd;
    /**
     * Handle audio status changes
     */
    private handleAudioStatusChange;
    /**
     * Handle errors from components
     */
    private handleError;
    /**
     * Update callbacks
     */
    updateCallbacks(callbacks: Partial<RealtimeTranscriberCallbacks>): void;
    /**
     * Update VAD options dynamically (delegates to VAD context)
     */
    updateVadOptions(options: Partial<VadOptions>): void;
    /**
     * Get current statistics
     */
    getStatistics(): {
        isActive: boolean;
        isTranscribing: boolean;
        vadEnabled: boolean;
        audioStats: {
            isRecording: boolean;
            accumulatedSamples: number;
        };
        vadStats: {
            enabled: boolean;
            contextAvailable: boolean;
            lastSpeechDetectedTime: number;
        } | null;
        sliceStats: {
            currentSliceIndex: number;
            transcribeSliceIndex: number;
            totalSlices: number;
            memoryUsage: import("./types").MemoryUsage;
        };
    };
    /**
     * Get the retained transcription results, oldest first.
     *
     * When `maxResultsInMemory` is set this is only the most recent window; callers that need
     * every result should collect them from the `onTranscribe` callback as they arrive.
     */
    getTranscriptionResults(): Array<{
        slice: AudioSliceNoData;
        transcribeEvent: RealtimeTranscribeEvent;
    }>;
    /**
     * Force move to the next slice, finalizing the current one regardless of capacity
     */
    nextSlice(): Promise<void>;
    /**
     * Reset all components
     */
    reset(): void;
    /**
     * Release all resources
     */
    release(): Promise<void>;
    /**
     * Emit stats update event if stats have changed significantly
     */
    private emitStatsUpdate;
    /**
     * Determine if stats update should be emitted
     */
    private static shouldEmitStatsUpdate;
    /**
     * Logger function
     */
    private log;
}
//# sourceMappingURL=RealtimeTranscriber.d.ts.map