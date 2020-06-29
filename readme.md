# Audio Feature Extractor

Demonstrator project featuring several technologies

- Web Audio API
- Mel Frequency Cepstral Coefficients
- Convolutional Neural Networks (with tensorlow.js)
- Voice Activity Detection
- Speech Recognition (phrase detection of about 1 second)

Some tests located in the _test_ folder.

Some not used algorithms located in the _tmp_ folder. E.g. the not so fast direct fourier transformation or the direct cosine transform. They are just here for the record but not needed (anymore).

## Workflow

record microphone input

### Preprocessing

- create mel spectrogram from time domain data
  - frame size 25 ms, stride 10 ms
  - hamming window, fft - power spectrum
  - 40 mel filters
  - configurable, but above parameters are said to be reasonable
- fill spectrogram in ringbuffer of about 2 seconds

All other algorithms are now working on this recorded _history_. The two second ringbuffer is oversized since the speech recognition is only using about one second. But its useful for illustration purpose.

### Voice Activity Detection - Training

### Speech Recognition - Training

### Voice Activity Detection

- CNN on 40x40 image (40 frames, 40 mel filterbank coefficients)
- trained on two classes (class 1: background, class 2: speech)
- continuous vad detection, stride 20 frames
  - average vad on overlapping segments

### Speech Recognition

- CNN on 1 second x 40 image (about 100 x 40)
- trigger network only if voice activit is detected

## Todo List

- find a solution for 'AutoplayIgnoreWebAudio'
- sample rate conversion to (48/3) 16 kHz (low pass and taking every third sample?) since I do vad and speech rec only up to 8 kHz
- REFACTOR :)
- toggle buttons to avoid unwanted clicking
- implement in node.js + express / electron ?

## Know Issues

- virtually no error handling!!!!
- some FF version don't open file open/save dialogue
- some crome version complain about autoplay and web audio api
  - workaround: 'chrome.exe --enable-features=AutoplayIgnoreWebAudio'
- reloads browser after saving a model???

## Resources

[Mel Frequency Cepstral Coefficient (MFCC) tutorial](http://practicalcryptography.com/miscellaneous/machine-learning/guide-mel-frequency-cepstral-coefficients-mfccs/)
[Audio Model with TensorFlow.js with Ping Yu](https://www.youtube.com/watch?v=-1QGEQWhmSI)
[A Convolutional Neural Network Smartphone App for Real-Time Voice Activity Detection](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6150492/)
Tons of information from the some cool people found on the internet!
