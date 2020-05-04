let a = [
  [1, 1],
  [1, 1],
  [1, 1],
  [1, 1],
];

let b = [
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
];

const ds = createDataset(2, 0.5);

ds.addImage(a, 'class1');
ds.addImage(b, 'class2');
