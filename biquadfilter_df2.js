/**
 * Thomas Goepfert
 * Direct Form 2 Biquad Filter
 * Inspired by https://github.com/Ircam-RnD/biquad-filter
 */

'use strict';

class BiquadFilter_DF2 {
  constructor(coef) {
    this.numberOfCascade = undefined;
    this.coefficients = [];
    this.memories = [];

    if (coef !== undefined) {
      this.setCoefficients(coef);
    }
  }

  /**
   * Set biquad filter coefficients
   * coef Array of biquad coefficients in the following order: gain, firstBiquad b0, firstBiquad b1, firstBiquad b2, firstBiquad a1, firstBiquad a2, secondBiquad b0, secondBIquad b1, etc.
   */
  setCoefficients(coef) {
    if (coef) {
      // If there is not a number of biquads, we consider that there is only 1 biquad.
      this.numberOfCascade = this.getNumberOfCascadeFilters(coef);
      // Reset coefficients
      this.coefficients = [];
      // Global gain
      this.coefficients.gain = coef[0];

      for (let i = 0; i < this.numberOfCascade; i++) {
        // Five coefficients for each biquad
        this.coefficients[i] = {
          b0: coef[1 + i * 5],
          b1: coef[2 + i * 5],
          b2: coef[3 + i * 5],
          a1: coef[4 + i * 5],
          a2: coef[5 + i * 5],
        };
      }

      // Need to reset the memories after change the coefficients
      this.resetMemories();
      return true;
    } else {
      throw new Error('No coefficients are set');
    }
  }

  /**
   * Get the number of cascade filters from the list of coefficients
   */
  getNumberOfCascadeFilters(coef) {
    return (coef.length - 1) / 5;
  }

  /**
   * Reset memories of biquad filters.
   */
  resetMemories() {
    for (let i = 0; i < this.numberOfCascade; i++) {
      this.memories[i] = {
        wi1: 0.0,
        wi2: 0.0,
      };
    }
  }

  /**
   * Calculate the output of the cascade of biquad filters for an inputBuffer.
   * inputBuffer: array of the same length of outputBuffer
   * outputBuffer: array of the same length of inputBuffer
   */
  process(inputBuffer, outputBuffer) {
    let x;
    let y = [];
    let b0, b1, b2, a1, a2;
    let w, wi1, wi2;

    for (let bufIdx = 0; bufIdx < inputBuffer.length; bufIdx++) {
      x = inputBuffer[bufIdx];

      // Save coefficients in local variables
      b0 = this.coefficients[0].b0;
      b1 = this.coefficients[0].b1;
      b2 = this.coefficients[0].b2;
      a1 = this.coefficients[0].a1;
      a2 = this.coefficients[0].a2;

      // Save memories in local variables
      wi1 = this.memories[0].wi1;
      wi2 = this.memories[0].wi2;

      // Formula: y[n] = b0*w[n] + b1*w[n-1] + b2*w[n-2]
      // with w[n] = x[n] - a1*w[n-1] - a2*w[n-2]
      // First biquad
      w = x - a1 * wi1 - a2 * wi2;
      y[0] = b0 * w + b1 * wi1 + b2 * wi2;

      this.memories[0].wi2 = this.memories[0].wi1;
      this.memories[0].wi1 = w;

      //Other Biquads in Cascade
      for (let cascadeIdx = 1; cascadeIdx < this.numberOfCascade; cascadeIdx++) {
        b0 = this.coefficients[cascadeIdx].b0;
        b1 = this.coefficients[cascadeIdx].b1;
        b2 = this.coefficients[cascadeIdx].b2;
        a1 = this.coefficients[cascadeIdx].a1;
        a2 = this.coefficients[cascadeIdx].a2;

        wi1 = this.memories[cascadeIdx].wi1;
        wi2 = this.memories[cascadeIdx].wi2;

        w = y[cascadeIdx - 1] - a1 * wi1 - a2 * wi2;
        y[cascadeIdx] = b0 * w + b1 * wi1 + b2 * wi2;

        this.memories[cascadeIdx].wi2 = this.memories[cascadeIdx].wi1;
        this.memories[cascadeIdx].wi1 = w;
      }

      // Write the output
      outputBuffer[bufIdx] = this.coefficients.gain * y[this.numberOfCascade - 1];
    } // next buffer element
  } // end process
}
