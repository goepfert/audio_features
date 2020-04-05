async function rec() {
  recognizer = speechCommands.create('BROWSER_FFT');
  await recognizer.ensureModelLoaded();

  console.log(recognizer);

  tfvis.show.modelSummary({ name: 'Model Summary' }, recognizer.model);
  recognizer.model.summary();
}

rec();
