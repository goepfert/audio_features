const context = new AudioContext();

/**
 * Handle mic data
 */
const handleSuccess = function (stream) {
  console.log('handle success');
  const source = context.createMediaStreamSource(stream);

  // Create a ScriptProcessorNode
  const processor = context.createScriptProcessor(4096, 1, 1);
  // since I can not increase this buffer, decrease Time Interval in loudness calculation

  source.connect(processor);
  processor.connect(context.destination);

  const loudness = new LoudnessSample(context.sampleRate);
  loudness.printSomeInfo();

  let debug = 0;

  processor.onaudioprocess = function (e) {
    if (debug > 10) {
      //return;
    }
    const inputBuffer = e.inputBuffer;
    timeDomainData = inputBuffer.getChannelData(0);

    console.log(loudness.calculateLoudness(timeDomainData));

    debug++;
  };
};

/** Kicks off Mic data handle function
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 */
navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then(handleSuccess)
  .catch((err) => console.log(err));
