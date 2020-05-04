let b = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
];

//console.table(b);
//console.table(createImage(b, 0.5));


const ds = createDataset(2, 0);

ds.addImage(b, 'class1');
ds.addImage(b, 'class2');

