/**
 * Collection of some usefull functions
 */

const utils = (function () {
  const _grayscale = [];
  const _rainbow = [];

  for (let idx = 0; idx < 256; idx++) {
    _grayscale[idx] = `rgb(${idx}, ${idx}, ${idx})`;
    _rainbow[idx] = `hsl(${idx},100%,50%)`;
  }

  function map(value, x1, y1, x2, y2) {
    return ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
  }

  function constrain(value, min, max) {
    value = value < min ? min : value;
    value = value > max ? max : value;
    return value;
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

  function rangeMap(val, min_exp, max_exp, map_x1, map_x2) {
    val = constrain(val, min_exp, max_exp);
    val = map(val, min_exp, max_exp, map_x1, map_x2);

    return val;
  }

  function logRangeMap(val, min_exp, max_exp, map_x1, map_x2) {
    val = Math.log10(val);
    val = rangeMap(val, min_exp, max_exp, map_x1, map_x2);

    return val;
  }

  function rangeMapBuffer(buffer, min_exp, max_exp, map_x1, map_x2) {
    let ret = [];

    for (let idx = 0; idx < buffer.length; idx++) {
      ret.push(rangeMap(buffer[idx], min_exp, max_exp, map_x1, map_x2));
    }

    return ret;
  }

  function logRangeMapBuffer(buffer, min_exp, max_exp, map_x1, map_x2) {
    let ret = [];

    for (let idx = 0; idx < buffer.length; idx++) {
      ret.push(logRangeMap(buffer[idx], min_exp, max_exp, map_x1, map_x2));
    }

    return ret;
  }

  function indexOfMax(arr) {
    if (arr.length === 0) {
      return -1;
    }

    var max = arr[0];
    var maxIndex = 0;

    for (var i = 1; i < arr.length; i++) {
      if (arr[i] > max) {
        maxIndex = i;
        max = arr[i];
      }
    }

    return maxIndex;
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

  function getNumberOfFrames(total_size, frame_size, frame_stride) {
    let number = 0;
    // for (let idx = 0; idx < total_size; idx += frame_stride) {
    //   if (idx + frame_size > total_size) {
    //     number = idx;
    //     break;
    //   }
    // }

    // or
    number = 1 + Math.floor((total_size - frame_size) / frame_stride);

    return number;
  }

  return {
    grayscale: _grayscale,
    rainbow: _rainbow,
    map: map,
    constrain: constrain,
    assert: assert,
    rangeMap: rangeMap,
    logRangeMap: logRangeMap,
    rangeMapBuffer: rangeMapBuffer,
    logRangeMapBuffer: logRangeMapBuffer,
    indexOfMax: indexOfMax,
    decibelsToLinear: decibelsToLinear,
    linearToDecibels: linearToDecibels,
    getNumberOfFrames: getNumberOfFrames,
  };
})();
