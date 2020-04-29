/**
 * WebAudio JS implementation of Loudness Calculation based on
 * https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-4-201510-I%21%21PDF-E.pdf
 * https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BS.2217-2-2016-PDF-E.pdf
 *
 * Strip off most of the unneccesary stuff from loudness adaption demo project (some part may still look ugly though)
 *
 * author: Thomas Goepfert
 */

'use strict';

/**
 * buffer: the AudioBuffer, only needed for getting samplerate and number of channels, may also be obtained elsewhere
 * callback: callback function called after processing a chunk of the audiobuffer
 */
class LoudnessSample {
  constructor(sampleRate, id) {
    this.id = id || -1; // debugging purpose

    this.loudnessprops = {
      interval: 0.04,
      overlap: 0.75,
      maxT: 10,
    };

    this.gamma_a = -70; // LKFS
    this.sampleRate = sampleRate;
    this.nSamplesPerInterval = this.loudnessprops.interval * this.sampleRate;
    this.nStepsize = (1.0 - this.loudnessprops.overlap) * this.nSamplesPerInterval;

    this.PreStageFilter = []; // array of filters (one for each channel) applied before loundness calculation
    this.channelWeight = []; // Gi
    this.bypass = false; // bypass PrestageFilters, testing purpose

    // Pre Stage Filter Coefficient for Direct2 Norm
    // parameters given in https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-4-201510-I%21%21PDF-E.pdf
    // gain, high shelving, high-pass
    let coef = [
      1.0,
      1.53512485958697,
      -2.69169618940638,
      1.19839281085285,
      -1.69065929318241,
      0.73248077421585,
      1.0,
      -2.0,
      1.0,
      -1.99004745483398,
      0.99007225036621,
    ];

    this.PreStageFilter = new BiquadFilter_DF2(coef);
  }

  printSomeInfo() {
    console.log(
      'Interval [s]:',
      this.loudnessprops.interval,
      '\nsamples / intervall',
      this.nSamplesPerInterval,
      '\noverlap [fraction]:',
      this.loudnessprops.overlap,
      '\nStepSize:',
      this.nStepsize,
      '\nmaxT [s]:',
      this.loudnessprops.maxT
    ); //, '\nmaxSamples:', this.maxSamples);
  }

  /**
   * clear memory of the prestage filters
   */
  reset() {
    while (this.blocked == true) {} // dangerous ...
    for (let idx = 0; idx > this.PreStageFilter.length; idx++) {
      this.PreStageFilter.resetMemories();
    }
  }

  /**
   *
   */
  calculateLoudness(inputBuffer) {
    let outputBuffer = Array.from(inputBuffer);

    if (!this.bypass) {
      this.PreStageFilter.process(inputBuffer, outputBuffer);
    } else {
    }

    // get array of meansquares from buffer of overlapping intervals
    let meanSquares = this.getBufferMeanSquares(outputBuffer, this.nSamplesPerInterval, this.nStepsize);
    //console.log(meanSquares);

    // first stage filter
    this.filterBlocks(meanSquares, this.gamma_a);

    // second stage filter
    let gamma_r = 0;
    let mean = 0;
    for (let idx = 0; idx < meanSquares.length; idx++) {
      mean += meanSquares[idx];
    }
    mean /= meanSquares.length;
    gamma_r += mean;

    gamma_r = -0.691 + 10.0 * Math.log10(gamma_r) - 10;

    this.filterBlocks(meanSquares, gamma_r);

    // gated loudness from filtered blocks
    let gatedLoudness = 0;

    mean = 0;
    for (let idx = 0; idx < meanSquares.length; idx++) {
      mean += meanSquares[idx];
    }
    mean /= meanSquares.length;

    gatedLoudness += mean;

    gatedLoudness = -0.691 + 10.0 * Math.log10(gatedLoudness);

    //console.log(this.id, '- gatedLoudness:', gatedLoudness);

    return gatedLoudness;
  }

  /**
   * calculate meansquares of overlapping intervals in given buffer
   */
  getBufferMeanSquares(buffer, nSamplesPerInterval, nStepsize) {
    let meanSquares = [];

    let length = buffer.length;
    let idx1 = 0;
    let idx2 = nSamplesPerInterval;
    while (idx2 <= length) {
      meanSquares.push(this.getMeanSquare(buffer, idx1, idx2));
      idx1 += nStepsize;
      idx2 += nStepsize;
    }

    return meanSquares;
  }

  /**
   * calculate meansquare of given buffer and range
   */
  getMeanSquare(buffer, idx1, idx2) {
    let meansquare = 0;
    let data = 0;

    for (let bufIdx = idx1; bufIdx < idx2; bufIdx++) {
      data = buffer[bufIdx];
      meansquare += data * data;
    }

    return meansquare / (idx2 - idx1);
  }

  /**
   * remove entries (block loudness) from from meansquares object
   */
  filterBlocks(meanSquares, value) {
    for (let idx = meanSquares.length - 1; idx >= 0; idx--) {
      let blockloudness = -0.691 + 10.0 * Math.log10(meanSquares[idx]);
      //remove from arrays
      if (blockloudness <= value) {
        meanSquares.splice(idx, 1);
      }
    }
  }
}
