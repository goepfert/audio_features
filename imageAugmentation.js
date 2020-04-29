/**
 * create a new image based on an 2d array
 * cutoff some fraction from left or right side and fill the other side with zeros
 */

'use strict';

function createImage(buffer, fraction) {
  const nRow = buffer.length;
  let nCol = buffer[0].length;
  let cutoff = nRow * fraction;
  cutoff = Math.round(Math.random() * Math.round(cutoff));

  let newImage = [];

  //left or right cutoff
  const lr = Math.random();
  if (lr < 0.5) {
    newImage = buffer.slice(0, nRow - cutoff);
    let zero = createZeroBuffer(cutoff, nCol);
    newImage = zero.concat(newImage);
  } else {
    newImage = buffer.slice(cutoff, nRow);
    let zero = createZeroBuffer(cutoff, nCol);
    newImage = newImage.concat(zero);
  }

  return newImage;

  function createZeroBuffer(nRows, nCols) {
    return Array.from(Array(nRows), () => Array.from(Array(nCols), () => 0));
  }
}
