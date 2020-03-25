const fft = new DFT(8);

const data = Array.from(Array(8), () => 0);
data[0] = 1;

fft.forward(data);

console.log('data', data);
fft.print();

for (let i = 0; i <= 12; i++) {
  let val = i * 10;
  console.log(val, map(val, 0, 100, 0, 255));
}
