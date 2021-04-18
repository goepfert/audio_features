let b = [
  [0.1, 10],
  [100, 1000],
  [5, 6],
  [7, 8],
];

// let b = [
//   [-1, 1000],
//   [10, 100],
// ];

console.log(utils.deepCopy2D(b));

utils.powerToDecibels2D(b);

console.log(utils.deepCopy2D(b));

utils.meanNormalize(b);

console.log(utils.deepCopy2D(b));
