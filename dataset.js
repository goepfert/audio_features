/**
 * 
 */

function createDataset(num_classes, fraction_validation) {

    let _num_classes = num_classes;
    let _fraction_validation = fraction_validation;
    let _inputs = [];
    let _img_width = undefined;
    let _img_height = undefined;

    (function init() {
        console.log('init');
        for (let idx = 0; idx < _num_classes; idx++) {
            _inputs.push({
                label: `class${idx + 1}`, // class label
                data: [], // the unscaled image
            });

        }
    })();

    // add image with label to the record
    function addImage(image_buffer, label) {
        let index = _inputs.findIndex((input) => input.label == label);

        utils.assert(index != -1, "cannot find label");

        let img_width = image_buffer.length;
        if (_img_width != undefined) {
            utils.assert(img_width == _img_width, "image size mismatch: width");
        } else {
            _img_width = img_width;
        }

        let img_height = image_buffer[0].length;
        if (_img_height != undefined) {
            utils.assert(img_height == _img_height, "image size mismatch: height");
        } else {
            _img_height = img_height;
        }

        console.log(index);
        _inputs[index].data.push(image_buffer);
    };

    // shuffles to objects and preserve their relation
    function shuffle(obj1, obj2) {
        let index = obj1.length;
        let rnd, tmp1, tmp2;

        while (index) {
            rnd = Math.floor(Math.random() * index);
            index -= 1;
            tmp1 = obj1[index];
            tmp2 = obj2[index];
            obj1[index] = obj1[rnd];
            obj2[index] = obj2[rnd];
            obj1[rnd] = tmp1;
            obj2[rnd] = tmp2;
        }
    };

    function createLabelList() {
        let labelList = [];
        let nLabels = _inputs.length;
        for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
            labelList.push(_inputs[dataIdx].label);
        }
        return labelList;
    };



    function getData() {

        let nLabels = _inputs.length;
        const labelList = createLabelList();
        let xData = [];
        let yData = [];
        let dataSize = 0;
        for (let dataIdx = 0; dataIdx < nLabels; dataIdx++) {
            for (let idx = 0; idx < _inputs[dataIdx].data.length; idx++) {
                xData.push(_inputs[dataIdx].data[idx]);
                yData.push(labelList.indexOf(_inputs[dataIdx].label));
                dataSize++;
            }
        }

        shuffle(xData, yData);

        //TODO: split
        let xs = tf.tensor3d(xData);
        xs = xs.reshape([dataSize, _img_width, _img_height, 1]);

        let labelstensor = tf.tensor1d(yData, 'int32');
        let ys = tf.oneHot(labelstensor, _inputs.length);
        labelstensor.dispose();

        return {
            x: xs,
            y: ys
        }
    };

    return {
        addImage: addImage,
        getData: getData
    }
}