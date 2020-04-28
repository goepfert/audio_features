console.log('hello');

let length = 8;
let buffer = Array.from(Array(length), () => Math.random());
console.log(buffer);

// DFT
const dft = new DFT(buffer.length);
let cpyBuffer = Array.from(buffer);
dft.forward(cpyBuffer);
console.log(dft.mag);

// FFT
let real = Array.from(buffer);
let imag = Array.from(Array(buffer.length), () => 0);

console.log('real', real);
console.log('imag', imag);
const fft = createFFT();

fft.transform(real, imag);
console.log('real', real);
console.log('imag', imag);


console.log('mag', fft.getMagnitude(buffer));
console.log('power', fft.getPowerspectrum(buffer));
