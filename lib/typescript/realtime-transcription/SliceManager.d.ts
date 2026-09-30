import type { AudioSlice, MemoryUsage } from './types';
export declare class SliceManager {
    private slices;
    private currentSliceIndex;
    private transcribeSliceIndex;
    private maxSlicesInMemory;
    private sliceDurationSec;
    private sampleRate;
    constructor(sliceDurationSec?: number, maxSlicesInMemory?: number, sampleRate?: number);
    /**
     * Add audio data to the current slice
     */
    addAudioData(audioData: Uint8Array): {
        slice?: AudioSlice;
    };
    /**
     * Get the current slice being built
     */
    private getCurrentSlice;
    /**
     * Finalize the current slice
     */
    private finalizeCurrentSlice;
    /**
     * Get a slice for transcription
     */
    getSliceForTranscription(): AudioSlice | null;
    /**
     * Mark a slice as processed
     */
    markSliceAsProcessed(sliceIndex: number): void;
    /**
     * Move to the next slice for transcription
     */
    moveToNextTranscribeSlice(): void;
    /**
     * Get audio data for transcription (base64 encoded)
     */
    getAudioDataForTranscription(sliceIndex: number): Uint8Array | null;
    /**
     * Get a slice by index
     */
    getSliceByIndex(sliceIndex: number): AudioSlice | null;
    /**
     * Clean up old slices to manage memory
     */
    private cleanupOldSlices;
    /**
     * Get memory usage statistics
     */
    getMemoryUsage(): MemoryUsage;
    /**
     * Reset all slices and indices
     */
    reset(): void;
    /**
     * Get current slice information
     */
    getCurrentSliceInfo(): {
        currentSliceIndex: number;
        transcribeSliceIndex: number;
        totalSlices: number;
        memoryUsage: MemoryUsage;
    };
    /**
     * Force move to the next slice, finalizing the current one regardless of capacity
     */
    forceNextSlice(): {
        slice?: AudioSlice;
    };
}
//# sourceMappingURL=SliceManager.d.ts.map