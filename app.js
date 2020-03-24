/**
 * external plot libs
 * just here for reference
 */

let graph_div = document.getElementById('div_g1');
let mag_div = document.getElementById('div_g2');
let phase_div = document.getElementById('div_g3');
let inverse_div = document.getElementById('div_g4');


let data1 = [[0, 0]];
let data2 = [[0, 0]];
let data3 = [[0, 0]];
let data4 = [[0, 0]];

let graph1 = new Dygraph(graph_div, data1, {
  drawPoints: true,
  showRoller: true,
  valueRange: [-1.0, 1.0]
});

let graph2 = new Dygraph(mag_div, data2, {
  drawPoints: true,
  showRoller: true,
  logscale: true,
  valueRange: [1e-2, 100.0]
});

let graph3 = new Dygraph(phase_div, data3, {
  drawPoints: true,
  showRoller: true,
  valueRange: [-4, 4]
});

let graph4 = new Dygraph(inverse_div, data4, {
  drawPoints: true,
  showRoller: true
  //valueRange: [-1.0, 1.0]
});

const handleSuccess = function (stream) {
  console.log('handle');
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);

  // Create a ScriptProcessorNode with a bufferSize of 1024 and a single input and output channel
  // 48 kHz sampling rate, 1024 samples => 21.3 ms
  const BUFFERSIZE = 512;
  const processor = context.createScriptProcessor(BUFFERSIZE, 1, 1);

  source.connect(processor);
  processor.connect(context.destination);

  const fft = new DFT(BUFFERSIZE);
  const ifft = new DFT(BUFFERSIZE);

  // Prefill arrays
  data1 = [];
  for (let idx = 0; idx < BUFFERSIZE; idx++) {
    data1.push([idx, 0]);
  }

  data2 = [];
  for (let idx = 0; idx < BUFFERSIZE / 2 + 1; idx++) {
    data2.push([idx, 0]);
  }

  data3 = [];
  for (let idx = 0; idx < BUFFERSIZE / 2 + 1; idx++) {
    data3.push([idx, 0]);
  }

  data4 = [];
  for (let idx = 0; idx < BUFFERSIZE; idx++) {
    data4.push([idx, 0]);
  }

  let debug = 0;
  processor.onaudioprocess = function (e) {
    const inputBuffer = e.inputBuffer;
    const nowBuffering = inputBuffer.getChannelData(0);
    // Plot time series
    nowBuffering.forEach((element, index) => {
      data1[index] = [index, element];
    });

    // Do the Fourier Transformation
    fft.forward(nowBuffering);

    // The magnitude
    fft.mag.forEach((element, index) => {
      data2[index] = [index, element];
    });

    // And phase
    fft.phase.forEach((element, index) => {
      data3[index] = [index, element];
    });

    // Inverse DFT
    if (debug < 1) {
      let inverse = Array.from(new Array(BUFFERSIZE), () => 0);
      ifft.mag = fft.mag;
      ifft.phase = fft.phase;
      ifft.inverse(inverse);
      inverse.forEach((element, index) => {
        data4[index] = [index, element];
      });
      console.log('-------');
      ifft.print();
      console.log('inverse', inverse);
      debug++;
    }

  };
};

//https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then(handleSuccess)
  .catch(err => console.log(err));

const draw = function () {
  requestAnimationFrame(draw);

  graph1.updateOptions({ file: data1 });
  graph2.updateOptions({ file: data2 });
  graph3.updateOptions({ file: data3 });
  graph4.updateOptions({ file: data4 });
};

draw();
