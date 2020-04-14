function createHamming(length) {
  const _LENGTH = length;
  const _WEIGHTS = [];

  (function init() {
    for (let idx = 0; idx < _LENGTH; idx++) {
      _WEIGHTS[idx] = 0.54 - 0.45 * Math.cos((2 * Math.PI * idx) / (_LENGTH - 1));
    }
  })();

  function windowing(buffer) {
    utils.assert(_LENGTH == buffer.length, 'window sizes do not match');

    for (let idx = 0; idx < _LENGTH; idx++) {
      buffer[idx] = buffer[idx] * _WEIGHTS[idx];
    }
  }

  return {
    w: _WEIGHTS,
    windowing: windowing,
  };
}
