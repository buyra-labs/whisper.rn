import type { RealtimeVadContextLike, WhisperVadContextLike } from './types';
import { VAD_PRESETS } from './types';
import type { VadOptions } from '../index';
export type RingBufferVadOptions = {
    vadOptions?: VadOptions;
    vadPreset?: keyof typeof VAD_PRESETS;
    preRecordingBufferMs?: number;
    sampleRate?: number;
    inferenceIntervalMs?: number;
    speechRateThreshold?: number;
    logger?: (message: string) => void;
};
export declare class RingBufferVad implements RealtimeVadContextLike {
    private vadContext;
    private ringBuffer;
    private options;
    private isSpeechActive;
    private silenceStartTime;
    private currentSpeechStartTime;
    private activeVadPromises;
    private vadInferenceQueue;
    private isProcessingVad;
    private speechDetectedCallback;
    private speechContinueCallback;
    private speechEndedCallback;
    private errorCallback;
    private chunkAccumulated;
    private accumulatedChunks;
    private targetChunkSize;
    constructor(vadContext: WhisperVadContextLike, options?: RingBufferVadOptions);
    onSpeechStart(callback: (confidence: number, data: Uint8Array) => void): void;
    onSpeechContinue(callback: (confidence: number, data: Uint8Array) => void): void;
    onSpeechEnd(callback: (confidence: number) => void): void;
    onError(callback: (error: string) => void): void;
    processAudio(data: Uint8Array): void;
    flush(): Promise<void>;
    reset(): Promise<void>;
    private processVad;
    private processVadQueue;
    private handleVadStateChange;
    private log;
    updateOptions(options: Partial<VadOptions>): void;
}
//# sourceMappingURL=RingBufferVad.d.ts.map