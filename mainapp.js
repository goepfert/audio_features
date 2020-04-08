// It all starts with a context
const context = new AudioContext();

// How many classes to classify (normally, the first class refers to the background)
const NCLASSES = 3;

// FT Stuff
const BUFFERSIZE = 256; // 48 kHz sampling rate, 1024 samples => 21.3 ms
const B2P1 = BUFFERSIZE / 2 + 1;
const dft = new DFT(BUFFERSIZE);
let timeDomainData = [];

const FRAMESIZE = 220; // How many frames of size BUFFERSIZE
const nMelFilter = 26; // Number of Mel Filterbanks
let TIME_SERIES = [];
let DFT_Series = []; // ringbuffer
let DFT_Series_mel = []; // ringbuffer
let SERIES_POS = FRAMESIZE - 1; // head of ringbuffer
let STARTFRAME; // Recording
let ENDFRAME; // Recording

const filter = mel_filter();
const samplerate = context.sampleRate;
filter.init(samplerate, BUFFERSIZE, 300, 4000, nMelFilter);

// Prefill arrays
for (let idx = 0; idx < FRAMESIZE; idx++) {
  let time_array = Array.from(Array(BUFFERSIZE), () => 0);
  TIME_SERIES.push(time_array);

  let ft_array = Array.from(Array(B2P1), () => 0);
  DFT_Series.push(ft_array);

  let mel_array = Array.from(Array(nMelFilter), () => 0);
  DFT_Series_mel.push(mel_array);
}

// Canvas width and height
const w = 4 * FRAMESIZE;
const h = 4 * nMelFilter;

const canvas = document.getElementById('oscilloscope');
canvas.width = w;
canvas.height = B2P1;
const canvasCtx = canvas.getContext('2d');

const canvas_fftSeries = document.getElementById('fft-series');
const context_fftSeries = canvas_fftSeries.getContext('2d');
canvas_fftSeries.width = w;
canvas_fftSeries.height = B2P1;

const canvas_fftSeries_mel = document.getElementById('fft-series mel');
const context_fftSeries_mel = canvas_fftSeries_mel.getContext('2d');
canvas_fftSeries_mel.width = w;
canvas_fftSeries_mel.height = h;

// Loudness
const loudnessSample = new LoudnessSample(samplerate);
const targetLKFS = -13;

/**
 * Handle mic data
 */
const handleSuccess = function (stream) {
  console.log('handle success');
  const source = context.createMediaStreamSource(stream);

  // Create a ScriptProcessorNode
  const processor = context.createScriptProcessor(BUFFERSIZE, 1, 1);
  source.connect(processor);
  processor.connect(context.destination);

  processor.onaudioprocess = function (e) {
    const inputBuffer = e.inputBuffer;
    timeDomainData = inputBuffer.getChannelData(0);

    // Shift head of ringbuffer
    SERIES_POS++;
    if (SERIES_POS > FRAMESIZE - 1) {
      SERIES_POS = 0;
    }

    //what about doing some loudness normalization before?
    TIME_SERIES[SERIES_POS] = Array.from(timeDomainData);

    // Do the Fourier Transformation
    dft.forward(timeDomainData);

    // Mapping for log scale
    const min_exp = 0; // 10^{min_exp} linear
    const max_exp = 2; // 10^{max_exp} linear
    let mag = 0;
    utils.assert(B2P1 == dft.mag.length);
    for (let idx = 0; idx < B2P1; idx++) {
      mag = dft.mag[idx];
      mag = utils.logRangeMap(mag, min_exp, max_exp, 255, 0);
      mag = Math.round(mag);
      DFT_Series[SERIES_POS][idx] = mag;
    }

    // Copy array of mel coefficients
    DFT_Series_mel[SERIES_POS] = Array.from(filter.getLogMelCoefficients(dft.mag, min_exp, max_exp));

    // Clear frames
    if (STARTFRAME == SERIES_POS) {
      STARTFRAME = undefined;
    }
    if (ENDFRAME == SERIES_POS) {
      ENDFRAME = undefined;
    }
  };
};

/** Kicks off Mic data handle function
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then(handleSuccess)
  .catch((err) => console.log(err));

/**
 * Recursive draw function
 * Called as fast as possible by the browser (as far as I understood)
 */
const draw = function () {
  canvasCtx.fillStyle = '#FFF';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw magnitudes
  let barWidth = canvas.width / B2P1;
  let barHeight;
  let mag = 0;
  let x = 0;
  for (let i = 0; i < B2P1; i++) {
    mag = DFT_Series[SERIES_POS][i];
    barHeight = -canvas.height + utils.map(mag, 0, 255, 0, canvas.height);
    canvasCtx.fillStyle = utils.rainbow[mag];
    canvasCtx.fillRect(x, canvas.height, barWidth, barHeight);
    x += barWidth;
  }
  canvasCtx.strokeRect(0, 0, canvas.width, canvas.height);

  // Draw time series on top
  canvasCtx.beginPath();
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#000099';
  let sliceWidth = canvas.width / BUFFERSIZE;
  x = 0;
  for (let i = 0; i < BUFFERSIZE; i++) {
    let v = timeDomainData[i] + 1;
    let y = (v * canvas.height) / 2;
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  //canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();

  // Draw FT Time Series
  context_fftSeries.fillStyle = '#FFF';
  context_fftSeries.fillRect(0, 0, canvas_fftSeries.width, canvas_fftSeries.height);

  let rectHeight = canvas_fftSeries.height / B2P1;
  let rectWidth = canvas_fftSeries.width / FRAMESIZE;
  let xpos = 0;
  let ypos;
  for (let xidx = SERIES_POS + 1; xidx <= SERIES_POS + FRAMESIZE; xidx++) {
    ypos = canvas_fftSeries.height;
    for (let yidx = 0; yidx < B2P1; yidx++) {
      mag = DFT_Series[xidx % FRAMESIZE][yidx];
      if (mag != 0) {
        context_fftSeries.fillStyle = utils.rainbow[mag];
        context_fftSeries.fillRect(xpos, ypos, rectWidth, -rectHeight);
      } else {
        //
      }
      ypos -= rectHeight;
    }
    xpos += rectWidth;
  }
  context_fftSeries.strokeRect(0, 0, canvas_fftSeries.width, canvas_fftSeries.height);

  // Draw mel spectrum
  context_fftSeries_mel.fillStyle = '#FFF';
  context_fftSeries_mel.fillRect(0, 0, canvas_fftSeries.width, canvas_fftSeries.height);

  rectHeight = canvas_fftSeries_mel.height / nMelFilter;
  rectWidth = canvas_fftSeries_mel.width / FRAMESIZE;
  xpos = 0;
  for (let xidx = SERIES_POS + 1; xidx <= SERIES_POS + FRAMESIZE; xidx++) {
    ypos = canvas_fftSeries_mel.height;
    for (let yidx = 0; yidx < nMelFilter; yidx++) {
      mag = DFT_Series_mel[xidx % FRAMESIZE][yidx];
      if (xidx % FRAMESIZE == STARTFRAME || xidx % FRAMESIZE == ENDFRAME) {
        context_fftSeries_mel.fillStyle = '#800000';
      } else {
        context_fftSeries_mel.fillStyle = utils.rainbow[mag];
      }
      context_fftSeries_mel.fillRect(xpos, ypos, rectWidth, -rectHeight);
      ypos -= rectHeight;
    }
    xpos += rectWidth;
  }

  context_fftSeries_mel.strokeRect(0, 0, canvas_fftSeries_mel.width, canvas_fftSeries_mel.height);

  // draw asap ... but wait some time to get other things done
  setTimeout(() => {
    requestAnimationFrame(draw);
  }, 30);
}; // end draw fcn

draw();

// Create Training Data and record buttons
let inputs = [];
const record_btns_div = document.getElementById('record_btns');

for (let idx = 0; idx < NCLASSES; idx++) {
  inputs.push({
    label: `class${idx + 1}`,
    loudness: undefined,
    targetGain: undefined,
    data: [],
  });

  const btn = document.createElement('button');
  btn.classList.add('record_btn');
  btn.id = `class${idx + 1}`;
  btn.innerHTML = `Record class${idx + 1}`;
  const label = document.createElement('label');
  label.htmlFor = `class${idx + 1}`;
  record_btns_div.appendChild(btn);
  record_btns_div.appendChild(label);
}

// take a snapshot on click
const RECORDTIME = 1000; //ms
const RECORDBUFFER = Math.floor(((samplerate / 1000) * RECORDTIME) / BUFFERSIZE + 1); // nBuffer of Size Recordbuffer
const buffertime = (BUFFERSIZE / (samplerate / 1000)) * FRAMESIZE;

utils.assert(buffertime > RECORDTIME);

/**
 * Get collection of buttons
 */
const record_btns = document.getElementsByClassName('record_btn');
const train_btn = document.getElementById('train_btn');
const predict_btn = document.getElementById('predict_btn');
const showImages_btn = document.getElementById('showImages_btn');
toggleButtons(false);

/**
 * extract snapshot of RECORDTIME from ringbuffer, copy it and assign classification label
 */
function record(e, label) {
  //let endFrame = SERIES_POS;
  ENDFRAME = (STARTFRAME + RECORDBUFFER) % FRAMESIZE;
  let image = [];
  let timeseries = [];
  let curpos = STARTFRAME;
  for (let idx = 0; idx < FRAMESIZE; idx++) {
    //image.push([...DFT_Series_mel[curpos]]);

    timeseries.push([...TIME_SERIES[curpos]]);
    image[idx] = DFT_Series_mel[curpos].map((m) => {
      return utils.map(m, 0, 255, 1, -1);
    });
    curpos++;
    if (curpos >= FRAMESIZE) {
      curpos = 0;
    }
    if (curpos == ENDFRAME) {
      break;
    }
  }

  //calculate loudness an time series between start and endframe
  let loudness = loudnessSample.calculateLoudness([].concat.apply([], timeseries));
  let dB = loudness - targetLKFS;
  let targetGain = 1 / Math.pow(10, dB / 20);
  console.log(loudness, targetGain);

  let index = inputs.findIndex((input) => input.label == label);
  inputs[index].data.push(image);
  inputs[index].loudness = loudness;
  inputs[index].targetGain = targetGain;
  e.target.labels[0].innerHTML = `${inputs[index].data.length}`;
  console.log('recording finished');
  toggleButtons(false);
}

// Event listeners for record buttons
for (let idx = 0; idx < record_btns.length; idx++) {
  record_btns[idx].addEventListener('click', (e) => {
    toggleButtons(true);
    let label = record_btns[idx].id;
    console.log('record:', label);
    STARTFRAME = SERIES_POS;
    ENDFRAME = undefined;
    setTimeout(() => {
      record(e, label);
    }, RECORDTIME); //Fuck ... not always the same length (but always larger :))
  });
}

function toggleRecordButtons(flag) {
  for (let idx = 0; idx < record_btns.length; idx++) {
    record_btns[idx].disabled = flag;
  }
}

function togglePredictButton(flag) {
  predict_btn.disabled = flag;
}
togglePredictButton(false);

function toggleButtons(flag) {
  toggleRecordButtons(flag);
  showImages_btn.disabled = flag;
  train_btn.disabled = flag;
}

/**
 * convert data to tensors
 */
function createData() {
  let _labelList = [];
  let _xData = [];
  let _yData = [];
  let _dataSize = 0;

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
        _dataSize++;
      }
    }
  })();

  function getXs() {
    let xs = tf.tensor3d(_xData);
    xs = xs.reshape([_dataSize, RECORDBUFFER, nMelFilter, 1]);
    return xs;
  }

  function getYs() {
    let labelstensor = tf.tensor1d(_yData, 'int32');
    let ys = tf.oneHot(labelstensor, inputs.length);
    labelstensor.dispose();
    return ys;
  }

  return {
    xs: getXs,
    ys: getYs,
  };
}

/**
 * Create Network and attach training to training button
 */
let nn;
let model;
// const nn = createNetwork(RECORDBUFFER, nMelFilter, inputs.length);
// const model = nn.getModel();
// tfvis.show.modelSummary({ name: 'Model Summary' }, model);

train_btn.addEventListener('click', async () => {
  toggleButtons(true);
  nn = createNetwork(RECORDBUFFER, nMelFilter, inputs.length);
  model = nn.getModel();
  tfvis.show.modelSummary({ name: 'Model Summary' }, model);
  const data = createData();
  await nn.train(data.xs(), data.ys(), model);
  console.log('training finished');
  togglePredictButton(false);
});

/**
 * Predict section
 */
function predict(endFrame) {
  //let startFrame = (endFrame - RECORDBUFFER) % FRAMESIZE;
  let startFrame = (endFrame - RECORDBUFFER) % FRAMESIZE;
  if (startFrame < 0) {
    startFrame = FRAMESIZE + startFrame;
  }
  let image = [];
  let timeseries = [];
  let curpos = startFrame;
  for (let idx = 0; idx < FRAMESIZE; idx++) {
    timeseries.push([...TIME_SERIES[curpos]]);
    image[idx] = DFT_Series_mel[curpos].map((m) => {
      return utils.map(m, 0, 255, 1, -1);
    });
    curpos++;
    if (curpos >= FRAMESIZE) {
      curpos = 0;
    }
    if (curpos == endFrame) {
      break;
    }
  }

  let loudness = calculateLoudness(timeseries);
  //TODO: map image with loudness

  let x = tf.tensor2d(image).reshape([1, RECORDBUFFER, nMelFilter, 1]);

  model
    .predict(x)
    .data()
    .then((result) => {
      showPrediction(result);
    })
    .catch((err) => {
      console.log(err);
    });
}

function showPrediction(result) {
  utils.assert(result.length == inputs.length);

  const maxIdx = utils.indexOfMax(result);

  let list = document.getElementById('result');
  list.innerHTML = '';

  for (let idx = 0; idx < result.length; idx++) {
    let entry = document.createElement('li');
    let span = document.createElement('span');
    let textNode = document.createTextNode(`${inputs[idx].label}: ${result[idx].toFixed(2)}`);
    if (idx == maxIdx) {
      span.style.color = 'red';
    }
    span.appendChild(textNode);
    entry.appendChild(span);
    list.appendChild(entry);
  }

  //
  const TRESHOLD = 0.9;
  if (result[maxIdx] > TRESHOLD && maxIdx != 0) {
    let div = document.getElementById('topresult');
    div.innerHTML = '';
    let entry = document.createElement('p');
    let span = document.createElement('span');
    let textNode;
    textNode = document.createTextNode(
      `last recognized class (threshold>${TRESHOLD}) except class1: ${inputs[maxIdx].label}`
    );
    span.appendChild(textNode);
    entry.appendChild(span);
    div.appendChild(entry);
  }
}

predict_btn.addEventListener('click', () => {
  const INTERVALL = 500; //predict every XXX ms
  setInterval(() => {
    tf.tidy(() => {
      predict(SERIES_POS);
    });
  }, INTERVALL);
});

// who understands what is happening here, feel free to explain it to me :)
function transpose(a) {
  return a[0].map((_, c) => a.map((r) => utils.map(r[c], -1, 1, 255, 0)));
}

showImages_btn.addEventListener('click', async () => {
  const surface = tfvis.visor().surface({
    name: 'Recorded Images',
    tab: 'Input Data',
  });
  const drawArea = surface.drawArea; // Get the examples
  drawArea.innerHTML = '';
  const MAX = 20;
  for (let classIdx = 0; classIdx < inputs.length; classIdx++) {
    const p = document.createElement('p');
    p.innerText = inputs[classIdx].label;
    drawArea.appendChild(p);
    for (let idx = 0; idx < inputs[classIdx].data.length; idx++) {
      if (idx >= MAX) {
        break;
      }
      const canvas = document.createElement('canvas');
      canvas.width = RECORDBUFFER + 2;
      canvas.height = nMelFilter + 2;
      canvas.style = 'margin: 1px; border: solid 1px';
      await tf.browser.toPixels(transpose(inputs[classIdx].data[idx]).reverse(), canvas);
      drawArea.appendChild(canvas);
    }
  }
});

const save_btn = document.getElementById('save_btn');
save_btn.addEventListener('click', () => {
  Store.saveData(inputs, 'data');
});

const load_btn = document.getElementById('load_btn');
load_btn.addEventListener('click', () => {
  inputs = Store.getData('data');
});

/**
 * Accuracy and Confusion Matrix
 */
let classNames = [];

for (let idx = 0; idx < inputs.length; idx++) {
  classNames.push(inputs[idx].label);
}

function doPrediction() {
  const data = createData();
  const testxs = data.xs();
  const labels = data.ys().argMax([-1]);
  const preds = model.predict(testxs).argMax([-1]);
  testxs.dispose();
  return [preds, labels];
}

async function showAccuracy() {
  const [preds, labels] = doPrediction();

  const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds);
  const container = {
    name: 'Accuracy',
    tab: 'Evaluation',
  };
  tfvis.show.perClassAccuracy(container, classAccuracy, classNames);
  labels.dispose();
}

async function showConfusion() {
  const [preds, labels] = doPrediction();
  const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds);
  const container = {
    name: 'Confusion Matrix',
    tab: 'Evaluation',
  };
  tfvis.render.confusionMatrix(container, {
    values: confusionMatrix,
    tickLabels: classNames,
  });
  labels.dispose();
}

document.querySelector('#show-accuracy').addEventListener('click', () => showAccuracy());
document.querySelector('#show-confusion').addEventListener('click', () => showConfusion());
