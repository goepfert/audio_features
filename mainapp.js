// It all starts with a context
const context = new AudioContext();

// Canvas width and height
const w = 400;
const h = 200;

const canvas = document.getElementById('oscilloscope');
canvas.width = w;
canvas.height = h;
const canvasCtx = canvas.getContext('2d');

const canvas_fftSeries = document.getElementById('fft-series');
const context_fftSeries = canvas_fftSeries.getContext('2d');
canvas_fftSeries.width = w;
canvas_fftSeries.height = h;

const canvas_fftSeries_mel = document.getElementById('fft-series mel');
const context_fftSeries_mel = canvas_fftSeries_mel.getContext('2d');
canvas_fftSeries_mel.width = w;
canvas_fftSeries_mel.height = h;

// FT Stuff
const BUFFERSIZE = 512; // 48 kHz sampling rate, 1024 samples => 21.3 ms
const B2P1 = BUFFERSIZE / 2 + 1;
const dft = new DFT(BUFFERSIZE);
let timeDomainData = [];

const FRAMESIZE = 200; // How many frames of size BUFFERSIZE
const nMelFilter = 26; // Number of Mel Filterbanks
let DFT_Series = []; // ringbuffer
let DFT_Series_mel = []; // ringbuffer
let DFT_Series_pos = FRAMESIZE - 1; // head of ringbuffer

const filter = mel_filter();
const samplerate = context.sampleRate;
filter.init(samplerate, BUFFERSIZE, 0, samplerate / 2, nMelFilter);

// Prefill arrays
for (let idx = 0; idx < FRAMESIZE; idx++) {
  let ft_array = Array.from(Array(B2P1), () => 0);
  DFT_Series.push(ft_array);

  let mel_array = Array.from(Array(nMelFilter), () => 0);
  DFT_Series_mel.push(mel_array);
}

/**
 * Handle mic data
 */
const handleSuccess = function(stream) {
  console.log('handle success');
  const source = context.createMediaStreamSource(stream);

  // Create a ScriptProcessorNode
  const processor = context.createScriptProcessor(BUFFERSIZE, 1, 1);
  source.connect(processor);
  processor.connect(context.destination);

  processor.onaudioprocess = function(e) {
    const inputBuffer = e.inputBuffer;
    timeDomainData = inputBuffer.getChannelData(0);

    // Do the Fourier Transformation
    dft.forward(timeDomainData);

    // Shift head of ringbuffer
    DFT_Series_pos++;
    if (DFT_Series_pos > FRAMESIZE - 1) {
      DFT_Series_pos = 0;
    }

    // Mapping for log scale
    const min_exp = -1; // 10^{min_exp} linear
    const max_exp = 2; // 10^{max_exp} linear
    let mag = 0;
    for (let idx = 0; idx < B2P1; idx++) {
      mag = dft.mag[idx];
      mag = utils.logRangeMap(mag, min_exp, max_exp, 255, 0);
      mag = Math.round(mag);
      DFT_Series[DFT_Series_pos][idx] = mag;
    }

    // Copy array of mel coefficients
    DFT_Series_mel[DFT_Series_pos] = Array.from(filter.getLogMelCoefficients(dft.mag, min_exp, max_exp));
  };
};

/** Kicks off Mic data handle function
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then(handleSuccess)
  .catch(err => console.log(err));

/**
 * Recursive draw function
 * Called as fast as possible by the browser (as far as I understood)
 */
const draw = function() {
  canvasCtx.fillStyle = '#FFF';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw magnitudes
  let barWidth = canvas.width / B2P1;
  let barHeight;
  let mag = 0;
  let x = 0;
  for (let i = 0; i < B2P1; i++) {
    mag = DFT_Series[DFT_Series_pos][i];
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
  for (let xidx = DFT_Series_pos + 1; xidx <= DFT_Series_pos + FRAMESIZE; xidx++) {
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
  for (let xidx = DFT_Series_pos + 1; xidx <= DFT_Series_pos + FRAMESIZE; xidx++) {
    ypos = canvas_fftSeries_mel.height;
    for (let yidx = 0; yidx < nMelFilter; yidx++) {
      mag = DFT_Series_mel[xidx % FRAMESIZE][yidx];
      context_fftSeries_mel.fillStyle = utils.rainbow[mag];
      context_fftSeries_mel.fillRect(xpos, ypos, rectWidth, -rectHeight);
      ypos -= rectHeight;
    }
    xpos += rectWidth;
  }
  context_fftSeries_mel.strokeRect(0, 0, canvas_fftSeries_mel.width, canvas_fftSeries_mel.height);

  // draw asap ... but wait some time to get other things done
  setTimeout(() => {
    requestAnimationFrame(draw);
  }, 50);
}; // end draw fcn

draw();

// Training Data
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
  },
  {
    label: 'class4',
    data: []
  }
];

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
toggleButtons(false);

//console.log(record_btns);
for (let idx = 0; idx < record_btns.length; idx++) {
  record_btns[idx].addEventListener('click', e => {
    toggleButtons(true);
    let label = record_btns[idx].id;
    console.log('record:', label);
    //startFrame = DFT_Series_pos;
    setTimeout(() => {
      record(e, DFT_Series_pos, label);
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
  train_btn.disabled = flag;
}

/**
 * extract snapshot of RECORDTIME from ringbuffer, copy it and assign classification label
 */
function record(e, startFrame, label) {
  //let endFrame = DFT_Series_pos;
  let endFrame = (startFrame + RECORDBUFFER) % FRAMESIZE;
  let image = [];
  let curpos = startFrame;
  for (let idx = 0; idx < FRAMESIZE; idx++) {
    //image.push([...DFT_Series_mel[curpos]]);
    image[idx] = DFT_Series_mel[curpos].map(m => {
      return utils.map(m, 0, 255, 1, 0);
    });
    curpos++;
    if (curpos >= FRAMESIZE) {
      curpos = 0;
    }
    if (curpos == endFrame) {
      break;
    }
  }

  let index = inputs.findIndex(input => input.label == label);
  inputs[index].data.push(image);
  e.target.labels[0].innerHTML = `${inputs[index].data.length}`;
  console.log('recording finished');
  toggleButtons(false);
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
    ys: getYs
  };
}

/**
 * Create Network and attach training to training button
 */
const nn = createNetwork(RECORDBUFFER, nMelFilter, inputs.length);
const model = nn.getModel();
tfvis.show.modelSummary({ name: 'Model Summary' }, model);

train_btn.addEventListener('click', async () => {
  toggleButtons(true);
  const data = createData();
  await nn.train(data.xs(), data.ys(), model);
  console.log('training finished');
  togglePredictButton(false);
});

/**
 * Predict section
 */
function predict(startFrame) {
  let endFrame = (startFrame + RECORDBUFFER) % FRAMESIZE;
  let image = [];
  let curpos = startFrame;
  for (let idx = 0; idx < FRAMESIZE; idx++) {
    image[idx] = DFT_Series_mel[curpos].map(m => {
      return utils.map(m, 0, 255, 1, 0);
    });
    curpos++;
    if (curpos >= FRAMESIZE) {
      curpos = 0;
    }
    if (curpos == endFrame) {
      break;
    }
  }

  let x = tf.tensor2d(image).reshape([1, RECORDBUFFER, nMelFilter, 1]);
  console.log('start testing3 ...');
  model
    .predict(x)
    .data()
    .then(result => {
      console.log(result);
      showPrediction(result);
      x.dispose();
    })
    .catch(err => {
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
    let textNode = document.createTextNode(`${inputs[idx].label}: ${result[idx]}`);
    if (idx == maxIdx) {
      span.style.color = 'red';
    }
    span.appendChild(textNode);
    entry.appendChild(span);
    list.appendChild(entry);
  }
}

predict_btn.addEventListener('click', () => {
  const INTERVALL = 500; //predict every 200ms
  setInterval(() => {
    predict(DFT_Series_pos);
  }, INTERVALL);
});
