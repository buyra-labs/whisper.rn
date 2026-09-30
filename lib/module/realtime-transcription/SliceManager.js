export class SliceManager {
  slices = [];
  currentSliceIndex = 0;
  transcribeSliceIndex = 0;
  constructor() {
    let sliceDurationSec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 30;
    let maxSlicesInMemory = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
    let sampleRate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 16000;
    this.sliceDurationSec = sliceDurationSec;
    this.maxSlicesInMemory = maxSlicesInMemory;
    this.sampleRate = sampleRate;
  }

  /**
   * Add audio data to the current slice
   */
  addAudioData(audioData) {
    // Get or create current slice
    const currentSlice = this.getCurrentSlice();

    // Calculate bytes per slice (2 bytes per sample for 16-bit PCM)
    const bytesPerSlice = this.sliceDurationSec * this.sampleRate * 2;

    // Check if adding this data would exceed slice capacity
    if (currentSlice.sampleCount + audioData.length > bytesPerSlice) {
      // Finalize current slice and create new one
      this.finalizeCurrentSlice();
      this.currentSliceIndex += 1;
      return this.addAudioData(audioData); // Recursively add to new slice
    }

    // Append data to current slice
    const newData = new Uint8Array(currentSlice.sampleCount + audioData.length);
    newData.set(currentSlice.data.subarray(0, currentSlice.sampleCount));
    newData.set(audioData, currentSlice.sampleCount);
    currentSlice.data = newData;
    currentSlice.sampleCount += audioData.length;
    currentSlice.endTime = Date.now();

    // Check if slice is complete
    const isSliceComplete = currentSlice.sampleCount >= bytesPerSlice * 0.8; // 80% full

    if (isSliceComplete) {
      this.finalizeCurrentSlice();
    }
    return {
      slice: currentSlice
    };
  }

  /**
   * Get the current slice being built
   */
  getCurrentSlice() {
    let slice = this.slices.find(s => s.index === this.currentSliceIndex);
    if (!slice) {
      const bytesPerSlice = this.sliceDurationSec * this.sampleRate * 2; // 2 bytes per sample
      slice = {
        index: this.currentSliceIndex,
        data: new Uint8Array(bytesPerSlice),
        sampleCount: 0,
        startTime: Date.now(),
        endTime: Date.now(),
        isProcessed: false,
        isReleased: false
      };
      this.slices.push(slice);

      // Clean up old slices if we have too many
      this.cleanupOldSlices();
    }
    return slice;
  }

  /**
   * Finalize the current slice
   */
  finalizeCurrentSlice() {
    const slice = this.slices.find(s => s.index === this.currentSliceIndex);
    if (slice && slice.sampleCount > 0) {
      // Trim the data array to actual size
      slice.data = slice.data.subarray(0, slice.sampleCount);
      slice.endTime = Date.now();
    }
  }

  /**
   * Get a slice for transcription
   */
  getSliceForTranscription() {
    const slice = this.slices.find(s => s.index === this.transcribeSliceIndex && !s.isProcessed);
    if (slice && slice.sampleCount > 0) {
      return slice;
    }
    return null;
  }

  /**
   * Mark a slice as processed
   */
  markSliceAsProcessed(sliceIndex) {
    const slice = this.slices.find(s => s.index === sliceIndex);
    if (slice) {
      slice.isProcessed = true;
    }
  }

  /**
   * Move to the next slice for transcription
   */
  moveToNextTranscribeSlice() {
    this.transcribeSliceIndex += 1;
  }

  /**
   * Get audio data for transcription (base64 encoded)
   */
  getAudioDataForTranscription(sliceIndex) {
    const slice = this.slices.find(s => s.index === sliceIndex);
    if (!slice || slice.sampleCount === 0) {
      return null;
    }
    return slice.data.subarray(0, slice.sampleCount);
  }

  /**
   * Get a slice by index
   */
  getSliceByIndex(sliceIndex) {
    return this.slices.find(s => s.index === sliceIndex) || null;
  }

  /**
   * Clean up old slices to manage memory
   */
  cleanupOldSlices() {
    if (this.slices.length <= this.maxSlicesInMemory) {
      return;
    }

    // Sort slices by index
    this.slices.sort((a, b) => a.index - b.index);

    // Keep only the most recent slices
    const slicesToKeep = this.slices.slice(-this.maxSlicesInMemory);
    const slicesToRemove = this.slices.slice(0, -this.maxSlicesInMemory);

    // Release old slices
    slicesToRemove.forEach(slice => {
      if (!slice.isReleased) {
        slice.isReleased = true;
        // Clear the audio data to free memory
        slice.data = new Uint8Array(0);
      }
    });
    this.slices = slicesToKeep;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage() {
    const activeSlices = this.slices.filter(s => !s.isReleased);
    const totalBytes = activeSlices.reduce((sum, slice) => sum + slice.sampleCount, 0);

    // Estimate memory usage (Uint8Array = 1 byte per sample)
    const estimatedMB = totalBytes / (1024 * 1024);
    return {
      slicesInMemory: activeSlices.length,
      totalSamples: totalBytes / 2,
      // Convert bytes to samples (2 bytes per sample)
      estimatedMB: Math.round(estimatedMB * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Reset all slices and indices
   */
  reset() {
    // Release all slices
    this.slices.forEach(slice => {
      slice.isReleased = true;
      // Clear the audio data to free memory
      slice.data = new Uint8Array(0);
    });

    // Reset state
    this.slices = [];
    this.currentSliceIndex = 0;
    this.transcribeSliceIndex = 0;
  }

  /**
   * Get current slice information
   */
  getCurrentSliceInfo() {
    return {
      currentSliceIndex: this.currentSliceIndex,
      transcribeSliceIndex: this.transcribeSliceIndex,
      totalSlices: this.slices.length,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Force move to the next slice, finalizing the current one regardless of capacity
   */
  forceNextSlice() {
    const currentSlice = this.slices.find(s => s.index === this.currentSliceIndex);
    if (currentSlice && currentSlice.sampleCount > 0) {
      // Finalize current slice
      this.finalizeCurrentSlice();

      // Move to next slice
      this.currentSliceIndex += 1;
      return {
        slice: currentSlice
      };
    }

    // If no current slice or it's empty, just move to next index
    this.currentSliceIndex += 1;
    return {};
  }
}
//# sourceMappingURL=SliceManager.js.map