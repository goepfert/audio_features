/**
 * Circular Buffer
 *
 * Custom made, not a general purpose ringbuffer
 * Construct with given length, concat buffer with a length that is an integer fraction of that length
 * Use getLength, getData and getIndex to work with elements of that ringbuffer
 *
 * author: Thomas Goepfert
 */

class CircularBuffer {
  constructor(length) {
    this.myBuffer = Array.from(Array(length), () => 0);
    this.length = length;
    this.head = 0;
    this.isFull = false;
  }

  validate(buffer) {
    if (!this.isBuffer(buffer)) {
      console.log(buffer);
      throw new Error('Argument should be an AudioBuffer instance and comply with some assumptions');
    }
  }

  /**
   *
   */
  isBuffer(buffer) {
    return (
      buffer != null &&
      this.length % buffer.length === 0 && // fromBuffer.length must be integer fraction of myAudioBuffer.length
      this.length - this.head >= buffer.length
    ); // still fits?
  }

  /**
   * Copy data from fromBuffer to myBuffer at head position
   */
  concat(fromBuffer) {
    this.validate(fromBuffer);

    //copy data from fromBuffer at head Position in myAudioBuffer
    let headpos = this.head;
    for (let idx = 0; idx < fromBuffer.length; idx++) {
      this.myBuffer[headpos + idx] = fromBuffer[idx];
    }

    this.head += fromBuffer.length;
    if (this.head >= this.length) {
      this.head = 0;
      this.isFull = true;
    }
  }

  getHeadPos() {
    return this.head;
  }

  /**
   * get length of valid data
   * only smaller than total length if not 'full'
   */
  getLength() {
    let length;
    if (this.isFull) {
      length = this.length;
    } else {
      length = this.head;
    }

    return length;
  }

  /**
   * returns ArrayBuffer of given channel
   * use index from getIndex(index) and length from getLength
   */
  getData() {
    return this.myBuffer;
  }

  /**
   * return the internal ringbuffer index
   */
  getIndex(index) {
    let internalIndex;
    if (this.isFull) {
      //if it's full, length is fixed
      let hpi = this.head + index;
      if (hpi < this.length) {
        internalIndex = hpi;
      } else {
        // modulo operation takes sometimes too much ressources, never found out why but flame graph says that this function takes a significant time
        // just taking the difference is working in this case since index should be smaller than length
        internalIndex = hpi - this.length;
        //internalIndex = hpi % this.length;
      }
    } else {
      internalIndex = index;
    }

    return internalIndex;
  }
}
