// It all starts with a context
const context = new AudioContext();
const samplerate = context.sampleRate;

// Buffer sizes
const BUFFER_SIZE = 1024; // the chunks we get from the input source (e.g. the mic)
const FRAME_SIZE = samplerate * 0.025; // Frame_time == 25 ms
const FRAME_STRIDE = samplerate * 0.01; // Frame_stride == 10 ms (=> 15 ms overlap)
const RECORD_SIZE = samplerate * 1.0; // 1 second for recording and prediction, shall be gt the FRAME_SIZE

const N_FRAMES 


// Ringbuffer
const RB_SIZE = 2 * RECORD_SIZE; // arbitrary choice, shall be gt RECORD_SIZE
const timeDomainData = Array.from(Array(RB_SIZE), () => 0);
let HEAD_POS = 0; 

// Loudness
const loudnessSample = new LoudnessSample(samplerate);
const targetLKFS = -13; // the target loudness
const LKFS_THRESHOLD = -25; // don't scale if LKFS is below this threshold

// Hamming Window
const window = createWindowing(FRAME_SIZE);

// DFT
const dft = new DFT(FRAME_SIZE);
const B2P1 = FRAME_SIZE / 2 + 1; // Length of frequency domain data

// Mel Filter
const N_MEL_FILTER = 24; // Number of Mel Filterbanks
const filter = mel_filter();
const MIN_FREQUENCY = 300; // lower end of first mel filter bank
const MAX_FREQUENCY = 6000; // upper end of last mel filterbank
filter.init(samplerate, FRAME_SIZE, MIN_FREQUENCY, MAX_FREQUENCY, N_MEL_FILTER);

// Neural Network
const NCLASSES = 4; // How many classes to classify (normally, the first class refers to the background)
let nn; // defined later
let model;

// Plotting
let STARTFRAME; // Recording Startframe (used for drawing)
let ENDFRAME; // Recording Endframe (used for drawing)

// Other
const MIN_EXP = -1; // 10^{min_exp} linear, log scale minimum
const MAX_EXP = 2; // 10^{max_exp} linear, log scale max

// old ??
const FRAMESIZE = 220; // How many frames of size BUFFERSIZE
let TIME_SERIES = []; // time domain ringbuffer
let DFT_Series = []; // ringbuffer (only used for drawing)
let DFT_Series_mel = []; // ringbuffer (only used for drawing)
let SERIES_POS = FRAMESIZE - 1; // head of ringbuffer


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
let drawit = [false, false, true];

const w = 4 * FRAMESIZE;
const h = 4 * nMelFilter;

let canvas;
let canvasCtx;
let canvas_fftSeries;
let context_fftSeries;
let canvas_fftSeries_mel;
let context_fftSeries_mel;

if (drawit[0]) {
  canvas = document.getElementById('oscilloscope');
  canvasCtx = canvas.getContext('2d');
  canvas.width = w;
  canvas.height = B2P1;
}

if (drawit[1]) {
  canvas_fftSeries = document.getElementById('fft-series');
  context_fftSeries = canvas_fftSeries.getContext('2d');
  canvas_fftSeries.width = w;
  canvas_fftSeries.height = B2P1;
}

if (drawit[2]) {
  canvas_fftSeries_mel = document.getElementById('fft-series mel');
  context_fftSeries_mel = canvas_fftSeries_mel.getContext('2d');
  canvas_fftSeries_mel.width = w;
  canvas_fftSeries_mel.height = h;
}

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

    TIME_SERIES[SERIES_POS] = Array.from(timeDomainData);

    // for illustration purpose !!!
    // Do the Fourier Transformation
    dft.forward(timeDomainData);

    // Mapping for log scale
    let mag = 0;
    utils.assert(B2P1 == dft.mag.length, 'checking length of frequency domain data');
    for (let idx = 0; idx < B2P1; idx++) {
      mag = dft.mag[idx];
      mag = utils.logRangeMap(mag, MIN_EXP, MAX_EXP, 255, 0);
      mag = Math.round(mag);
      DFT_Series[SERIES_POS][idx] = mag;
    }

    // Copy array of mel coefficients
    DFT_Series_mel[SERIES_POS] = Array.from(filter.getLogMelCoefficients(dft.mag, MIN_EXP, MAX_EXP));

    // Clear frames (for drawing start and end of vertical line when recording)
    if (STARTFRAME == SERIES_POS) {
      STARTFRAME = undefined;
    }
    if (ENDFRAME == SERIES_POS) {
      ENDFRAME = undefined;
    }
  }; //end onprocess mic data
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
 * Why not making an IIFE ...
 */
const draw = function () {
  // Draw magnitudes
  if (drawit[0]) {
    canvasCtx.fillStyle = '#FFF';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

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
  }

  // Draw FT Time Series
  if (drawit[1]) {
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
  }

  // Draw mel spectrum
  if (drawit[2]) {
    context_fftSeries_mel.fillStyle = '#FFF';
    context_fftSeries_mel.fillRect(0, 0, canvas_fftSeries_mel.width, canvas_fftSeries_mel.height);

    rectHeight = canvas_fftSeries_mel.height / nMelFilter;
    rectWidth = canvas_fftSeries_mel.width / FRAMESIZE;
    let xpos = 0;
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
  }

  // draw asap ... but wait some time to get other things done
  setTimeout(() => {
    requestAnimationFrame(draw);
  }, 30);
}; // end draw fcn

draw();

// Create Training Data and record buttons
let inputs = []; // the recorded data
const record_btns_div = document.getElementById('record_btns');
for (let idx = 0; idx < NCLASSES; idx++) {
  inputs.push({
    label: `class${idx + 1}`, // class label
    data_adapted: [], // the loudness scaled image (mel spectrum)
    data: [], // the unscaled image (mel spectrum)
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
utils.assert(buffertime > RECORDTIME, 'buffertime too small for recordings');

/**
 * Get collection of buttons
 */
const record_btns = document.getElementsByClassName('record_btn');
const train_btn = document.getElementById('train_btn');
const predict_btn = document.getElementById('predict_btn');
const showImages_btn = document.getElementById('showImages_btn');
toggleButtons(false);

/**
 * extract snapshot of RECORDTIME from ringbuffer
 * calculate loudness of snapshot
 * scale timeseries with gain correction (to given loudness)
 * apply dft on adated timeseries (-> hope this makes some sense to do it this way)
 * image[] contains the 'raw' mel filter 2d array
 * image_adapted[] contains the loudness normalized mel filter 2d array
 */
function record(e, label) {
  //let endFrame = SERIES_POS;
  ENDFRAME = (STARTFRAME + RECORDBUFFER) % FRAMESIZE;
  let image = [];
  let timeseries = [];
  let curpos = STARTFRAME;

  for (let idx = 0; idx < FRAMESIZE; idx++) {
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

  // post loudness calculation
  // calculate loudness an time series between start and endframe
  let loudness = loudnessSample.calculateLoudness([].concat.apply([], timeseries));
  let dB = loudness - targetLKFS;
  let targetGain = 1;
  if (loudness > LKFS_THRESHOLD) {
    targetGain = 1 / utils.decibelsToLinear(dB);
  }
  console.log(loudness, targetGain);

  // post DFT
  let image_adapted = [];
  for (let idx = 0; idx < timeseries.length; idx++) {
    //TODO: scale timeseries
    let timeseries_adapted = timeseries[idx].map((ts) => targetGain * ts);

    // Do the Fourier Transformation
    dft.forward(timeseries_adapted);
    utils.assert(B2P1 == dft.mag.length);

    // Copy array of mel coefficients
    let tmp = filter.getLogMelCoefficients(dft.mag, MIN_EXP, MAX_EXP);
    image_adapted.push(
      tmp.map((m) => {
        return utils.map(m, 0, 255, 1, -1);
      })
    );
  }

  let index = inputs.findIndex((input) => input.label == label);
  inputs[index].data.push(image);
  inputs[index].data_adapted.push(image_adapted);
  e.target.labels[0].innerHTML = `${inputs[index].data.length}`;
  console.log('recording finished');
  toggleButtons(false);
} // end recording

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

  (function convertData() {
    createLabelList();

    let nLabels = inputs.length;
    _xData = [];
    _yData = [];
    for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
      for (let idx = 0; idx < inputs[dataIdx].data_adapted.length; idx++) {
        _xData.push(inputs[dataIdx].data_adapted[idx]);
        _yData.push(_labelList.indexOf(inputs[dataIdx].label));
        _dataSize++;
      }
    }

    shuffle(_xData, _yData);
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

  // post loudness calculation
  // calculate loudness an time series between start and endframe
  let loudness = loudnessSample.calculateLoudness([].concat.apply([], timeseries));
  let dB = loudness - targetLKFS;
  let targetGain = 1;
  if (loudness > LKFS_THRESHOLD) {
    targetGain = 1 / Math.pow(10, dB / 20);
  }
  console.log(loudness, targetGain);

  // post DFT
  let image_adapted = [];
  for (let idx = 0; idx < timeseries.length; idx++) {
    // scale to target loudness
    let timeseries_adapted = timeseries[idx].map((ts) => targetGain * ts);

    // Do the Fourier Transformation
    dft.forward(timeseries_adapted);
    utils.assert(B2P1 == dft.mag.length);

    // Copy array of mel coefficients
    let tmp = filter.getLogMelCoefficients(dft.mag, MIN_EXP, MAX_EXP);
    image_adapted.push(
      tmp.map((m) => {
        return utils.map(m, 0, 255, 1, -1);
      })
    );
  }

  //let x = tf.tensor2d(image).reshape([1, RECORDBUFFER, nMelFilter, 1]);
  let x = tf.tensor2d(image_adapted).reshape([1, RECORDBUFFER, nMelFilter, 1]);

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
    for (let idx = 0; idx < inputs[classIdx].data_adapted.length; idx++) {
      if (idx >= MAX) {
        break;
      }
      const canvas = document.createElement('canvas');
      canvas.width = RECORDBUFFER + 2;
      canvas.height = nMelFilter + 2;
      canvas.style = 'margin: 1px; border: solid 1px';
      await tf.browser.toPixels(transpose(inputs[classIdx].data_adapted[idx]).reverse(), canvas);
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
