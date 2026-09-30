export interface WavFileReaderFs {
    readFile: (filePath: string, encoding: string) => Promise<string>;
    exists: (filePath: string) => Promise<boolean>;
    unlink: (filePath: string) => Promise<void>;
}
export interface WavFileHeader {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    dataSize: number;
    duration: number;
}
export declare class WavFileReader {
    private filePath;
    private header;
    private audioData;
    private fs;
    constructor(fs: {
        exists: (filePath: string) => Promise<boolean>;
        readFile: (filePath: string, encoding: string) => Promise<string>;
    }, filePath: string);
    /**
     * Read and parse the WAV file
     */
    initialize(): Promise<void>;
    /**
     * Parse WAV file header
     */
    private static parseWavHeader;
    private static readChunkId;
    private static hasPcmExtensibleSubFormat;
    /**
     * Get audio data slice
     */
    getAudioSlice(startByte: number, lengthBytes: number): Uint8Array | null;
    getAudioData(): Uint8Array | null;
    /**
     * Get WAV file header information
     */
    getHeader(): WavFileHeader | null;
    /**
     * Get total audio data size
     */
    getTotalDataSize(): number;
    /**
     * Convert byte position to time in seconds
     */
    byteToTime(bytePosition: number): number;
    /**
     * Convert time in seconds to byte position
     */
    timeToByte(timeSeconds: number): number;
    /**
     * Get file statistics
     */
    getStatistics(): {
        filePath: string;
        header: WavFileHeader | null;
        totalDataSize: number;
        isInitialized: boolean;
    };
}
//# sourceMappingURL=WavFileReader.d.ts.map