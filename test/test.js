let buffer2D = [];

const nRow = 5;
const nCol = 5;

for (let row = 0; row < nRow; row++) {
  let data = [];
  for (let col = 0; col < nCol; col++) {
    data.push(Math.random() * 1);
  }
  buffer2D.push(data);
}

console.table(buffer2D);
let cpy = Array.from(buffer2D);
utils.meanNormalize(cpy);
console.table(cpy);
utils.standardize(buffer2D);
console.table(buffer2D);
