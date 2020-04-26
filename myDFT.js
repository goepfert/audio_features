/**
 * Real Discrete Fourier Transform
 * https://www.analog.com/en/education/education-library/scientist_engineers_guide.html
 * don't forget the 'this dot' ...
 */

class DFT {
  constructor(bufferSize) {
    // Length of time series buffer
    this.timeDomainSize = bufferSize;
    this.freqDomainSize = bufferSize / 2 + 1;

    // Amplitudes in rectangular notation in fequency domain
    this.real = new Float32Array(this.freqDomainSize);
    this.imag = new Float32Array(this.freqDomainSize);

    // Amplitudes in polar notation in fequency domain
    this.mag = new Float32Array(this.freqDomainSize);
    this.phase = new Float32Array(this.freqDomainSize);

    // Pre-calculate sin/cos arrays
    let N = this.freqDomainSize * this.timeDomainSize;
    this.cosTable = new Float32Array(N);
    this.sinTable = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      this.sinTable[i] = Math.sin((i * 2 * Math.PI) / this.timeDomainSize);
      this.cosTable[i] = Math.cos((i * 2 * Math.PI) / this.timeDomainSize);
    }
  }

  /**
   * rectangular notation to polar notation
   */
  polarTransform() {
    for (let k = 0; k < this.freqDomainSize; k++) {
      this.mag[k] = Math.sqrt(this.real[k] * this.real[k] + this.imag[k] * this.imag[k]);

      // avoid dividing by zero
      if (this.real[k] == 0) {
        this.real[k] = 1e-20;
      }

      // correct atan
      this.phase[k] = Math.atan(this.imag[k] / this.real[k]);
      if (this.imag[k] < 0 && this.real[k] < 0) {
        this.phase[k] -= Math.PI;
      }
      if (this.imag[k] > 0 && this.real[k] < 0) {
        this.phase[k] += Math.PI;
      }
    }
  }

  rectangularTransform() {
    for (let k = 0; k < this.freqDomainSize; k++) {
      this.real[k] = this.mag[k] * Math.cos(this.phase[k]);
      this.imag[k] = this.mag[k] * Math.sin(this.phase[k]);
    }
  }

  forward(buffer) {
    utils.assert(buffer.length == this.timeDomainSize);

    // correlate input signal with each basis function
    let rval = 0;
    let ival = 0;

    for (let k = 0; k < this.freqDomainSize; k++) {
      rval = 0.0;
      ival = 0.0;

      for (let i = 0; i < this.timeDomainSize; i++) {
        rval += this.cosTable[k * i] * buffer[i];
        ival += this.sinTable[k * i] * buffer[i];
      }

      this.real[k] = rval;
      this.imag[k] = ival;
    }

    this.polarTransform();
  }

  /**
   *
   */
  inverse(buffer) {
    utils.assert(buffer.length == this.timeDomainSize);

    this.rectangularTransform();

    let f;
    let cval = 0;
    let sval = 0;

    for (let i = 0; i < this.timeDomainSize; i++) {
      cval = 0;
      sval = 0;

      for (let k = 0; k < this.freqDomainSize; k++) {
        // special case for first and last k
        if (k == 0 || k == this.freqDomainSize - 1) {
          f = 1;
        } else {
          f = 2;
        }

        cval += (this.real[k] / (this.timeDomainSize / f)) * this.cosTable[k * i];
        sval += ((-1 * this.imag[k]) / (this.timeDomainSize / f)) * this.sinTable[k * i];
      }

      buffer[i] = cval + sval;
    }

    console.log('buffer');
  }

  print() {
    console.log('time domain length', this.timeDomainSize);
    console.log('freq domain length', this.freqDomainSize);
    console.log('real', this.real);
    console.log('imag', this.imag);
    console.log('mag', this.mag);
    console.log('phase', this.phase);
  }
}
