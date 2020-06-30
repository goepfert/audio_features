# Audio Feature Extractor

Demonstrator project for speech recognition featuring several technologies:

- Web Audio API
- Mel Frequency Cepstral Coefficients
- Convolutional Neural Networks (with tensorlow.js)
- Voice Activity Detection
- Speech Recognition (phrase detection of about 1 second)
- Based on plain javascript with some html and css

Some tests located in the _test_ folder and are only here for reference.

Some not used algorithms located in the _tmp_ folder. E.g. the not so fast direct fourier transformation or the direct cosine transform. They are just here for the record but not needed (anymore).

## Workflow

Record microphone input and get the samples with the help of the Web Audio API.

### Preprocessing Microphone Data

- create mel spectrogram of time domain data
  - frame size 25 ms, stride 10 ms (i.e. 15 ms overlap)
  - hamming window, fft - power spectrum
  - 40 mel filters from 300 Hz to 8 kHz
  - configurable, but above parameters are said to be reasonable
- save mel spectrogram in ringbuffer of about 2 seconds

All other algorithms are now working on this recorded _history_ and are thus looking into the past. The two second ringbuffer is a bit oversized since the speech recognition is only using about one second. But its useful for illustration purpose.

### Voice Activity Detection

Classification uses only two classes per default. Class 1: background or non-speech and class 2: speech.

The Network architcture is relativly simple and should be quite fast or more specifically shouldn't need too many mips compared to the network used for speech recognition. The idea is that the speech reconition network gets only active if voice activity was detected/classified before.

There are three main reasons using a voice activity detection as a prefilter:

1. As already mentioned saving some mips. Can be relevent when running e.g. on mobile or embedded devices.
2. There is no need to train the subsequent Speech Network on background or Non-Speech events.
3. There is now a distinct trigger in time when speech shall be recognized.

**Network Architecture**

- CNN on 40x40 image (40 frames, 40 mel filterbank coefficients)

| Layer             | Output Shape | Kernel Size |
| ----------------- | ------------ | ----------- |
| 3x Convolution 2d | 20-10-5      | 5x5         |
| Dense             | 200          | -           |
| Softmax           | 2            | -           |

The classification uses a stride of 50%, i.e. every 20 frames. For the final decision the results of the overlapping sections are simply averaged. To be honest ... no specific reason, just to get something smoother.

**Training**

It records a couple (10 by default) of _images_ (the 40x40 image) in a concecutive way. Just keep saying words (for class2) or do background stuff until the record is finished.

The recorded data can be saved to a file. If loaded again one can continue recording new data.

If trained, the model can be saved as well. And of course loaded afterwards. One usecase would be that you can now continue traing with new/extended data on a pre-trained model (no parameters are freezed).

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
