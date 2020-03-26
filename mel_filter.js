/**
 * http://practicalcryptography.com/miscellaneous/machine-learning/guide-mel-frequency-cepstral-coefficients-mfccs/
 */

let mel_filter = function() {
  let _samplerate;
  let _nfft;
  let _lowFreq;
  let _highFreq;
  let _nMel;

  let _lowMel;
  let _highMel;
  let _dMel;

  let _m = []; // mel filter points (equally spaced in mel space)
  let _h = []; // filter points in frequency domain
  let _f = []; // map _h to nearest FT bin
  let _Hm = []; // 2d array [index frequency domain][mel filter id] -> mel filter id [0, ..., _nMel-1]

  function init(samplerate, nfft, lowFreq, highFreq, nMel) {
    _samplerate = samplerate;
    _nfft = nfft; // buffer size of time domain signal
    _lowFreq = lowFreq; // low cutoff
    _highFreq = highFreq; // high cutoff
    _nMel = nMel; // number of filter banks

    _lowMel = fToMel(_lowFreq);
    _highMel = fToMel(_highFreq);
    _dMel = (_highMel - _lowMel) / (_nMel + 1);

    calculate_Mi();
    calculate_Fi();
    convertToFrequencyBins();
    createFilterbanks();
  }

  function calculate_Mi() {
    _m.push(_lowMel);
    for (let i = 0; i < _nMel; i++) {
      _m.push(_m[i] + _dMel);
    }
    _m.push(_highMel);
  }

  function calculate_Fi() {
    _h = _m.map(m => melToF(m));
  }

  function convertToFrequencyBins() {
    _f = _h.map(m => Math.floor(((_nfft + 1) * m) / _samplerate));
  }

  function createFilterbanks() {
    for (let m = 1; m <= _nMel; m++) {
      let H = [];
      for (let k = 0; k < _nfft / 2 + 1; k++) {
        let h = 0;
        if (k < _f[m - 1]) {
          h = 0;
        } else if (_f[m - 1] <= k && k < _f[m]) {
          h = (k - _f[m - 1]) / (_f[m] - _f[m - 1]);
        } else if (k == _f[m]) {
          h = 1;
        } else if (_f[m] < k && k <= _f[m + 1]) {
          h = (_f[m + 1] - k) / (_f[m + 1] - _f[m]);
        } else {
          h = 0;
        }
        H.push(h);
      }
      _Hm.push(H);
    }
  }

  function getFilterBank(m) {
    return _Hm[m];
  }

  function fToMel(f) {
    return 2595 * Math.log10(1 + f / 700);
  }

  function melToF(m) {
    return 700 * (Math.pow(10, m / 2595) - 1);
  }

  function getMelCoefficient(mIdx, buffer) {
    assert(_Hm[mIdx].length == buffer.length);

    let coeff = 0;
    for (let idx = 0; idx < buffer.length; idx++) {
      coeff += _Hm[mIdx][idx] * buffer[idx];
    }
    return coeff;
  }

  function getLogMelCoefficients(buffer, min, max) {
    let melArray = [];
    for (let mIdx = 0; mIdx < _nMel; mIdx++) {
      let m = Math.log10(getMelCoefficient(mIdx, buffer));
      m = m < min ? min : m;
      m = m > max ? max : m;
      m = map(m, min, max, 255, 0);
      melArray.push(Math.round(m));
    }

    return melArray;
  }

  function getMelCoefficients(buffer) {
    let melArray = [];
    for (let mIdx = 0; mIdx < _nMel; mIdx++) {
      melArray.push(getMelCoefficient(mIdx, buffer));
    }

    return melArray;
  }

  function setSamplerate(samplerate) {
    _samplerate = samplerate;
  }

  function print() {
    console.log(_m);
    console.log(_h);
    console.log(_f);
    console.log(_Hm);
  }

  return {
    init: init,
    print: print,
    getFilterBank: getFilterBank,
    getLogMelCoefficients: getLogMelCoefficients,
    getMelCoefficients: getMelCoefficients,
    setSamplerate: setSamplerate
  };
};
