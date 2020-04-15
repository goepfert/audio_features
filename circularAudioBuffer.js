/**
 * Circular Ringbuffer for AudioBuffers
 *
 * Custom made, not a general purpose ringbuffer
 * Construct with given length, concat buffer with a length that is an integer fraction of that length
 * Use getLength, getMyChannelData and getIndex to work with elements of that ringbuffer
 * Since it it used for loudness calculation, it saves the sqares and not only the values
 *
 * author: Thomas Goepfert
 */

class CircularAudioBuffer {
  constructor(context, nChannels, length, sampleRate) {
    this.myAudioBuffer = context.createBuffer(nChannels, length, sampleRate);
    this.nChannels = nChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.head = 0;
    this.isFull = false;
  }

  validate(buffer) {
    if (!this.isAudioBuffer(buffer)) {
      console.log(buffer);
      throw new Error('Argument should be an AudioBuffer instance and comply with some assumptions');
    }
  }

  /**
   * inspired by https://github.com/audiojs/is-audio-buffer
   */
  isAudioBuffer(buffer) {
    return (
      buffer != null &&
      typeof buffer.length === 'number' &&
      typeof buffer.sampleRate === 'number' &&
      typeof buffer.getChannelData === 'function' &&
      typeof buffer.duration === 'number' &&
      buffer.numberOfChannels === this.nChannels &&
      buffer.sampleRate === this.sampleRate &&
      this.length % buffer.length === 0 && // fromBuffer.length must be integer fraction of myAudioBuffer.length
      this.length - this.head >= buffer.length
    ); // still fits?
  }

  /**
   * Copy data from fromBuffer to myAudioBuffer at head position
   */
  concat(fromBuffer) {
    this.validate(fromBuffer);

    //copy data from fromBuffer at head Position in myAudioBuffer
    for (let chIdx = 0; chIdx < this.nChannels; chIdx++) {
      //this.myAudioBuffer.getChannelData(chIdx).set(fromBuffer.getChannelData(chIdx), this.head);

      //save the squares
      let channelData = fromBuffer.getChannelData(chIdx);
      channelData = channelData.map((value) => Math.pow(value, 2));
      this.myAudioBuffer.getChannelData(chIdx).set(channelData, this.head);
    }

    this.head += fromBuffer.length;
    if (this.head >= this.length) {
      this.head = 0;
      this.isFull = true;
    }

    // console.log('new head:', this.head);
    // console.log('fromBuffer', fromBuffer.getChannelData(0));
    // console.log('myAudioBuffer', this.myAudioBuffer.getChannelData(0));
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
  getMyChannelData(channel) {
    return this.myAudioBuffer.getChannelData(channel);
  }

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
