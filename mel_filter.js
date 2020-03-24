let mel_filter = function() {

    let _samplerate;
    let _nfft;
    let _lowFreq;
    let _highFreq;
    let _nMel;

    let _lowMel;
    let _highMel;
    let _dMel;

    let _m = []; // mel filter points (equally spaced in mel space)
    let _h = []; // filter point in frequency domain
    let _f = []; // map _h to nearest FT bin 

    function init(samplerate, nfft, lowFreq, highFreq, nMel) {
        _samplerate = samplerate;
        _nfft = nfft;
        _lowFreq = lowFreq;
        _highFreq = highFreq;
        _nMel = nMel;

        _lowMel = fToMel(_lowFreq);
        _highMel = fToMel(_highFreq);
        _dMel = (_highMel - _lowMel) / (_nMel+1);

        calculate_Mi();
        calculate_Fi();
    }

    function calculate_Mi() {
        _m.push(_lowMel);
        for(let i=0; i<_nMel; i++) {
            _m.push(_m[i] + _dMel);
        }
        _m.push(_highMel);
    }

    function calculate_Fi() {
        _h = _m.map( (m)=> melToF(m) );
    }

    function convertToBins() {
        _f = _h.map((m) => Math.floor(_nfft+1) * m / _samplerate);
    }


    function fToMel(f) {
        return 2595. * Math.log10(1. + f/700.);
    }

    function melToF(m) {
        return 700. * (Math.pow(10, m/2595.) - 1.);
    }

    function print() {
        console.log(_m);
        console.log(_h);
        console.log(_f);
    }

    return {
        init: init,
        print: print,
    }
}

const filter = mel_filter();
filter.init(48000, 256, 300, 8000, 10);
filter.print();