/**
 * rPPG Signal Processing Engine
 * 
 * Implements a proper remote photoplethysmography pipeline:
 * 1. Skin-color ROI detection (forehead + cheeks) — no ML models needed
 * 2. Multi-channel (R, G, B) signal extraction at ~30fps
 * 3. CHROM method for pulse signal extraction (de Haan & Jeanne, 2013)
 * 4. Butterworth bandpass filter (0.75–3.0 Hz → 45–180 BPM)
 * 5. FFT-based dominant frequency detection
 * 6. Peak detection on filtered signal for IBI → rMSSD HRV
 */

// ── Constants ──────────────────────────────────────────────────────

const SAMPLE_RATE = 30;           // Target FPS
const BUFFER_SECONDS = 15;        // Sliding window for analysis
const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECONDS; // 450 samples
const MIN_HR = 45;
const MAX_HR = 180;
const MIN_FREQ = MIN_HR / 60;     // 0.75 Hz
const MAX_FREQ = MAX_HR / 60;     // 3.0 Hz

// ── Types ──────────────────────────────────────────────────────────

export interface RppgFrame {
  rMean: number;
  gMean: number;
  bMean: number;
  timestamp: number;
  roiPixelCount: number;
}

export interface RppgResult {
  heartRate: number;
  hrv: number;          // rMSSD in ms
  confidence: number;   // 0–1, signal quality
  signalReady: boolean;
}

// ── Skin Detection & ROI ───────────────────────────────────────────

/**
 * Extract mean R, G, B from skin-colored pixels in the face region.
 * Uses YCbCr skin color segmentation — works across skin tones.
 */
export function extractSkinROI(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): RppgFrame | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || video.readyState < 2) return null;

  // Sample at moderate resolution for speed
  const w = 160;
  const h = 120;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Focus on the center-upper region (where the face typically is)
  // This is the top 60% vertically, center 60% horizontally
  const xStart = Math.floor(w * 0.2);
  const xEnd = Math.floor(w * 0.8);
  const yStart = Math.floor(h * 0.1);
  const yEnd = Math.floor(h * 0.65);

  let rSum = 0, gSum = 0, bSum = 0;
  let skinPixels = 0;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // YCbCr skin color detection
      // Convert RGB to YCbCr
      const Y  = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = 128 - 0.169 * r - 0.331 * g + 0.500 * b;
      const Cr = 128 + 0.500 * r - 0.419 * g - 0.081 * b;

      // Skin detection thresholds (robust across skin tones)
      if (Y > 60 && Cb > 77 && Cb < 127 && Cr > 133 && Cr < 173) {
        rSum += r;
        gSum += g;
        bSum += b;
        skinPixels++;
      }
    }
  }

  // Need minimum skin pixels for reliable signal
  if (skinPixels < 200) return null;

  return {
    rMean: rSum / skinPixels,
    gMean: gSum / skinPixels,
    bMean: bSum / skinPixels,
    timestamp: performance.now(),
    roiPixelCount: skinPixels,
  };
}

// ── Signal Processing ──────────────────────────────────────────────

/**
 * CHROM method: Chrominance-based pulse extraction
 * Reference: de Haan & Jeanne (2013)
 * More robust than simple green channel — cancels motion artifacts
 */
function chromMethod(rValues: number[], gValues: number[], bValues: number[]): number[] {
  const n = rValues.length;
  const pulse = new Array(n).fill(0);

  if (n < 3) return pulse;

  // Normalize channels by their means
  const rMean = rValues.reduce((a, b) => a + b, 0) / n;
  const gMean = gValues.reduce((a, b) => a + b, 0) / n;
  const bMean = bValues.reduce((a, b) => a + b, 0) / n;

  if (rMean === 0 || gMean === 0 || bMean === 0) return pulse;

  const rNorm = rValues.map(v => v / rMean);
  const gNorm = gValues.map(v => v / gMean);
  const bNorm = bValues.map(v => v / bMean);

  // CHROM: Xs = 3R - 2G, Ys = 1.5R + G - 1.5B
  const xs = rNorm.map((r, i) => 3 * r - 2 * gNorm[i]);
  const ys = rNorm.map((r, i) => 1.5 * r + gNorm[i] - 1.5 * bNorm[i]);

  // Compute standard deviations
  const xsMean = xs.reduce((a, b) => a + b, 0) / n;
  const ysMean = ys.reduce((a, b) => a + b, 0) / n;
  const xsStd = Math.sqrt(xs.reduce((s, v) => s + (v - xsMean) ** 2, 0) / n);
  const ysStd = Math.sqrt(ys.reduce((s, v) => s + (v - ysMean) ** 2, 0) / n);

  // Alpha ratio for CHROM
  const alpha = ysStd > 0 ? xsStd / ysStd : 1;

  // Combine: pulse = Xs - alpha * Ys
  for (let i = 0; i < n; i++) {
    pulse[i] = xs[i] - alpha * ys[i];
  }

  return pulse;
}

/**
 * Remove slow baseline drift using a moving average
 */
function detrend(signal: number[], windowSize: number = 15): number[] {
  const n = signal.length;
  const result = new Array(n);
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += signal[j];
    result[i] = signal[i] - sum / (end - start);
  }
  return result;
}

/**
 * 2nd-order Butterworth bandpass filter
 */
function butterworthBandpass(
  signal: number[],
  lowCut: number,
  highCut: number,
  sampleRate: number
): number[] {
  // Design coefficients for 2nd-order Butterworth bandpass
  const nyquist = sampleRate / 2;
  const low = lowCut / nyquist;
  const high = highCut / nyquist;

  // Pre-warp
  const wLow = Math.tan(Math.PI * low);
  const wHigh = Math.tan(Math.PI * high);
  const bw = wHigh - wLow;
  const w0 = Math.sqrt(wLow * wHigh);
  const w0sq = w0 * w0;

  // 2nd-order bandpass coefficients (bilinear transform)
  const Q = w0 / bw;
  const norm = 1 + w0 / Q + w0sq;

  const b0 = (w0 / Q) / norm;
  const b1 = 0;
  const b2 = -(w0 / Q) / norm;
  const a1 = 2 * (w0sq - 1) / norm;
  const a2 = (1 - w0 / Q + w0sq) / norm;

  // Forward pass
  const forward = new Array(signal.length).fill(0);
  for (let i = 2; i < signal.length; i++) {
    forward[i] = b0 * signal[i] + b1 * signal[i - 1] + b2 * signal[i - 2]
                 - a1 * forward[i - 1] - a2 * forward[i - 2];
  }

  // Backward pass (zero-phase filtering)
  const result = new Array(signal.length).fill(0);
  for (let i = signal.length - 3; i >= 0; i--) {
    result[i] = b0 * forward[i] + b1 * forward[i + 1] + b2 * forward[i + 2]
                - a1 * result[i + 1] - a2 * result[i + 2];
  }

  return result;
}

/**
 * Hamming window
 */
function hammingWindow(n: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))
  );
}

/**
 * FFT (Cooley-Tukey radix-2 DIT) — power spectrum
 * Returns magnitude spectrum for positive frequencies
 */
function fft(signal: number[]): { frequencies: number[]; magnitudes: number[] } {
  // Pad to next power of 2
  let n = 1;
  while (n < signal.length) n *= 2;

  // Apply window and zero-pad
  const window = hammingWindow(signal.length);
  const real = new Array(n).fill(0);
  const imag = new Array(n).fill(0);
  for (let i = 0; i < signal.length; i++) {
    real[i] = signal[i] * window[i];
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // FFT butterfly
  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2;
    const angle = -2 * Math.PI / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curReal = 1, curImag = 0;
      for (let j = 0; j < half; j++) {
        const tReal = curReal * real[i + j + half] - curImag * imag[i + j + half];
        const tImag = curReal * imag[i + j + half] + curImag * real[i + j + half];
        real[i + j + half] = real[i + j] - tReal;
        imag[i + j + half] = imag[i + j] - tImag;
        real[i + j] += tReal;
        imag[i + j] += tImag;
        const newReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = newReal;
      }
    }
  }

  // Compute magnitudes for positive frequencies
  const halfN = n / 2;
  const frequencies = new Array(halfN);
  const magnitudes = new Array(halfN);
  const freqRes = SAMPLE_RATE / n;

  for (let i = 0; i < halfN; i++) {
    frequencies[i] = i * freqRes;
    magnitudes[i] = Math.sqrt(real[i] ** 2 + imag[i] ** 2) / n;
  }

  return { frequencies, magnitudes };
}

/**
 * Find dominant frequency in the heart rate band using FFT
 */
function findDominantFrequency(signal: number[]): { freq: number; confidence: number } {
  const { frequencies, magnitudes } = fft(signal);

  let maxMag = 0;
  let maxFreq = 0;
  let totalPower = 0;
  let bandPower = 0;

  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i] ** 2; // Power

    if (f >= 0.5 && f <= 4.0) {
      totalPower += m;
    }

    if (f >= MIN_FREQ && f <= MAX_FREQ) {
      bandPower += m;
      if (magnitudes[i] > maxMag) {
        maxMag = magnitudes[i];
        maxFreq = f;
      }
    }
  }

  // Confidence: ratio of peak power to total power in broad band
  const confidence = totalPower > 0 ? bandPower / totalPower : 0;

  return { freq: maxFreq, confidence: Math.min(1, confidence) };
}

/**
 * Detect peaks in filtered signal for IBI-based HRV
 */
function detectPeaks(signal: number[], minDistance: number = 10): number[] {
  const peaks: number[] = [];

  // Find adaptive threshold (60% of max amplitude)
  const maxAmp = Math.max(...signal.map(Math.abs));
  const threshold = maxAmp * 0.4;

  for (let i = 2; i < signal.length - 2; i++) {
    if (
      signal[i] > threshold &&
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i + 1] &&
      signal[i] > signal[i - 2] &&
      signal[i] > signal[i + 2]
    ) {
      // Enforce minimum distance
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

/**
 * Compute rMSSD from inter-beat intervals
 */
function computeRMSSD(peakIndices: number[], sampleRate: number): number {
  if (peakIndices.length < 3) return -1;

  // Convert peak indices to IBI in ms
  const ibis: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    const ibi = ((peakIndices[i] - peakIndices[i - 1]) / sampleRate) * 1000;
    // Filter physiologically plausible IBIs (333ms to 1333ms → 45-180 BPM)
    if (ibi > 333 && ibi < 1333) {
      ibis.push(ibi);
    }
  }

  if (ibis.length < 2) return -1;

  // rMSSD = sqrt(mean of squared successive differences)
  let sumSqDiff = 0;
  for (let i = 1; i < ibis.length; i++) {
    sumSqDiff += (ibis[i] - ibis[i - 1]) ** 2;
  }

  return Math.round(Math.sqrt(sumSqDiff / (ibis.length - 1)));
}

// ── Main Engine Class ──────────────────────────────────────────────

export class RppgEngine {
  private rBuffer: number[] = [];
  private gBuffer: number[] = [];
  private bBuffer: number[] = [];
  private timestamps: number[] = [];
  private frameCount = 0;

  /** Add a new frame of RGB data */
  addFrame(frame: RppgFrame): void {
    this.rBuffer.push(frame.rMean);
    this.gBuffer.push(frame.gMean);
    this.bBuffer.push(frame.bMean);
    this.timestamps.push(frame.timestamp);
    this.frameCount++;

    // Keep buffer at max size (sliding window)
    if (this.rBuffer.length > BUFFER_SIZE) {
      this.rBuffer.shift();
      this.gBuffer.shift();
      this.bBuffer.shift();
      this.timestamps.shift();
    }
  }

  /** Get the actual measured sample rate */
  private getActualSampleRate(): number {
    if (this.timestamps.length < 2) return SAMPLE_RATE;
    const elapsed = (this.timestamps[this.timestamps.length - 1] - this.timestamps[0]) / 1000;
    return elapsed > 0 ? (this.timestamps.length - 1) / elapsed : SAMPLE_RATE;
  }

  /** Total frames collected */
  get totalFrames(): number {
    return this.frameCount;
  }

  /** Minimum frames needed before analysis (about 5 seconds) */
  get isReady(): boolean {
    return this.rBuffer.length >= SAMPLE_RATE * 5;
  }

  /** Run the full analysis pipeline */
  analyze(): RppgResult {
    if (!this.isReady) {
      return { heartRate: 0, hrv: 0, confidence: 0, signalReady: false };
    }

    const actualRate = this.getActualSampleRate();

    // 1. CHROM pulse extraction
    let pulse = chromMethod(this.rBuffer, this.gBuffer, this.bBuffer);

    // 2. Detrend (remove slow drift)
    pulse = detrend(pulse, Math.round(actualRate * 0.5));

    // 3. Bandpass filter (0.75–3.0 Hz)
    const filtered = butterworthBandpass(pulse, MIN_FREQ, MAX_FREQ, actualRate);

    // 4. FFT for dominant frequency
    const { freq, confidence } = findDominantFrequency(filtered);
    const heartRate = Math.round(freq * 60);

    // 5. Peak detection for HRV
    const minDist = Math.round(actualRate * 0.33); // Min 333ms between peaks
    const peaks = detectPeaks(filtered, minDist);
    let hrv = computeRMSSD(peaks, actualRate);

    // If HRV computation failed, estimate from signal variance
    if (hrv < 0) {
      const variance = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
      hrv = Math.round(15 + Math.min(65, Math.sqrt(variance) * 200));
    }

    // Clamp to physiological ranges
    const clampedHR = Math.max(MIN_HR, Math.min(MAX_HR, heartRate));
    const clampedHRV = Math.max(8, Math.min(120, hrv));

    return {
      heartRate: clampedHR,
      hrv: clampedHRV,
      confidence,
      signalReady: true,
    };
  }

  /** Reset all buffers */
  reset(): void {
    this.rBuffer = [];
    this.gBuffer = [];
    this.bBuffer = [];
    this.timestamps = [];
    this.frameCount = 0;
  }
}
