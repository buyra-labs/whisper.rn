export interface WavFileConfig {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
}
export interface WavFileWriterFs {
    writeFile: (filePath: string, data: string, encoding: string) => Promise<void>;
    appendFile: (filePath: string, data: string, encoding: string) => Promise<void>;
    readFile: (filePath: string, encoding: string) => Promise<string>;
    exists: (filePath: string) => Promise<boolean>;
    unlink: (filePath: string) => Promise<void>;
}
export declare class WavFileWriter {
    private fs;
    private filePath;
    private config;
    private dataSize;
    private isWriting;
    private writeQueue;
    constructor(fs: WavFileWriterFs, filePath: string, config: WavFileConfig);
    /**
     * Initialize the WAV file with headers
     */
    initialize(): Promise<void>;
    /**
     * Append PCM audio data to the WAV file
     */
    appendAudioData(audioData: Uint8Array): Promise<void>;
    /**
     * Process the write queue to avoid blocking
     */
    private processWriteQueue;
    /**
     * Finalize the WAV file by updating the header with correct sizes
     */
    finalize(): Promise<void>;
    /**
     * Create WAV file header
     */
    private createWavHeader;
    /**
     * Cancel writing and cleanup
     */
    cancel(): Promise<void>;
    /**
     * Get current file statistics
     */
    getStatistics(): {
        filePath: string;
        dataSize: number;
        durationSec: number;
        isWriting: boolean;
        queuedChunks: number;
        estimatedFileSizeMB: number;
    };
}
//# sourceMappingURL=WavFileWriter.d.ts.map