let a = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
];

console.table(a);

const generator = createImageDataGenerator({ fill_mode: 'nearest' });

let b = generator.horizontalShift(a, 0.5);

console.table(b);
