const fft = new DFT(8);

const data = Array.from(Array(8), () => 0);
data[0] = 1;

fft.forward(data);

console.log('data', data);
fft.print();

for (let i = -10; i <= 10; i++) {
  let newval = utils.constrain(i, -5, 5);
  console.log(i, utils.map(i, -5, 5, 0, 255), newval, utils.map(newval, -5, 5, 0, 255));
}

// Training Data
let inputs = [
  {
    label: 'class1',
    data: [],
  },
  {
    label: 'class2',
    data: [],
  },
];

function record(label) {
  console.log(inputs[inputs.findIndex((input) => input.label == label)].data);
}

const samplerate = 48000;
const BUFFER_SIZE = 1024; // the chunks we get from the input source (e.g. the mic)
const FRAME_SIZE = samplerate * 0.025; // Frame_time == 25 ms
const FRAME_STRIDE = samplerate * 0.01; // Frame_stride == 10 ms (=> 15 ms overlap)

const buffertime = 1; // in seconds
const RECORD_SIZE = Math.floor((samplerate * buffertime) / BUFFER_SIZE) * BUFFER_SIZE;

console.log(BUFFER_SIZE, RECORD_SIZE);
