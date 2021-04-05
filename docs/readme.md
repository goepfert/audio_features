# Audio Feature Extractor

Demonstrator project for speech recognition featuring several technologies:

- Web Audio API
- Mel Frequency Cepstral Coefficients
- Convolutional Neural Networks (with tensorlow.js)
- Voice Activity Detection
- Speech Recognition (phrase detection of about 1 second)
- Based on plain javascript with some html and css

It can classify some number of spoken words, for expample, if voice activity was detected. All it's running in the clients browser.

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

The Network architcture is relativly simple and should be quite fast or more specifically shouldn't need too many mips compared to the network used for speech recognition. The idea is that the speech reconition network gets only active if voice activity was detected/classified before. The threshold can be adjusted and needs to be tuned. But 60% seems to be a good starter.

There are three main reasons using a voice activity detection as a prefilter:

1. As already mentioned saving some mips. Can be relevent when running e.g. on mobile or embedded devices.
2. There is no need to train the subsequent Speech Network on background or Non-Speech events. (But you still need a class for _any other word_ (or _not found_) in the Speech Network.)
3. There is now a distinct trigger in time when speech shall be recognized.

**Network Architecture**

- CNN on 40x40 image (40 frames, 40 mel filterbank coefficients)

Exemplary model layout:

| Layer             | Output Shape | Kernel Size | Strides |
| ----------------- | ------------ | ----------- | ------- |
| 3x Convolution 2d | 20-10-5      | 5x5         | 2x2     |
| Dense             | 200          | -           | -       |
| Softmax           | 2            | -           | -       |

The classification uses a stride of 50%, i.e. every 20 frames you get an new prediction of the voice activity of the last 40 frames. For the final decision the results of the overlapping sections are simply averaged. To be honest ... no specific reason why using overlaps, just to get something smoother. Probaly not needed and some mips can be saved setting it to 0%.

**Training**

To make things faster, it directly records a couple (10 by default) of _images_ (the 40x40 image) in a concecutive way. Just keep saying words (for class2) or do background stuff until the record is finished.

The recorded data can be saved to a file. If loaded again one can continue recording new data to enlarge the dataset.

If trained, the model can be saved as well. And of course loaded afterwards. One usecase would be that you can now continue traing with new/extended data on a pre-trained model (no parameters are freezed).

### Speech Recognition

Every 250 ms the algorithm checks if there was some voice activity within the last 1 second. Only if yes the Speech Reconition Network is triggerd and further checks are suspended for one second.

**Network Architecture**

- CNN on one second of mel coeffients (about 100 x 40).

Exemplary model layout:

| Layer          | Output Shape | Kernel / Pool Size | Strides |
| -------------- | ------------ | ------------------ | ------- |
| Convolution 2d | 93x39        | 4x2                | 1x1     |
| Max Pooling 2d | 46x19        | 2x2                | 2x2     |
| Convolution 2d | 43x18        | 4x2                | 1x1     |
| Max Pooling 2d | 21x9         | 2x2                | 2x2     |
| Convolution 2d | 18x8         | 4x2                | 1x1     |
| Max Pooling 2d | 9x4          | 2x2                | 2x2     |
| Dense          | 200          | -                  | -       |
| Softmax        | #classes     | -                  | -       |

**Training**

Per default four classes can be trained but any other number can be configured.

You can record one second of utterance. With this image some data augmentation is done. Currently it takes the images and randomly shifts it left or right. Per default five images are taken at onces.

### Saving and Loading

You can record sound examples (classes to classify) with your microphone. You can save the recorded data, save any trained model and reload data and model. Thus it is possible to continue trainig if new smaples has been recorded.

## Todo List

- find a solution for 'AutoplayIgnoreWebAudio'
- sample rate conversion to (48/3) 16 kHz (low pass and taking every third sample?) since I do vad and speech rec only up to 8 kHz
- REFACTOR :)
- toggle buttons to avoid unwanted clicking
- implement in node.js + express / electron ? -> currently it's all running in the clients browser

## Know Issues

- virtually no error handling!!!!
- some FF version don't open file open/save dialogue
- some crome version complain about autoplay and web audio api
  - workaround: 'chrome.exe --enable-features=AutoplayIgnoreWebAudio'
- reloads browser after saving a model or data???
- if you change the default name when saving a model it doesn't adjust the filename/path of the binary file in the json (manifest) - but if you load those files again, the name binary filename in the manifest [must match](https://js.tensorflow.org/api/latest/#io.browserFiles) -> workaround: if you adjust the filename, manually edit the json file and adjust the path in weightsManifest

## Resources

[Mel Frequency Cepstral Coefficient (MFCC) tutorial](http://practicalcryptography.com/miscellaneous/machine-learning/guide-mel-frequency-cepstral-coefficients-mfccs/)
[Audio Model with TensorFlow.js with Ping Yu](https://www.youtube.com/watch?v=-1QGEQWhmSI)
[A Convolutional Neural Network Smartphone App for Real-Time Voice Activity Detection](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6150492/)
Tons of information from the some cool people found on the internet!
