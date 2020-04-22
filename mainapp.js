// It all starts with a context
const context = new AudioContext({ samplerate: 16000 });
const samplerate = context.sampleRate;

// Buffer sizes
const BUFFER_SIZE = 1024; // the chunks we get from the input source (e.g. the mic)
const FRAME_SIZE = samplerate * 0.025; // Frame_time == 25 ms
const FRAME_STRIDE = samplerate * 0.01; // Frame_stride == 10 ms (=> 15 ms overlap)

const buffertime = 1; // in seconds
const RECORD_SIZE = Math.floor((samplerate * buffertime) / BUFFER_SIZE) * BUFFER_SIZE; // ~buffertime in number of samples, ensure integer fraction size

// Ringbuffer Time Domain (1D)
const RB_SIZE = 3 * RECORD_SIZE; // arbitrary choice, shall be gt RECORD_SIZE
//const timeDomainData = Array.from(Array(RB_SIZE), () => 0);
const timeDomainData = new CircularBuffer(RB_SIZE);

// RingBuffer Framing (2D)
const RB_SIZE_FRAMING = utils.getNumberOfFrames(RB_SIZE, FRAME_SIZE, FRAME_STRIDE); // how many frames with overlap fit into time domain ringbuffer
let Data_Pos = 0;
const DFT_Data = []; // after fourier transform [B2P1][RB_SIZE_FRAMING]
const LOG_MEL = [];
const DCT = [];

console.log(samplerate, BUFFER_SIZE, FRAME_SIZE, FRAME_STRIDE, RB_SIZE, RB_SIZE_FRAMING);

// Loudness
const loudnessSample = new LoudnessSample(samplerate);
const targetLKFS = -13; // the target loudness
const LKFS_THRESHOLD = -25; // don't scale if LKFS is below this threshold

// Hamming Window
const fenster = createWindowing(FRAME_SIZE); // don't call it window ...

// DFT
const dft = new DFT(FRAME_SIZE);
const B2P1 = FRAME_SIZE / 2 + 1; // Length of frequency domain data

// Mel Filter
const N_MEL_FILTER = 32; // Number of Mel Filterbanks
const filter = mel_filter();
const MIN_FREQUENCY = 300; // lower end of first mel filter bank
const MAX_FREQUENCY = 8000; // upper end of last mel filterbank
filter.init(samplerate, FRAME_SIZE, MIN_FREQUENCY, MAX_FREQUENCY, N_MEL_FILTER);

// DCT
const N_DCT = 12; // discard first and keep second undtil you have N_DCT

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

// Prefill arrays
for (let idx = 0; idx < RB_SIZE_FRAMING; idx++) {
  let ft_array = Array.from(Array(B2P1), () => 0);
  DFT_Data.push(ft_array);

  let mel_array = Array.from(Array(N_MEL_FILTER), () => 0);
  LOG_MEL.push(mel_array);

  let dct_array = Array.from(Array(N_DCT), () => 0);
  DCT.push(dct_array);
}

// Canvas width and height
let drawit = [false, false, true, true];

const w = RB_SIZE_FRAMING;
const h = 100; //N_MEL_FILTER;

let canvas;
let canvasCtx;
let canvas_fftSeries;
let context_fftSeries;
let canvas_fftSeries_mel;
let context_fftSeries_mel;
let canvas_fftSeries_dct;
let context_fftSeries_dct;

if (drawit[0]) {
  canvas = document.getElementById('oscilloscope');
  canvasCtx = canvas.getContext('2d');
  canvas.width = 2 * w;
  canvas.height = h; //B2P1;
}

if (drawit[1]) {
  canvas_fftSeries = document.getElementById('fft-series');
  context_fftSeries = canvas_fftSeries.getContext('2d');
  canvas_fftSeries.width = 2 * w;
  canvas_fftSeries.height = B2P1;
}

if (drawit[2]) {
  canvas_fftSeries_mel = document.getElementById('fft-series mel');
  context_fftSeries_mel = canvas_fftSeries_mel.getContext('2d');
  canvas_fftSeries_mel.width = 4 * w;
  canvas_fftSeries_mel.height = 4 * N_MEL_FILTER;
}

if (drawit[3]) {
  canvas_fftSeries_dct = document.getElementById('fft-series dct');
  context_fftSeries_dct = canvas_fftSeries_dct.getContext('2d');
  canvas_fftSeries_dct.width = 4 * w;
  canvas_fftSeries_dct.height = 4 * N_DCT;
}

/**
 * Handle mic data
 */
const handleSuccess = function (stream) {
  console.log('handle success');
  const source = context.createMediaStreamSource(stream);

  // Create a ScriptProcessorNode
  const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
  source.connect(processor);
  processor.connect(context.destination);

  processor.onaudioprocess = function (e) {
    const inputBuffer = e.inputBuffer;
    timeDomainData2 = inputBuffer.getChannelData(0);

    data = inputBuffer.getChannelData(0);
    timeDomainData.concat(data);

    doFraming();

    // // Clear frames (for drawing start and end of vertical line when recording)
    // if (STARTFRAME == SERIES_POS) {
    //   STARTFRAME = undefined;
    // }
    // if (ENDFRAME == SERIES_POS) {
    //   ENDFRAME = undefined;
    // }
  }; //end onprocess mic data
};

/** Kicks off Mic data handle function
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then(handleSuccess)
  .catch((err) => console.log(err));

let nextStartPos = 0;
let _mag_min = 100;
let _mag_max = 0;
let _mel_min = 100;
let _mel_max = 0;
let _dct_min = 100;
let _dct_max = 0;

function doFraming() {
  let headPos = timeDomainData.getHeadPos();
  let availableData = headPos - nextStartPos;
  if (availableData < 0) {
    availableData = headPos + timeDomainData.getLength() - nextStartPos;
  }

  if (availableData < FRAME_SIZE) {
    return;
  }

  let nFrames = utils.getNumberOfFrames(availableData, FRAME_SIZE, FRAME_STRIDE);
  let startPos = nextStartPos;
  let endPos = (nextStartPos + FRAME_SIZE) % RB_SIZE;

  for (let idx = 0; idx < nFrames; idx++) {
    let frame_buffer = timeDomainData.getSlice(startPos, endPos);

    // Windowing
    fenster.hamming(frame_buffer);

    // Fourier Transform
    dft.forward(frame_buffer);
    // mag_min = Math.min(...dft.mag);
    // _mag_min = mag_min < _mag_min ? mag_min : _mag_min;
    // mag_max = Math.max(...dft.mag);
    // _mag_max = mag_max > _mag_max ? mag_max : _mag_max;
    DFT_Data[Data_Pos] = utils.logRangeMapBuffer(dft.mag, MIN_EXP, MAX_EXP, 255, 0);

    // MelFilter
    let mel_array = filter.getLogMelCoefficients(dft.mag);
    // mel_min = Math.min(...mel_array);
    // _mel_min = mel_min < _mel_min ? mel_min : _mel_min;
    // mel_max = Math.max(...mel_array);
    // _mel_max = mel_max > _mel_max ? mel_max : _mel_max;
    LOG_MEL[Data_Pos] = utils.rangeMapBuffer(mel_array, MIN_EXP, MAX_EXP, 255, 0);

    // Discrete Cosine Transform
    fastDctLee.transform(mel_array);
    let dct_array = mel_array.slice(1, 1 + N_DCT);
    // dct_min = Math.min(...dct_array);
    // _dct_min = dct_min < _dct_min ? dct_min : _dct_min;
    // dct_max = Math.max(...dct_array);
    // _dct_max = dct_max > _dct_max ? dct_max : _dct_max;
    DCT[Data_Pos] = utils.rangeMapBuffer(dct_array, -20, 20, 255, 0);

    // Bookeeping
    Data_Pos = (Data_Pos + 1) % RB_SIZE_FRAMING;
    startPos = (startPos + FRAME_STRIDE) % RB_SIZE;
    endPos = (endPos + FRAME_STRIDE) % RB_SIZE;
  }

  nextStartPos = startPos;
  // console.log('nFrames', nFrames, 'nextStartPos', nextStartPos);

  //console.log('mel', _mag_min, _mag_max); // 0 ... 100
  //console.log('mel', _mel_min, _mel_max); // 0 ... 2
  //console.log('dct', _dct_min, _dct_max); // -20 ... 25
}

/**
 * Recursive draw function
 * Called as fast as possible by the browser (as far as I understood)
 * Why not making an IIFE ...
 */
const draw = function () {
  let barWidth;
  let barHeight;
  let mag = 0;
  let x = 0;

  // Draw magnitudes
  if (drawit[0]) {
    barWidth = canvas.width / B2P1;
    canvasCtx.fillStyle = '#FFF';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < B2P1; i++) {
      mag = DFT_Data[Data_Pos][i];
      mag = Math.round(mag);
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
    let sliceWidth = canvas.width / BUFFER_SIZE;
    x = 0;
    let timearray = timeDomainData.getSlice(timeDomainData.lastHead, timeDomainData.head);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      let v = timearray[i] + 1;
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
    let rectWidth = canvas_fftSeries.width / RB_SIZE_FRAMING;
    let xpos = 0;
    let ypos;
    for (let xidx = Data_Pos + 1; xidx <= Data_Pos + RB_SIZE_FRAMING; xidx++) {
      ypos = canvas_fftSeries.height;
      for (let yidx = 0; yidx < B2P1; yidx++) {
        mag = DFT_Data[xidx % RB_SIZE_FRAMING][yidx];
        mag = Math.round(mag);
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

    rectHeight = canvas_fftSeries_mel.height / N_MEL_FILTER;
    rectWidth = canvas_fftSeries_mel.width / RB_SIZE_FRAMING;
    let xpos = 0;
    for (let xidx = Data_Pos; xidx < Data_Pos + RB_SIZE_FRAMING; xidx++) {
      ypos = canvas_fftSeries_mel.height;
      for (let yidx = 0; yidx < N_MEL_FILTER; yidx++) {
        mag = LOG_MEL[xidx % RB_SIZE_FRAMING][yidx];
        mag = Math.round(mag);
        if (xidx % RB_SIZE_FRAMING == STARTFRAME || xidx % RB_SIZE_FRAMING == ENDFRAME) {
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

  // Draw dct spectrum
  if (drawit[3]) {
    context_fftSeries_dct.fillStyle = '#FFF';
    context_fftSeries_dct.fillRect(0, 0, canvas_fftSeries_dct.width, canvas_fftSeries_dct.height);

    rectHeight = canvas_fftSeries_dct.height / N_DCT;
    rectWidth = canvas_fftSeries_dct.width / RB_SIZE_FRAMING;
    let xpos = 0;

    for (let xidx = Data_Pos; xidx < Data_Pos + RB_SIZE_FRAMING; xidx++) {
      ypos = canvas_fftSeries_dct.height;
      for (let yidx = 0; yidx < N_DCT; yidx++) {
        mag = DCT[xidx % RB_SIZE_FRAMING][yidx];
        mag = Math.round(mag);

        if (xidx % RB_SIZE_FRAMING == STARTFRAME || xidx % RB_SIZE_FRAMING == ENDFRAME) {
          context_fftSeries_dct.fillStyle = '#800000';
        } else {
          context_fftSeries_dct.fillStyle = utils.rainbow[mag];
        }
        context_fftSeries_dct.fillRect(xpos, ypos, rectWidth, -rectHeight);
        ypos -= rectHeight;
      }
      xpos += rectWidth;
    }

    context_fftSeries_dct.strokeRect(0, 0, canvas_fftSeries_dct.width, canvas_fftSeries_dct.height);
  }

  // draw asap ... but wait some time to get other things done
  setTimeout(() => {
    requestAnimationFrame(draw);
  }, 20);
}; // end draw fcn

draw();

// // Create Training Data and record buttons
// let inputs = []; // the recorded data
// const record_btns_div = document.getElementById('record_btns');
// for (let idx = 0; idx < NCLASSES; idx++) {
//   inputs.push({
//     label: `class${idx + 1}`, // class label
//     data_adapted: [], // the loudness scaled image (mel spectrum)
//     data: [], // the unscaled image (mel spectrum)
//   });

//   const btn = document.createElement('button');
//   btn.classList.add('record_btn');
//   btn.id = `class${idx + 1}`;
//   btn.innerHTML = `Record class${idx + 1}`;
//   const label = document.createElement('label');
//   label.htmlFor = `class${idx + 1}`;
//   record_btns_div.appendChild(btn);
//   record_btns_div.appendChild(label);
// }

// // take a snapshot on click
// const RECORDTIME = 1000; //ms
// const RECORDBUFFER = Math.floor(((samplerate / 1000) * RECORDTIME) / BUFFERSIZE + 1); // nBuffer of Size Recordbuffer
// //const buffertime = (BUFFERSIZE / (samplerate / 1000)) * FRAMESIZE;
// utils.assert(buffertime > RECORDTIME, 'buffertime too small for recordings');

// /**
//  * Get collection of buttons
//  */
// const record_btns = document.getElementsByClassName('record_btn');
// const train_btn = document.getElementById('train_btn');
// const predict_btn = document.getElementById('predict_btn');
// const showImages_btn = document.getElementById('showImages_btn');
// toggleButtons(false);

// /**
//  * extract snapshot of RECORDTIME from ringbuffer
//  * calculate loudness of snapshot
//  * scale timeseries with gain correction (to given loudness)
//  * apply dft on adated timeseries (-> hope this makes some sense to do it this way)
//  * image[] contains the 'raw' mel filter 2d array
//  * image_adapted[] contains the loudness normalized mel filter 2d array
//  */
// function record(e, label) {
//   //let endFrame = SERIES_POS;
//   ENDFRAME = (STARTFRAME + RECORDBUFFER) % FRAMESIZE;
//   let image = [];
//   let timeseries = [];
//   let curpos = STARTFRAME;

//   for (let idx = 0; idx < FRAMESIZE; idx++) {
//     timeseries.push([...TIME_SERIES[curpos]]);
//     image[idx] = DFT_Series_mel[curpos].map((m) => {
//       return utils.map(m, 0, 255, 1, -1);
//     });
//     curpos++;
//     if (curpos >= FRAMESIZE) {
//       curpos = 0;
//     }
//     if (curpos == ENDFRAME) {
//       break;
//     }
//   }

//   // post loudness calculation
//   // calculate loudness an time series between start and endframe
//   let loudness = loudnessSample.calculateLoudness([].concat.apply([], timeseries));
//   let dB = loudness - targetLKFS;
//   let targetGain = 1;
//   if (loudness > LKFS_THRESHOLD) {
//     targetGain = 1 / utils.decibelsToLinear(dB);
//   }
//   console.log(loudness, targetGain);

//   // post DFT
//   let image_adapted = [];
//   for (let idx = 0; idx < timeseries.length; idx++) {
//     //TODO: scale timeseries
//     let timeseries_adapted = timeseries[idx].map((ts) => targetGain * ts);

//     // Do the Fourier Transformation
//     dft.forward(timeseries_adapted);
//     utils.assert(B2P1 == dft.mag.length);

//     // Copy array of mel coefficients
//     let tmp = filter.getLogMelCoefficients(dft.mag, MIN_EXP, MAX_EXP);
//     image_adapted.push(
//       tmp.map((m) => {
//         return utils.map(m, 0, 255, 1, -1);
//       })
//     );
//   }

//   let index = inputs.findIndex((input) => input.label == label);
//   inputs[index].data.push(image);
//   inputs[index].data_adapted.push(image_adapted);
//   e.target.labels[0].innerHTML = `${inputs[index].data.length}`;
//   console.log('recording finished');
//   toggleButtons(false);
// } // end recording

// // Event listeners for record buttons
// for (let idx = 0; idx < record_btns.length; idx++) {
//   record_btns[idx].addEventListener('click', (e) => {
//     toggleButtons(true);
//     let label = record_btns[idx].id;
//     console.log('record:', label);
//     STARTFRAME = SERIES_POS;
//     ENDFRAME = undefined;
//     setTimeout(() => {
//       record(e, label);
//     }, RECORDTIME); //Fuck ... not always the same length (but always larger :))
//   });
// }

// function toggleRecordButtons(flag) {
//   for (let idx = 0; idx < record_btns.length; idx++) {
//     record_btns[idx].disabled = flag;
//   }
// }

// function togglePredictButton(flag) {
//   predict_btn.disabled = flag;
// }
// togglePredictButton(false);

// function toggleButtons(flag) {
//   toggleRecordButtons(flag);
//   showImages_btn.disabled = flag;
//   train_btn.disabled = flag;
// }

// /**
//  * convert data to tensors
//  */
// function createData() {
//   let _labelList = [];
//   let _xData = [];
//   let _yData = [];
//   let _dataSize = 0;

//   function createLabelList() {
//     let nLabels = inputs.length;
//     for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
//       _labelList.push(inputs[dataIdx].label);
//     }
//   }

//   function shuffle(obj1, obj2) {
//     let index = obj1.length;
//     let rnd, tmp1, tmp2;

//     while (index) {
//       rnd = Math.floor(Math.random() * index);
//       index -= 1;
//       tmp1 = obj1[index];
//       tmp2 = obj2[index];
//       obj1[index] = obj1[rnd];
//       obj2[index] = obj2[rnd];
//       obj1[rnd] = tmp1;
//       obj2[rnd] = tmp2;
//     }
//   }

//   (function convertData() {
//     createLabelList();

//     let nLabels = inputs.length;
//     _xData = [];
//     _yData = [];
//     for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
//       for (let idx = 0; idx < inputs[dataIdx].data_adapted.length; idx++) {
//         _xData.push(inputs[dataIdx].data_adapted[idx]);
//         _yData.push(_labelList.indexOf(inputs[dataIdx].label));
//         _dataSize++;
//       }
//     }

//     shuffle(_xData, _yData);
//   })();

//   function getXs() {
//     let xs = tf.tensor3d(_xData);
//     xs = xs.reshape([_dataSize, RECORDBUFFER, nMelFilter, 1]);
//     return xs;
//   }

//   function getYs() {
//     let labelstensor = tf.tensor1d(_yData, 'int32');
//     let ys = tf.oneHot(labelstensor, inputs.length);
//     labelstensor.dispose();
//     return ys;
//   }

//   return {
//     xs: getXs,
//     ys: getYs,
//   };
// }

// /**
//  * Create Network and attach training to training button
//  */

// // const nn = createNetwork(RECORDBUFFER, nMelFilter, inputs.length);
// // const model = nn.getModel();
// // tfvis.show.modelSummary({ name: 'Model Summary' }, model);

// train_btn.addEventListener('click', async () => {
//   toggleButtons(true);
//   nn = createNetwork(RECORDBUFFER, nMelFilter, inputs.length);
//   model = nn.getModel();
//   tfvis.show.modelSummary({ name: 'Model Summary' }, model);
//   const data = createData();
//   await nn.train(data.xs(), data.ys(), model);
//   console.log('training finished');
//   togglePredictButton(false);
// });

// /**
//  * Predict section
//  */
// function predict(endFrame) {
//   //let startFrame = (endFrame - RECORDBUFFER) % FRAMESIZE;
//   let startFrame = (endFrame - RECORDBUFFER) % FRAMESIZE;
//   if (startFrame < 0) {
//     startFrame = FRAMESIZE + startFrame;
//   }
//   let image = [];
//   let timeseries = [];
//   let curpos = startFrame;
//   for (let idx = 0; idx < FRAMESIZE; idx++) {
//     timeseries.push([...TIME_SERIES[curpos]]);
//     image[idx] = DFT_Series_mel[curpos].map((m) => {
//       return utils.map(m, 0, 255, 1, -1);
//     });
//     curpos++;
//     if (curpos >= FRAMESIZE) {
//       curpos = 0;
//     }
//     if (curpos == endFrame) {
//       break;
//     }
//   }

//   // post loudness calculation
//   // calculate loudness an time series between start and endframe
//   let loudness = loudnessSample.calculateLoudness([].concat.apply([], timeseries));
//   let dB = loudness - targetLKFS;
//   let targetGain = 1;
//   if (loudness > LKFS_THRESHOLD) {
//     targetGain = 1 / Math.pow(10, dB / 20);
//   }
//   console.log(loudness, targetGain);

//   // post DFT
//   let image_adapted = [];
//   for (let idx = 0; idx < timeseries.length; idx++) {
//     // scale to target loudness
//     let timeseries_adapted = timeseries[idx].map((ts) => targetGain * ts);

//     // Do the Fourier Transformation
//     dft.forward(timeseries_adapted);
//     utils.assert(B2P1 == dft.mag.length);

//     // Copy array of mel coefficients
//     let tmp = filter.getLogMelCoefficients(dft.mag, MIN_EXP, MAX_EXP);
//     image_adapted.push(
//       tmp.map((m) => {
//         return utils.map(m, 0, 255, 1, -1);
//       })
//     );
//   }

//   //let x = tf.tensor2d(image).reshape([1, RECORDBUFFER, nMelFilter, 1]);
//   let x = tf.tensor2d(image_adapted).reshape([1, RECORDBUFFER, nMelFilter, 1]);

//   model
//     .predict(x)
//     .data()
//     .then((result) => {
//       showPrediction(result);
//     })
//     .catch((err) => {
//       console.log(err);
//     });
// }

// function showPrediction(result) {
//   utils.assert(result.length == inputs.length);

//   const maxIdx = utils.indexOfMax(result);

//   let list = document.getElementById('result');
//   list.innerHTML = '';

//   for (let idx = 0; idx < result.length; idx++) {
//     let entry = document.createElement('li');
//     let span = document.createElement('span');
//     let textNode = document.createTextNode(`${inputs[idx].label}: ${result[idx].toFixed(2)}`);
//     if (idx == maxIdx) {
//       span.style.color = 'red';
//     }
//     span.appendChild(textNode);
//     entry.appendChild(span);
//     list.appendChild(entry);
//   }

//   //
//   const TRESHOLD = 0.9;
//   if (result[maxIdx] > TRESHOLD && maxIdx != 0) {
//     let div = document.getElementById('topresult');
//     div.innerHTML = '';
//     let entry = document.createElement('p');
//     let span = document.createElement('span');
//     let textNode;
//     textNode = document.createTextNode(
//       `last recognized class (threshold>${TRESHOLD}) except class1: ${inputs[maxIdx].label}`
//     );
//     span.appendChild(textNode);
//     entry.appendChild(span);
//     div.appendChild(entry);
//   }
// }

// predict_btn.addEventListener('click', () => {
//   const INTERVALL = 500; //predict every XXX ms
//   setInterval(() => {
//     tf.tidy(() => {
//       predict(SERIES_POS);
//     });
//   }, INTERVALL);
// });

// // who understands what is happening here, feel free to explain it to me :)
// function transpose(a) {
//   return a[0].map((_, c) => a.map((r) => utils.map(r[c], -1, 1, 255, 0)));
// }

// showImages_btn.addEventListener('click', async () => {
//   const surface = tfvis.visor().surface({
//     name: 'Recorded Images',
//     tab: 'Input Data',
//   });
//   const drawArea = surface.drawArea; // Get the examples
//   drawArea.innerHTML = '';
//   const MAX = 20;
//   for (let classIdx = 0; classIdx < inputs.length; classIdx++) {
//     const p = document.createElement('p');
//     p.innerText = inputs[classIdx].label;
//     drawArea.appendChild(p);
//     for (let idx = 0; idx < inputs[classIdx].data_adapted.length; idx++) {
//       if (idx >= MAX) {
//         break;
//       }
//       const canvas = document.createElement('canvas');
//       canvas.width = RECORDBUFFER + 2;
//       canvas.height = nMelFilter + 2;
//       canvas.style = 'margin: 1px; border: solid 1px';
//       await tf.browser.toPixels(transpose(inputs[classIdx].data_adapted[idx]).reverse(), canvas);
//       drawArea.appendChild(canvas);
//     }
//   }
// });

// const save_btn = document.getElementById('save_btn');
// save_btn.addEventListener('click', () => {
//   Store.saveData(inputs, 'data');
// });

// const load_btn = document.getElementById('load_btn');
// load_btn.addEventListener('click', () => {
//   inputs = Store.getData('data');
// });

// /**
//  * Accuracy and Confusion Matrix
//  */
// let classNames = [];

// for (let idx = 0; idx < inputs.length; idx++) {
//   classNames.push(inputs[idx].label);
// }

// function doPrediction() {
//   const data = createData();
//   const testxs = data.xs();
//   const labels = data.ys().argMax([-1]);
//   const preds = model.predict(testxs).argMax([-1]);
//   testxs.dispose();
//   return [preds, labels];
// }

// async function showAccuracy() {
//   const [preds, labels] = doPrediction();

//   const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds);
//   const container = {
//     name: 'Accuracy',
//     tab: 'Evaluation',
//   };
//   tfvis.show.perClassAccuracy(container, classAccuracy, classNames);
//   labels.dispose();
// }

// async function showConfusion() {
//   const [preds, labels] = doPrediction();
//   const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds);
//   const container = {
//     name: 'Confusion Matrix',
//     tab: 'Evaluation',
//   };
//   tfvis.render.confusionMatrix(container, {
//     values: confusionMatrix,
//     tickLabels: classNames,
//   });
//   labels.dispose();
// }

// document.querySelector('#show-accuracy').addEventListener('click', () => showAccuracy());
// document.querySelector('#show-confusion').addEventListener('click', () => showConfusion());
