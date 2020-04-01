/**
 * Collection of some usefull functions
 */

const utils = (function() {
  const _grayscale = [];
  const _rainbow = [];

  for (let idx = 0; idx < 256; idx++) {
    _grayscale[idx] = `rgb(${idx}, ${idx}, ${idx})`;
    _rainbow[idx] = `hsl(${idx},100%,50%)`;
  }

  function map(value, x1, y1, x2, y2) {
    return ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
  }

  function assert(condition, message) {
    if (!condition) {
      message = message || 'Assertion failed';
      if (typeof Error !== 'undefined') {
        throw new Error(message);
      }
      throw message; // Fallback
    }
  }

  function logRangeMap(val, min_lin, max_lin, min_exp, max_exp, map_x1, map_x2) {
    // val = val < min_lin ? min_lin : val;
    // val = val > max_lin ? max_lin : val;
    val = Math.log10(val);
    // val = val < min_exp ? min_exp : val;
    // val = val > max_exp ? max_exp : val;
    val += min_exp;
    val = map(val, 0, min_exp + max_exp, map_x1, map_x2);

    return val;
  }

  function decibelsToLinear(decibels) {
    return Math.pow(10, 0.05 * decibels);
  }

  function linearToDecibels(linear) {
    // It's not possible to calculate decibels for a zero linear value since it would be -Inf.
    // -1000.0 dB represents a very tiny linear value in case we ever reach this case.
    if (!linear) return -1000;
    return 20 * Math.log10(linear);
  }

  return {
    grayscale: _grayscale,
    rainbow: _rainbow,
    map: map,
    assert: assert,
    logRangeMap: logRangeMap,
    decibelsToLinear: decibelsToLinear,
    linearToDecibels: linearToDecibels
  };
})();
