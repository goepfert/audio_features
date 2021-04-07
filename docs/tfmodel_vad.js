/**
 * CNN Model for Voice Activity Detection
 */

'use strict';

function createNetwork_VAD(width, height, nClasses) {
  const IMAGE_WIDTH = width;
  const IMAGE_HEIGHT = height;
  const NUM_OUTPUT_CLASSES = nClasses;

  /**
   * create the cnn
   */
  function getModel() {
    const model = tf.sequential();
    const IMAGE_CHANNELS = 1; // default

    model.add(
      tf.layers.conv2d({
        inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
        dataFormat: 'channelsLast',
        kernelSize: [5, 5],
        padding: 'same', // TODO: check influence
        filters: 8,
        strides: 2,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
    );
    model.add(
      tf.layers.conv2d({
        kernelSize: [5, 5],
        padding: 'same', // TODO: check influence
        filters: 16,
        strides: 2,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
    );
    model.add(
      tf.layers.conv2d({
        kernelSize: [5, 5],
        padding: 'same', // TODO: check influence
        filters: 32,
        strides: 2,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
    );
    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: 0.5 }));
    model.add(
      tf.layers.dense({
        units: 200,
        activation: 'relu',
      })
    );
    model.add(tf.layers.dropout({ rate: 0.25 }));
    model.add(
      tf.layers.dense({
        units: NUM_OUTPUT_CLASSES,
        kernelInitializer: 'varianceScaling',
        activation: 'softmax',
      })
    );

    compile_model(model);

    return model;
  }

  function compile_model(model) {
    const optimizer = tf.train.adam(3e-4);
    model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
  }

  function freezeModelforTransferLearning(model) {
    console.log('Freezing feature layers of the model.');
    for (let i = 0; i < 5; ++i) {
      model.layers[i].trainable = false;
    }

    compile_model(model);
  }

  async function train(xs, ys, model) {
    // mhh: Which batch size shall I choose?
    // https://machinelearningmastery.com/gentle-introduction-mini-batch-gradient-descent-configure-batch-size/
    const BATCH_SIZE = 32;
    const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
    const container = {
      name: 'Model Training VAD',
      styles: { height: '1000px' },
    };
    //const fitCallbacks = tfvis.show.fitCallbacks(container, metrics);
    const onEpochEnd = tfvis.show.fitCallbacks(container, metrics);

    return model.fit(xs, ys, {
      batchSize: BATCH_SIZE,
      epochs: 20,
      shuffle: true,
      //validationSplit: 0.2,
      callbacks: onEpochEnd,
    });
  }

  return {
    getModel: getModel,
    train: train,
    freezeModelforTransferLearning: freezeModelforTransferLearning,
    compile_model: compile_model,
  };
}
