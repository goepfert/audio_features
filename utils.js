function decibelsToLinear(decibels) {
  return Math.pow(10, 0.05 * decibels);
}

function linearToDecibels(linear) {
  // It's not possible to calculate decibels for a zero linear value since it would be -Inf.
  // -1000.0 dB represents a very tiny linear value in case we ever reach this case.
  if (!linear) return -1000;
  return 20 * Math.log10(linear);
}

// similar to p5 map function (https://p5js.org/reference/#/p5/map)
// map(value, start1, stop1, start2, stop2)
const map = (value, x1, y1, x2, y2) => ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;

function assert(condition, message) {
  if (!condition) {
    message = message || 'Assertion failed';
    if (typeof Error !== 'undefined') {
      throw new Error(message);
    }
    throw message; // Fallback
  }
}
