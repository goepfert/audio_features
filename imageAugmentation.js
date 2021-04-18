/**
 * create a new image based on an 2d array
 *
 * TODO: if you want to do this right, you shall augment the timeseries and not the mel
 */

'use strict';

function createImageDataGenerator(opt) {
  let options;
  let def_options = {
    fill_mode: 'nearest',
  };

  if (opt !== undefined) {
    setOpt(opt);
  } else {
    // argument not passed or undefined
  }

  // https://stackoverflow.com/questions/171251/how-can-i-merge-properties-of-two-javascript-objects-dynamically
  function setOpt(opt) {
    options = { ...def_options, ...opt };
  }

  function getOpt() {
    return options;
  }

  /**
   * cutoff some fraction from left or right side and fill the other side with ...
   */
  function horizontalShift(buffer, fraction) {
    const nRow = buffer.length;
    let nCol = buffer[0].length;
    let cutoff = nRow * fraction;
    cutoff = Math.round(Math.random() * Math.round(cutoff));

    let newImage = [];
    let fillBuffer = [];

    //left or right cutoff
    const lr = Math.random();

    if (options.fill_mode == 'zero') {
      fillBuffer = createZeroBuffer(cutoff, nCol);
    } else if (options.fill_mode == 'nearest') {
      if (lr < 0.5) {
        fillBuffer = createNearestBuffer(cutoff, buffer[0]);
      } else {
        fillBuffer = createNearestBuffer(cutoff, buffer[nRow - 1]);
      }
    }

    if (lr < 0.5) {
      newImage = buffer.slice(0, nRow - cutoff);
      newImage = fillBuffer.concat(newImage);
    } else {
      newImage = buffer.slice(cutoff, nRow);
      newImage = newImage.concat(fillBuffer);
    }

    return newImage;

    function createNearestBuffer(nRows, slice) {
      let nearest = [];
      for (let idx = 0; idx < nRows; idx++) {
        nearest.push(Array.from(slice));
      }
      return nearest;
    }

    function createZeroBuffer(nRows, nCols) {
      return Array.from(Array(nRows), () => Array.from(Array(nCols), () => 0));
    }
  }

  return {
    horizontalShift: horizontalShift,
    getOpt: getOpt,
  };
}
