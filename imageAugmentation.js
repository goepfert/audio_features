function createImage(buffer, fraction) {

    const nRow = buffer.length;
    let nCol = buffer[0].length;
    let cutoff = nRow * fraction;
    cutoff = Math.round(Math.random() * Math.round(cutoff));
    console.log(nRow, nCol, cutoff);

    let newBuffer = [];

    //left/right
    const lr = Math.random();
    if (lr < 0.5) {

        console.table(buffer);
        newBuffer = buffer.slice(0, nRow - cutoff);
        console.log(newBuffer);
        let zero = Array.from(Array(cutoff), () => Array.from(Array(nCol), ()=>0) );
        console.log(zero);
        newBuffer = zero.concat(newBuffer);
        console.table(newBuffer);
    } else {

        console.log('----------');

        console.table(buffer);
        newBuffer = buffer.slice(cutoff, nRow);
        console.log(newBuffer);
        let zero = Array.from(Array(cutoff), () => Array.from(Array(nCol), ()=>0) );
        console.log(zero);
        newBuffer = newBuffer.concat(zero);
        console.table(newBuffer);
    }
}