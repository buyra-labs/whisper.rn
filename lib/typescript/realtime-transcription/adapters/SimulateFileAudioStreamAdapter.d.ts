import type { AudioStreamInterface, AudioStreamConfig, AudioStreamData } from '../types';
import { WavFileReaderFs } from '../../utils/WavFileReader';
export interface SimulateFileOptions {
    fs: WavFileReaderFs;
    filePath: string;
    playbackSpeed?: number;
    chunkDurationMs?: number;
    loop?: boolean;
    onEndOfFile?: () => void;
    logger?: (message: string) => void;
}
export declare class SimulateFileAudioStreamAdapter implements AudioStreamInterface {
    private fileReader;
    private config;
    private options;
    private isInitialized;
    private recording;
    private dataCallback?;
    private errorCallback?;
    private statusCallback?;
    private streamInterval?;
    private currentBytePosition;
    private startTime;
    private pausedTime;
    private hasReachedEnd;
    constructor(options: SimulateFileOptions);
    initialize(config: AudioStreamConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRecording(): boolean;
    onData(callback: (data: AudioStreamData) => void): void;
    onError(callback: (error: string) => void): void;
    onStatusChange(callback: (isRecording: boolean) => void): void;
    onEnd(callback: () => void): void;
    release(): Promise<void>;
    /**
     * Start the streaming process
     */
    private startStreaming;
    /**
     * Stream the next audio chunk
     */
    private streamNextChunk;
    /**
     * Get current playback statistics
     */
    getStatistics(): {
        filePath: string;
        isRecording: boolean;
        currentTime: number;
        totalDuration: number;
        progress: number;
        playbackSpeed: number | undefined;
        currentBytePosition: number;
        totalBytes: number;
        hasReachedEnd: boolean;
        header: import("../../utils/WavFileReader").WavFileHeader | null;
    };
    /**
     * Seek to a specific time position
     */
    seekToTime(timeSeconds: number): void;
    /**
     * Set playback speed
     */
    setPlaybackSpeed(speed: number): void;
    /**
     * Reset file buffer to beginning
     */
    resetBuffer(): void;
    /**
     * Logger function
     */
    private log;
}
//# sourceMappingURL=SimulateFileAudioStreamAdapter.d.ts.map