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
    data: []
  },
  {
    label: 'class2',
    data: []
  }
];

function record(label) {
  console.log(inputs[inputs.findIndex(input => input.label == label)].data);
}
