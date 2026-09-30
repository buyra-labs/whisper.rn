/**
 * RingBuffer - A fixed-size circular buffer for audio data
 *
 * This class implements a ring buffer (circular buffer) that maintains
 * a fixed memory footprint regardless of how much data is written.
 * It's designed for pre-recording audio where we only need to keep
 * the last N seconds of audio before speech is detected.
 *
 * Key features:
 * - Fixed memory allocation (no unbounded growth)
 * - O(1) write operations
 * - Preserves most recent data when buffer is full
 */
export declare class RingBuffer {
    private buffer;
    private writeIndex;
    private dataLength;
    private readonly maxBytes;
    /**
     * Create a new RingBuffer
     * @param maxBytes Maximum buffer size in bytes
     */
    constructor(maxBytes: number);
    /**
     * Write audio data to the buffer
     * If data exceeds buffer capacity, oldest data is overwritten
     * @param data Audio data to write
     */
    write(data: Uint8Array): void;
    /**
     * Read all available data from the buffer in correct order
     * Does NOT clear the buffer (use clear() for that)
     * @returns Uint8Array containing the buffered data in order
     */
    read(): Uint8Array;
    /**
     * Clear the buffer and reset indices
     */
    clear(): void;
    /**
     * Get the current amount of data in the buffer
     * @returns Number of bytes currently in the buffer
     */
    getLength(): number;
    /**
     * Get the maximum capacity of the buffer
     * @returns Maximum buffer size in bytes
     */
    getCapacity(): number;
    /**
     * Check if the buffer is empty
     * @returns true if buffer contains no data
     */
    isEmpty(): boolean;
    /**
     * Check if the buffer is full
     * @returns true if buffer has reached capacity
     */
    isFull(): boolean;
    /**
     * Get the fill percentage of the buffer
     * @returns Number between 0 and 1 representing how full the buffer is
     */
    getFillRatio(): number;
}
//# sourceMappingURL=RingBuffer.d.ts.map