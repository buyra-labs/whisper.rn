import type { AudioStreamInterface, AudioStreamConfig, AudioStreamData } from '../types';
export declare class AudioPcmStreamAdapter implements AudioStreamInterface {
    private isInitialized;
    private recording;
    private config;
    private dataCallback?;
    private errorCallback?;
    private statusCallback?;
    initialize(config: AudioStreamConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRecording(): boolean;
    onData(callback: (data: AudioStreamData) => void): void;
    onError(callback: (error: string) => void): void;
    onStatusChange(callback: (isRecording: boolean) => void): void;
    release(): Promise<void>;
    /**
     * Handle incoming audio data from LiveAudioStream
     */
    private handleAudioData;
}
//# sourceMappingURL=AudioPcmStreamAdapter.d.ts.map