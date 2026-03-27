function setup() {
  // Make p5 canvas fullscreen
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("container-p5");

  // Crucial: initThree() starts the Three.js rendering sequence
  initThree();

  // Keep p5 scaffold alive but do not run a continuous loop.
  noLoop();
}

function draw() {
  // clear() makes the p5 background transparent so Three.js is visible beneath it
  clear();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}