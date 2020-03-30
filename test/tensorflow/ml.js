/**
 * dummy cnn
 */

const SIZEX = 100; // nFrames
const SIZEY = 100; // nMelfilter
const NDATA = 100;
const BATCH_SIZE = 10;

// create some dummy data values
let inputs = [
  {
    label: 'class1',
    data: []
  },
  {
    label: 'class2',
    data: []
  },
  {
    label: 'class3',
    data: []
  }
];

let ys = [];
let image = [];

// Class1
for (let dataIdx = 0; dataIdx < NDATA; dataIdx++) {
  image = [];
  for (let idx = 0; idx < SIZEX; idx++) {
    ys = Array.from(Array(SIZEY), () => Math.floor(Math.random() * 33));
    image.push(ys);
  }
  inputs[0].data.push(image);
}

// Class2
for (let dataIdx = 0; dataIdx < NDATA; dataIdx++) {
  image = [];
  for (let idx = 0; idx < SIZEX; idx++) {
    ys = Array.from(Array(SIZEY), () => Math.floor(Math.random() * 33 + 33));
    image.push(ys);
  }
  inputs[1].data.push(image);
}

// Class3
for (let dataIdx = 0; dataIdx < NDATA; dataIdx++) {
  image = [];
  for (let idx = 0; idx < SIZEX; idx++) {
    ys = Array.from(Array(SIZEY), () => Math.floor(Math.random() * 33 + 66));
    image.push(ys);
  }
  inputs[2].data.push(image);
}

/**
 * convert data to tensors
 */
function createData() {
  let _labelList = [];
  let _xData = [];
  let _yData = [];

  function createLabelList() {
    let nLabels = inputs.length;
    for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
      _labelList.push(inputs[dataIdx].label);
    }
  }

  (function convertData() {
    console.log('constructor');

    createLabelList();

    let nLabels = inputs.length;
    _xData = [];
    _yData = [];
    for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
      for (let idx = 0; idx < inputs[dataIdx].data.length; idx++) {
        _xData.push(inputs[dataIdx].data[idx]);
        _yData.push(_labelList.indexOf(inputs[dataIdx].label));
      }
    }
  })();

  function getXs() {
    let xs = tf.tensor3d(_xData);
    //xs.reshape([TRAIN_DATA_SIZE, 28, 28, 1] ???
    return xs;
  }

  function getYs() {
    let labelstensor = tf.tensor1d(_yData, 'int32');
    let ys = tf.oneHot(labelstensor, 3);
    labelstensor.dispose();
    return ys;
  }

  return {
    xs: getXs,
    ys: getYs
  };
}

/**
 * https://codelabs.developers.google.com/codelabs/tfjs-training-classfication/index.html#4
 * https://www.youtube.com/watch?v=-1QGEQWhmSI&list=WL&index=7&t=0s
 * maybe more conv2d + maxpooling
 */
function createModel() {
  const model = tf.sequential();

  const IMAGE_WIDTH = SIZEX;
  const IMAGE_HEIGHT = SIZEY;
  const IMAGE_CHANNELS = 1;

  // In the first layer of our convolutional neural network we have
  // to specify the input shape. Then we specify some parameters for
  // the convolution operation that takes place in this layer.
  model.add(
    tf.layers.conv2d({
      inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
      dataFormat: 'channelsLast',
      kernelSize: 5,
      filters: 8,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling'
    })
  );

  // The MaxPooling layer acts as a sort of downsampling using max values
  // in a region instead of averaging.
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

  // Repeat another conv2d + maxPooling stack.
  // Note that we have more filters in the convolution.
  model.add(
    tf.layers.conv2d({
      kernelSize: 5,
      filters: 16,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling'
    })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

  // Now we flatten the output from the 2D filters into a 1D vector to prepare
  // it for input into our last layer. This is common practice when feeding
  // higher dimensional data to a final classification output layer.
  model.add(tf.layers.flatten());

  //model.add(tf.layers.dropout({rate: 0.25}));

  // Our last layer is a dense layer which has 10 output units, one for each
  // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
  const NUM_OUTPUT_CLASSES = inputs.length;
  model.add(
    tf.layers.dense({
      units: NUM_OUTPUT_CLASSES,
      kernelInitializer: 'varianceScaling',
      activation: 'softmax'
    })
  );

  // Choose an optimizer, loss function and accuracy metric,
  // then compile and return the model
  const optimizer = tf.train.adam();
  model.compile({
    optimizer: optimizer,
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

async function train(model, data) {
  const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
  const container = {
    name: 'Model Training',
    styles: { height: '1000px' }
  };
  const fitCallbacks = tfvis.show.fitCallbacks(container, metrics);

  return model.fit(data.xs(), data.ys(), {
    batchSize: BATCH_SIZE,
    epochs: 10,
    shuffle: true,
    callbacks: fitCallbacks
  });
}

// Create the model
const model = createModel();
tfvis.show.modelSummary({ name: 'Model Summary' }, model);

//const data = createData();
//train(model, data);
