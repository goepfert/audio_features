/**
 *
 */

'use strict';

function createDataset(num_classes, img_width, img_height, fraction_validation) {
  let _num_classes = num_classes;
  let _fraction_validation = fraction_validation;
  let _inputs = [];
  let _img_width = img_width;
  let _img_height = img_height;

  (function init() {
    for (let idx = 0; idx < _num_classes; idx++) {
      _inputs.push({
        label: `class${idx + 1}`, // class label
        data: [], // the unscaled image
      });
    }
  })();

  // add image with label to the record
  function addImage(image_buffer, label) {
    let index = _inputs.findIndex((input) => input.label == label);

    utils.assert(index != -1, 'cannot find label');

    let img_width = image_buffer.length;
    if (_img_width != undefined) {
      utils.assert(img_width == _img_width, 'image size mismatch: width');
    } else {
      _img_width = img_width;
    }

    let img_height = image_buffer[0].length;
    if (_img_height != undefined) {
      utils.assert(img_height == _img_height, 'image size mismatch: height');
    } else {
      _img_height = img_height;
    }

    //console.log(index);
    _inputs[index].data.push(image_buffer);
  }

  // shuffles to objects and preserve their relation
  function shuffle(obj1, obj2) {
    let index = obj1.length;
    let rnd, tmp1, tmp2;

    while (index) {
      rnd = Math.floor(Math.random() * index);
      index -= 1;
      tmp1 = obj1[index];
      tmp2 = obj2[index];
      obj1[index] = obj1[rnd];
      obj2[index] = obj2[rnd];
      obj1[rnd] = tmp1;
      obj2[rnd] = tmp2;
    }
  }

  function createLabelList() {
    let labelList = [];
    let nLabels = _inputs.length;
    for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
      labelList.push(_inputs[dataIdx].label);
    }
    return labelList;
  }

  function getData() {
    let nLabels = _inputs.length;
    const labelList = createLabelList();
    let xData = [];
    let yData = [];
    for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
      for (let idx = 0; idx < _inputs[dataIdx].data.length; idx++) {
        xData.push(_inputs[dataIdx].data[idx]);
        yData.push(labelList.indexOf(_inputs[dataIdx].label));
      }
    }

    shuffle(xData, yData);

    // split
    const length = xData.length;
    const split = Math.round((1 - _fraction_validation) * length);
    utils.assert(split != 0, 'dataset too small for splitting');
    utils.assert(split != length, 'dataset too small for splitting');
    //console.log(split);

    let xData_validation = xData.slice(split, length);
    let yData_validation = yData.slice(split, length);
    xData = xData.splice(0, split);
    yData = yData.splice(0, split);

    let xs = tf.tensor3d(xData);
    xs = xs.reshape([xData.length, _img_width, _img_height, 1]);
    let labelstensor = tf.tensor1d(yData, 'int32');
    let ys = tf.oneHot(labelstensor, _inputs.length);
    labelstensor.dispose();

    let xs_validation = tf.tensor3d(xData_validation);
    xs_validation = xs_validation.reshape([xData_validation.length, _img_width, _img_height, 1]);
    labelstensor = tf.tensor1d(yData_validation, 'int32');
    let ys_validation = tf.oneHot(labelstensor, _inputs.length);
    labelstensor.dispose();

    return {
      x: xs,
      y: ys,
      x_validation: xs_validation,
      y_validation: ys_validation,
    };
  }

  function getNumImages(label) {
    let index = _inputs.findIndex((input) => input.label == label);
    utils.assert(index != -1, 'cannot find label');
    return _inputs[index].data.length;
  }

  function getInputs() {
    return _inputs;
  }

  function clearInputs() {
    _inputs = [];
    console.log('clearing inputs');
  }

  function setInputs(inputs) {
    console.log('setting new inputs');
    _inputs = inputs;
    printInfo(_inputs);
  }

  function printInfo() {
    console.log('number of classes:', _inputs.length);
    for (let idx = 0; idx < _inputs.length; idx++) {
      console.log('class idx', idx, ', class label', _inputs[idx].label);
      console.log('number of images in class label', _inputs[idx].data.length);
    }
  }

  return {
    addImage: addImage,
    getData: getData,
    getNumImages: getNumImages,
    getInputs: getInputs,
    clearInputs: clearInputs,
    setInputs: setInputs,
  };
}
