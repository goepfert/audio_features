/**
 * main app
 *
 * remark: rought cutout to get a working example
 *
 * author: Thomas Goepfert
 */

'use strict';

// It all starts with a context
let audioContext; // = new AudioContext({ samplerate: 48000 });

const samplerate = 48000;

// Buffer sizes
const BUFFER_SIZE = 1024; // the chunks we get from the input source (e.g. the mic)
const FRAME_SIZE = samplerate * 0.025; // Frame_time == 25 ms
const FRAME_STRIDE = samplerate * 0.01; // Frame_stride == 10 ms (=> 15 ms overlap)

// ASR
const buffertime = 1; // in seconds
const RECORD_SIZE = Math.floor((samplerate * buffertime) / BUFFER_SIZE) * BUFFER_SIZE; // ~buffertime in number of samples, ensure integer fraction size of concat

// Ringbuffer Time Domain (1D)
const RB_SIZE = 2 * RECORD_SIZE; // arbitrary choice, shall be gt RECORD_SIZE and integer fraction of BUFFER_SIZE
const timeDomainData = new CircularBuffer(RB_SIZE);

// RingBuffer Framing (2D)
const RB_SIZE_FRAMING = utils.getNumberOfFrames(RB_SIZE, FRAME_SIZE, FRAME_STRIDE); // how many frames with overlap fit into time domain ringbuffer
const RECORD_SIZE_FRAMING = utils.getNumberOfFrames(RECORD_SIZE, FRAME_SIZE, FRAME_STRIDE); // number of frames in record
let Data_Pos = 0; // head position
const DFT_Data = []; // after fourier transform [B2P1][RB_SIZE_FRAMING]
const MEL_RAW = []; // mel filter coefficients
const LOG_MEL = []; // log mel filter coefficients after some scaling for visualization

// Hamming Window
const fenster = createWindowing(FRAME_SIZE); // don't call it window ...

// DFT
const fft = createFFT(FRAME_SIZE);
const B2P1 = FRAME_SIZE / 2 + 1; // Length of frequency domain data

// Mel Filter
const N_MEL_FILTER = 40; // Number of Mel Filterbanks (power of 2 for DCT)
const filter = mel_filter();
const MIN_FREQUENCY = 300; // lower end of first mel filter bank
// TODO: if we cut off frequencies above 8 kHz, we may save some mips if we downsample e.g. to 16 kHz before (low pass and taking every third sample if we have 48 kHz)
const MAX_FREQUENCY = 8000; // upper end of last mel filterbank
filter.init(samplerate, FRAME_SIZE, MIN_FREQUENCY, MAX_FREQUENCY, N_MEL_FILTER);

// VAD - https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6150492/
// I want to get an quadratic image, thus
const VAD_SIZE = N_MEL_FILTER;
const VAD_TIME = utils.getSizeOfBuffer(N_MEL_FILTER, FRAME_SIZE, FRAME_STRIDE) / samplerate;
console.log('VAD TIME', VAD_TIME);
const VAD_IMG = [];
const VAD_RESULT = []; // result of VAD saved in an array
const VAD_THRESHOLD = 0.5; // the VAD threshold, if hit do speech recognition otherwise not
const THRESHOLD = 0.85; // threshold if speech class is recognized or not
const VAD_N_SNAPSHOTS = 10;
const VAD_OVERLAP = 0.5;
let VAD_LAST_POS = 0;
let VAD_AVERAGE = 0;

// Datasets
const NCLASSES = 8; // How many classes to classify (normally, the first class refers to the background)
const dataset_speech = createDataset(NCLASSES, RECORD_SIZE_FRAMING, N_MEL_FILTER, 0.2);
const dataset_vad = createDataset(2, VAD_SIZE, N_MEL_FILTER, 0.2);
let trained_data_speech = undefined;
let trained_data_vad = undefined;
let is_trained_speech = false;
let is_trained_vad = false;

// Data augmentation
const N_AUG = 4;
const FRACTION = 0.25; // horizontal shift fraction
const opt = { fill_mode: 'nearest' };
const generator = createImageDataGenerator(opt);

// Neural Network
let nn_speech = createNetwork(RECORD_SIZE_FRAMING, N_MEL_FILTER, NCLASSES);
let model_speech;
const nn_vad = createNetwork_VAD(N_MEL_FILTER, N_MEL_FILTER, 2);
let model_vad;

const NORMALIZE_FCN = utils.standardize;

const SPEECH_IMG = [];
const PRED_INTERVAL = 250;
const PRED_SUSPEND = 4; // suspend prediction x times intervall
let suspend = 1;

//console.log(samplerate, BUFFER_SIZE, FRAME_SIZE, FRAME_STRIDE, RB_SIZE, RB_SIZE_FRAMING, N_DCT, RECORD_SIZE);

// Plotting
const ANIM_INTERVALL = 100;
let STARTFRAME; // Recording Startframe (used for drawing)
let ENDFRAME; // Recording Endframe (used for drawing)
const MIN_EXP = -1; // 10^{min_exp} linear, log scale minimum
const MAX_EXP = 3; // 10^{max_exp} linear, log scale max

// Prefill arrays
for (let idx = 0; idx < RB_SIZE_FRAMING; idx++) {
  let ft_array = Array.from(Array(B2P1), () => 0);
  DFT_Data.push(ft_array);

  let mel_raw_array = Array.from(Array(N_MEL_FILTER), () => 0);
  MEL_RAW.push(mel_raw_array);

  let mel_array = Array.from(Array(N_MEL_FILTER), () => 255);
  LOG_MEL.push(mel_array);

  VAD_RESULT.push(0);
}

for (let idx = 0; idx < RECORD_SIZE_FRAMING; idx++) {
  let speech_array = Array.from(Array(N_MEL_FILTER), () => 255);
  SPEECH_IMG.push(speech_array);
}

for (let idx = 0; idx < VAD_SIZE; idx++) {
  let vad_array = Array.from(Array(N_MEL_FILTER), () => 255);
  VAD_IMG.push(vad_array);
}

// Canvas width and height
let drawit = [false, false, true, true, true];
let canvas;
let canvasCtx;
let canvas_fftSeries;
let context_fftSeries;
let canvas_fftSeries_mel;
let context_fftSeries_mel;
let canvas_fftSeries_speech;
let context_fftSeries_speech;
let canvas_vad_meter;
let context_vad_meter;
let canvas_speech_meter = [];
let context_speech_meter = [];
let label_speech = [];
(function create_some_stuff() {
  if (drawit[0]) {
    canvas = document.getElementById('oscilloscope');
    canvasCtx = canvas.getContext('2d');
    canvas.width = 2 * RB_SIZE_FRAMING;
    canvas.height = 100; //B2P1;
  }

  if (drawit[1]) {
    canvas_fftSeries = document.getElementById('fft-series');
    context_fftSeries = canvas_fftSeries.getContext('2d');
    canvas_fftSeries.width = 2 * RB_SIZE_FRAMING;
    canvas_fftSeries.height = B2P1;
  }

  if (drawit[2]) {
    canvas_fftSeries_mel = document.getElementById('fft-series mel');
    context_fftSeries_mel = canvas_fftSeries_mel.getContext('2d');
    canvas_fftSeries_mel.width = 4 * RB_SIZE_FRAMING;
    canvas_fftSeries_mel.height = 4 * N_MEL_FILTER;
  }

  if (drawit[3]) {
    canvas_fftSeries_speech = document.getElementById('fft-series speech');
    context_fftSeries_speech = canvas_fftSeries_speech.getContext('2d');
    canvas_fftSeries_speech.width = 4 * RB_SIZE_FRAMING;
    canvas_fftSeries_speech.height = 4 * N_MEL_FILTER;
  }

  if (drawit[4]) {
    canvas_vad_meter = document.getElementById('vad meter');
    context_vad_meter = canvas_vad_meter.getContext('2d');
    canvas_vad_meter.width = canvas_fftSeries_speech.width;
    canvas_vad_meter.height = 40;

    //create speech canvas dynamically
    const container = document.getElementById('speech meter container');

    const classnames = ['one', 'two', 'three', 'four', 'up', 'down', 'left', 'right', 'other'];

    for (let classIdx = 0; classIdx < NCLASSES; classIdx++) {
      const subcontainer = document.createElement('div');
      subcontainer.classList.add('row');

      let canvas = document.createElement('canvas');
      canvas.width = 4 * RB_SIZE_FRAMING;
      canvas.height = 40;
      canvas.id = `speech class${classIdx + 1}`;
      const label = document.createElement('label');
      //label.innerHTML = `class${classIdx + 1}`;
      label.innerHTML = `${classnames[classIdx]}`;
      label.htmlFor = `speech class${classIdx + 1}`;

      label_speech.push(label);

      let context = canvas.getContext('2d');

      subcontainer.appendChild(label);
      subcontainer.appendChild(canvas);

      container.appendChild(subcontainer);
      //container.appendChild(document.createElement('br'));
      canvas_speech_meter.push(canvas);
      context_speech_meter.push(context);
    }
  }
})();

/**
 * Handle mic data
 */
const handleSuccess = function (stream) {
  console.log('handle success');

  audioContext = new AudioContext({ samplerate: samplerate });

  const source = audioContext.createMediaStreamSource(stream);

  // Create a ScriptProcessorNode
  const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = function (e) {
    const inputBuffer = e.inputBuffer;
    timeDomainData.concat(inputBuffer.getChannelData(0));

    doFraming();
    doVAD();

    // Clear frames (for drawing start and end of vertical line when recording)
    if (STARTFRAME == Data_Pos) {
      STARTFRAME = undefined;
    }
    if (ENDFRAME == Data_Pos) {
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

let nextStartPos = 0;
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
    const mag = fft.getPowerspectrum(frame_buffer);
    DFT_Data[Data_Pos] = utils.logRangeMapBuffer(mag, MIN_EXP, MAX_EXP, 255, 0);

    // MelFilter;
    let mel_array = filter.getMelCoefficients(mag);

    MEL_RAW[Data_Pos] = mel_array;
    LOG_MEL[Data_Pos] = utils.logRangeMapBuffer(mel_array, MIN_EXP, MAX_EXP, 255, 0);

    // Bookeeping
    Data_Pos = (Data_Pos + 1) % RB_SIZE_FRAMING;
    startPos = (startPos + FRAME_STRIDE) % RB_SIZE;
    endPos = (endPos + FRAME_STRIDE) % RB_SIZE;
  }

  nextStartPos = startPos;
}

let vad_prevEndPos = 0;
let vad_nextStartPos = 0;
function doVAD() {
  // check if you have enough data for VAD
  let availableData = Data_Pos - vad_nextStartPos;

  if (availableData < 0) {
    availableData = Data_Pos + RB_SIZE_FRAMING - vad_nextStartPos;
  }

  if (availableData < VAD_SIZE || model_vad == undefined) {
    return;
  }

  showMeter_VAD();

  let curpos = vad_nextStartPos;
  let endPos = (vad_nextStartPos + VAD_SIZE) % RB_SIZE_FRAMING;

  //console.log('a', vad_nextStartPos, endPos, vad_prevEndPos);

  // copy image
  for (let idx = 0; idx < RB_SIZE_FRAMING; idx++) {
    VAD_IMG[idx] = Array.from(MEL_RAW[curpos]);

    curpos++;
    if (curpos >= RB_SIZE_FRAMING) {
      curpos = 0;
    }
    if (curpos == endPos) {
      break;
    }
  }

  utils.powerToDecibels2D(VAD_IMG);
  //NORMALIZE_FCN(VAD_IMG);

  // make vad prediction and fill result
  // do some averaging when overlapping (does not look very efficient though)
  // and ... do it sychronously !!! otherwise the variables may get alterd after this fcn
  curpos = vad_nextStartPos;
  tf.tidy(() => {
    //get voice activity in current frame
    let x = tf.tensor2d(VAD_IMG).reshape([1, VAD_SIZE, N_MEL_FILTER, 1]);

    const res = model_vad.predict(x);
    const result = res.dataSync();

    // console.log('b', vad_nextStartPos, endPos, vad_prevEndPos);

    let hit = false;
    for (let idx = 0; idx < RB_SIZE_FRAMING; idx++) {
      if (curpos == vad_prevEndPos) {
        hit = true;
      }
      if (!hit) {
        VAD_RESULT[curpos] = (VAD_RESULT[curpos] + result[1]) / 2;
      } else {
        VAD_RESULT[curpos] = result[1];
      }

      curpos++;
      if (curpos >= RB_SIZE_FRAMING) {
        curpos = 0;
      }
      if (curpos == endPos) {
        break;
      }
      // do it in here :)
      vad_prevEndPos = endPos;
    }
  });

  // last
  VAD_LAST_POS = vad_nextStartPos + VAD_SIZE;
  // new pos with some overlap
  vad_nextStartPos = Math.round(vad_nextStartPos + (1 - VAD_OVERLAP) * VAD_SIZE);

  vad_nextStartPos = vad_nextStartPos % RB_SIZE_FRAMING;
  VAD_LAST_POS = VAD_LAST_POS % RB_SIZE_FRAMING;

  averageVAD(Data_Pos);

  //console.log(VAD_AVERAGE);
}

/**
 * average VAD over the record size
 */
function averageVAD(endPos) {
  // some averaging
  let startFrame = endPos - RECORD_SIZE_FRAMING;
  if (startFrame < 0) {
    startFrame = RB_SIZE_FRAMING + startFrame;
  }

  // check for voice activity
  let curpos = startFrame;
  let size = 0;
  // likely that the last vad is not yet calculated
  for (let idx = 0; idx < RECORD_SIZE_FRAMING; idx++) {
    VAD_AVERAGE += VAD_RESULT[curpos];
    curpos++;
    size++;
    if (curpos >= RB_SIZE_FRAMING) {
      curpos = 0;
    }
    if (curpos == VAD_LAST_POS) {
      break;
    }
  }
  VAD_AVERAGE /= size;
}

function showMeter_VAD() {
  let meter_div = document.getElementById('meter');
  meter_div.style.display = 'block';

  let meter_vad_div = document.getElementById('meter_vad');
  meter_vad_div.style.display = 'block';
}

function showMeter_speech() {
  let meter_div = document.getElementById('meter');
  meter_div.style.display = 'block';

  let meter_speech_div = document.getElementById('meter_speech');
  meter_speech_div.style.display = 'block';
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

    let rectHeight = canvas_fftSeries_mel.height / N_MEL_FILTER;
    let rectWidth = canvas_fftSeries_mel.width / RB_SIZE_FRAMING;
    let xpos = 0;
    for (let xidx = Data_Pos; xidx < Data_Pos + RB_SIZE_FRAMING; xidx++) {
      let ypos = canvas_fftSeries_mel.height;
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

    // Draw VAD on top
    context_fftSeries_mel.beginPath();
    context_fftSeries_mel.lineWidth = 3;
    context_fftSeries_mel.strokeStyle = '#990000';
    let sliceWidth = canvas_fftSeries_mel.width / RB_SIZE_FRAMING;
    xpos = 0;
    //let timearray = timeDomainData.getSlice(timeDomainData.lastHead, timeDomainData.head);
    for (let xidx = Data_Pos; xidx < Data_Pos + RB_SIZE_FRAMING; xidx++) {
      if (xidx % RB_SIZE_FRAMING == VAD_LAST_POS) {
        break;
      }

      let v = 1 - VAD_RESULT[xidx % RB_SIZE_FRAMING];
      //console.log(v);
      let y = v * canvas_fftSeries_mel.height;
      if (xidx === Data_Pos) {
        context_fftSeries_mel.moveTo(xpos, y);
      } else {
        context_fftSeries_mel.lineTo(xpos, y);
      }
      xpos += sliceWidth;
    }
    context_fftSeries_mel.stroke();
  }

  // Draw Pred image
  if (drawit[3]) {
    context_fftSeries_speech.fillStyle = '#FFF';
    context_fftSeries_speech.fillRect(0, 0, canvas_fftSeries_speech.width, canvas_fftSeries_speech.height);

    let rectHeight = canvas_fftSeries_speech.height / N_MEL_FILTER;
    let rectWidth = canvas_fftSeries_speech.width / RB_SIZE_FRAMING;
    let xpos = (SPEECH_IMG.length + 2) * rectWidth; // magic

    for (let xidx = 0; xidx < SPEECH_IMG.length; xidx++) {
      let ypos = canvas_fftSeries_speech.height;
      for (let yidx = 0; yidx < N_MEL_FILTER; yidx++) {
        mag = SPEECH_IMG[xidx][yidx];
        mag = Math.round(mag);
        context_fftSeries_speech.fillStyle = utils.rainbow[mag];
        context_fftSeries_speech.fillRect(xpos, ypos, rectWidth, -rectHeight);
        ypos -= rectHeight;
      }
      xpos += rectWidth;
    }

    context_fftSeries_speech.strokeRect(
      (SPEECH_IMG.length + 2) * rectWidth,
      0,
      canvas_fftSeries_speech.width,
      canvas_fftSeries_speech.height
    );
  }

  // VAD Meter
  if (drawit[4]) {
    const rectHeight = canvas_vad_meter.height;
    const rectWidth = canvas_vad_meter.width;
    context_vad_meter.clearRect(0, 0, rectWidth, rectHeight);
    if (VAD_AVERAGE > VAD_THRESHOLD) {
      context_vad_meter.fillStyle = 'red';
    } else {
      context_vad_meter.fillStyle = 'green';
    }
    context_vad_meter.fillRect(0, 0, VAD_AVERAGE * rectWidth, rectHeight);
  }

  // draw asap ... but wait some time to get other things done
  setTimeout(() => {
    requestAnimationFrame(draw);
  }, ANIM_INTERVALL);
}; // end draw fcn

draw();

/**
 * Predict section
 */
function predict(endFrame) {
  //console.log(utils.getTime());

  showMeter_speech();

  let startFrame = endFrame - RECORD_SIZE_FRAMING;
  if (startFrame < 0) {
    startFrame = RB_SIZE_FRAMING + startFrame;
  }

  //console.log(utils.getTime(), 'voice activity detected:', VAD_AVERAGE);

  if (VAD_AVERAGE > VAD_THRESHOLD || model_vad == undefined) {
    suspend = PRED_SUSPEND;

    let image = [];
    let curpos = startFrame;
    for (let idx = 0; idx < RECORD_SIZE_FRAMING; idx++) {
      image[idx] = Array.from(MEL_RAW[curpos]);
      SPEECH_IMG[idx] = Array.from(LOG_MEL[curpos]);

      curpos++;
      if (curpos >= RB_SIZE_FRAMING) {
        curpos = 0;
      }
      if (curpos == endFrame) {
        break;
      }
    }

    utils.powerToDecibels2D(image);
    NORMALIZE_FCN(image); //check which what option the nn was trained!

    let x = tf.tensor2d(image).reshape([1, RECORD_SIZE_FRAMING, N_MEL_FILTER, 1]);

    utils.assert(model_speech != undefined, 'not trained yet?');

    model_speech
      .predict(x)
      .data()
      .then((result) => {
        showPrediction(result);
      })
      .catch((err) => {
        console.log(err);
      });

    x.dispose();
  } else {
    suspend = 1;
  }

  setTimeout(() => {
    tf.tidy(() => {
      predict(Data_Pos);
    });
  }, PRED_INTERVAL * suspend);
}

function showPrediction(result) {
  const inputs = dataset_speech.getInputs();
  utils.assert(result.length == inputs.length);

  const maxIdx = utils.indexOfMax(result);
  console.log('top result', maxIdx, result[maxIdx]);

  for (let idx = 0; idx < result.length; idx++) {
    if (idx == maxIdx) {
      label_speech[idx].style.color = 'red';
    } else {
      label_speech[idx].style.color = null;
    }

    const rectHeight = canvas_speech_meter[idx].height;
    const rectWidth = canvas_speech_meter[idx].width;
    context_speech_meter[idx].clearRect(0, 0, rectWidth, rectHeight);

    if (result[idx] > THRESHOLD) {
      context_speech_meter[idx].fillStyle = 'red';
    } else {
      context_speech_meter[idx].fillStyle = 'green';
    }
    context_speech_meter[idx].fillRect(0, 0, result[idx] * rectWidth, rectHeight);
  }
}

async function init() {
  model_vad = await tf.loadLayersModel(
    'https://raw.githubusercontent.com/goepfert/audio_features/master/docs/data/vad_model_name.json'
  );
  console.log(model_vad);

  model_speech = await tf.loadLayersModel(
    'https://raw.githubusercontent.com/goepfert/audio_features/master/docs/data/speech_model_name.json'
  );

  console.log(model_speech);

  tf.tidy(() => {
    predict(Data_Pos);
  });
}

init();
