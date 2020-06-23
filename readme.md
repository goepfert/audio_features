# Audio Feature Extractor

WORK in PROGRESS ... :)

Demonstrator project featuring several technologies

- Web Audio API
- Mel Frequency Cepstral Coefficients
- Convolutional Neural Networks
- Voice Activity Detection
- Speech Recognition

## Workflow

### Preprocessing


### Voice Activity Detection


### Speech Recognition


## Todo List

- find a solution for 'AutoplayIgnoreWebAudio'
- sample rate conversion to (48/3) 16 kHz (low pass and taking every third sample?) since I do vad and speech rec onlz up to 8 kHz
- REFACTOR :)
- implement in node.js / express ?


## Know Issues

- virtually no error handling !!!!
- 
 

## Resources

[Mel Frequency Cepstral Coefficient (MFCC) tutorial](http://practicalcryptography.com/miscellaneous/machine-learning/guide-mel-frequency-cepstral-coefficients-mfccs/)
[Audio Model with TensorFlow.js with Ping Yu](https://www.youtube.com/watch?v=-1QGEQWhmSI)
[A Convolutional Neural Network Smartphone App for Real-Time Voice Activity Detection](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6150492/)


## unsorted

chrome.exe --enable-features=AutoplayIgnoreWebAudio
