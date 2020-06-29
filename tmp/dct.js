/**
 * https://www.nayuki.io/page/fast-discrete-cosine-transform-algorithms
 */

const fastDctLee = (function () {
  // DCT type II, unscaled. Algorithm by Byeong Gi Lee, 1984.
  // See: http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.118.3056&rep=rep1&type=pdf#page=34
  function transform(vector) {
    var n = vector.length;
    if (n <= 0 || (n & (n - 1)) != 0) throw 'Length must be power of 2';
    transformInternal(vector, 0, n, new Float64Array(n));
  }

  function transformInternal(vector, off, len, temp) {
    if (len == 1) return;
    var halfLen = Math.floor(len / 2);
    for (var i = 0; i < halfLen; i++) {
      var x = vector[off + i];
      var y = vector[off + len - 1 - i];
      temp[off + i] = x + y;
      temp[off + i + halfLen] = (x - y) / (Math.cos(((i + 0.5) * Math.PI) / len) * 2);
    }
    transformInternal(temp, off, halfLen, vector);
    transformInternal(temp, off + halfLen, halfLen, vector);
    for (var i = 0; i < halfLen - 1; i++) {
      vector[off + i * 2 + 0] = temp[off + i];
      vector[off + i * 2 + 1] = temp[off + i + halfLen] + temp[off + i + halfLen + 1];
    }
    vector[off + len - 2] = temp[off + halfLen - 1];
    vector[off + len - 1] = temp[off + len - 1];
  }

  // DCT type III, unscaled. Algorithm by Byeong Gi Lee, 1984.
  // See: https://www.nayuki.io/res/fast-discrete-cosine-transform-algorithms/lee-new-algo-discrete-cosine-transform.pdf
  function inverseTransform(vector) {
    var n = vector.length;
    if (n <= 0 || (n & (n - 1)) != 0) throw 'Length must be power of 2';
    vector[0] /= 2;
    inverseTransformInternal(vector, 0, n, new Float64Array(n));
  }

  function inverseTransformInternal(vector, off, len, temp) {
    if (len == 1) return;
    var halfLen = Math.floor(len / 2);
    temp[off + 0] = vector[off + 0];
    temp[off + halfLen] = vector[off + 1];
    for (var i = 1; i < halfLen; i++) {
      temp[off + i] = vector[off + i * 2];
      temp[off + i + halfLen] = vector[off + i * 2 - 1] + vector[off + i * 2 + 1];
    }
    inverseTransformInternal(temp, off, halfLen, vector);
    inverseTransformInternal(temp, off + halfLen, halfLen, vector);
    for (var i = 0; i < halfLen; i++) {
      var x = temp[off + i];
      var y = temp[off + i + halfLen] / (Math.cos(((i + 0.5) * Math.PI) / len) * 2);
      vector[off + i] = x + y;
      vector[off + len - 1 - i] = x - y;
    }
  }

  return {
    transform: transform,
    inverseTransform: inverseTransform,
  };
})();
