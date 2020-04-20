console.log('test');

const RB_SIZE = 10;
const FRAME_SIZE = 4;
const FRAME_STRIDE = 2;

const timeDomainData = new CircularBuffer(RB_SIZE);

let data = [1, 2];
timeDomainData.concat(data);
timeDomainData.concat([3, 4]);
timeDomainData.concat([5, 6]);
timeDomainData.concat([7, 8]);
timeDomainData.concat([9, 10]);
console.log(timeDomainData);

console.log(timeDomainData.getSlice(0, 9));
