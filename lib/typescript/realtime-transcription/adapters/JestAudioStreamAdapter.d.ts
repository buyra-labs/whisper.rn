import type { AudioStreamInterface, AudioStreamConfig, AudioStreamData } from '../types';
export interface JestAudioStreamAdapterOptions {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    simulateLatency?: number;
    simulateErrors?: boolean;
    simulateStartErrorOnly?: boolean;
    chunkSize?: number;
    chunkInterval?: number;
    maxChunks?: number;
    audioData?: Uint8Array;
    generateSilence?: boolean;
}
export declare class JestAudioStreamAdapter implements AudioStreamInterface {
    private config;
    private options;
    private isInitialized;
    private recording;
    private dataCallback?;
    private errorCallback?;
    private statusCallback?;
    private streamInterval?;
    private chunksSent;
    private startTime;
    constructor(options?: JestAudioStreamAdapterOptions);
    initialize(config: AudioStreamConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRecording(): boolean;
    onData(callback: (data: AudioStreamData) => void): void;
    onError(callback: (error: string) => void): void;
    onStatusChange(callback: (isRecording: boolean) => void): void;
    release(): Promise<void>;
    simulateError(error: string): void;
    simulateDataChunk(data: Uint8Array): void;
    getChunksSent(): number;
    getTotalBytesStreamed(): number;
    getStreamDuration(): number;
    private startStreaming;
    private generateAudioChunk;
    private static delay;
}
//# sourceMappingURL=JestAudioStreamAdapter.d.ts.map