const W = 600;
const H = 350;

const canvas = document.getElementById('fft-series');
const context = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

canvas.offScreenCanvas = document.createElement('canvas');
canvas.offScreenCanvas.width = canvas.width;
canvas.offScreenCanvas.height = canvas.height;

// FT Stuff
const BUFFERSIZE = 512;
const B2P1 = BUFFERSIZE / 2 + 1;
const FRAMESIZE = 200; // How many frames of size BUFFERSIZE
let DFT_Series = []; // ringbuffer
let DFT_Series_pos = FRAMESIZE - 1; // head of ringbuffer

// Prefill arrays
for (let idx = 0; idx < FRAMESIZE; idx++) {
  let ft_array = Array.from(Array(B2P1), () => 0);
  DFT_Series.push(ft_array);
}

const rainbow = [];
for (let idx = 0; idx < 256; idx++) {
  rainbow[idx] = `hsl(${idx},100%,50%)`;
}

function render() {
  context.drawImage(canvas.offScreenCanvas, 0, 0);
  requestAnimationFrame(render);
}

//render();

function draw() {
  //console.log('draw');
  //let _context = canvas.offScreenCanvas.getContext('2d');
  let _context = canvas.getContext('2d');
  let w = canvas.offScreenCanvas.width;
  let h = canvas.offScreenCanvas.height;

  // Draw FT Time Series
  // _context.fillStyle = '#FFF';
  // _context.fillRect(0, 0, w, h);
  _context.clearRect(0, 0, w, h);

  let rectHeight = h / B2P1;
  let rectWidth = w / FRAMESIZE;
  console.log(rectHeight, rectWidth);
  let xpos = 0;
  let ypos;
  for (let xidx = DFT_Series_pos + 1; xidx <= DFT_Series_pos + FRAMESIZE; xidx++) {
    ypos = h;
    for (let yidx = 0; yidx < B2P1; yidx++) {
      _context.fillStyle = rainbow[Math.floor(Math.random() * 255)];
      _context.fillRect(xpos, ypos, rectWidth, -rectHeight);
      ypos -= rectHeight;
    }
    xpos += rectWidth;
  }
  _context.strokeRect(0, 0, w, h);

  //setTimeout(draw, 100);
  requestAnimationFrame(draw);
}

draw();

//setInterval(draw, 20);
