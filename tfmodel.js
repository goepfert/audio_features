/**
 * Model CNN
 * TODO: scale image [-1,1] -> done
 */

function createNetwork(width, height, nClasses) {
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
        kernelSize: [4, 2],
        filters: 8,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));
    model.add(
      tf.layers.conv2d({
        kernelSize: [4, 2],
        filters: 16,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));
    model.add(
      tf.layers.conv2d({
        kernelSize: [4, 2],
        filters: 16,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling',
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));
    // model.add(
    //   tf.layers.conv2d({
    //     kernelSize: [4, 2],
    //     filters: 32,
    //     strides: 1,
    //     activation: 'relu',
    //     kernelInitializer: 'varianceScaling',
    //   })
    // );
    // model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: 0.25 }));
    model.add(
      tf.layers.dense({
        units: 1000,
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

    const optimizer = tf.train.adam();
    model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  async function train(xs, ys, model) {
    // mhh: Which batch size shall I choose?
    // https://machinelearningmastery.com/gentle-introduction-mini-batch-gradient-descent-configure-batch-size/
    const BATCH_SIZE = 8;
    const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
    const container = {
      name: 'Model Training',
      styles: { height: '1000px' },
    };
    const fitCallbacks = tfvis.show.fitCallbacks(container, metrics);

    return model.fit(xs, ys, {
      batchSize: BATCH_SIZE,
      epochs: 40,
      shuffle: true,
      validationSplit: 0.2,
      callbacks: fitCallbacks,
    });
  }

  return {
    getModel: getModel,
    train: train,
  };
}
