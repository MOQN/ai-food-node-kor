console.log("three.js Version: " + THREE.REVISION);

let container;
let scene, camera, renderer;
let controls;

let time, frame = 0;
const fps = { value: 0 };

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const fov = 75;
  const aspectRatio = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 10000;
  camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);
  camera.position.z = 1000;

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  container = document.getElementById("container-three");
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.zoomSpeed = 0.75;
  controls.minDistance = 350;
  controls.maxDistance = 3200;
  controls.enableDamping = true;
  controls.dampingFactor = 0.025;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableKeys = false;
  controls.mouseButtons.LEFT = THREE.MOUSE.NONE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.NONE;
  controls.touches.ONE = THREE.TOUCH.NONE;
  controls.touches.TWO = THREE.TOUCH.DOLLY;

  setupThree();
  setupGUI();

  renderer.setAnimationLoop(animate);
}

function animate() {
  // update the frame count of three.js
  frame++;

  // update the time in milliseconds of three.js
  time = performance.now();

  // calculate the frames per second based on the time
  fps.value = 1000 / (time - (fps.last || time));
  fps.last = time;
  // update the fps value in the ui object
  ui.fps = fps.value.toFixed(2);

  // update the three.js scene
  updateThree(); // ***

  if (controls) {
    controls.update();
    updateMemoryTextOpacity();
  }

  // render the three.js scene
  renderer.render(scene, camera);
}

function updateMemoryTextOpacity() {
  if (!controls || !camera) return;

  const distance = camera.position.distanceTo(controls.target);
  const minDist = controls.minDistance || 350;
  const maxDist = controls.maxDistance || 3200;

  // Threshold for showing memory text
  const threshold = minDist + (maxDist - minDist) * 0.4;  // ~1110

  const memoryText = document.getElementById('memory-text');
  if (memoryText) {
    if (distance > threshold) {
      memoryText.classList.add('visible');
    } else {
      memoryText.classList.remove('visible');
    }
  }
}

window.addEventListener("resize", function () {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function setOrbitControlEnabled(enabled) {
  if (!controls) return;

  const allowFullControl = Boolean(enabled);

  // Zoom is always enabled. Toggle only rotate/pan/keys between full and zoom-only.
  controls.enabled = true;
  controls.enableZoom = true;
  controls.enableRotate = allowFullControl;
  controls.enablePan = allowFullControl;
  controls.enableKeys = allowFullControl;

  if (allowFullControl) {
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  } else {
    controls.mouseButtons.LEFT = THREE.MOUSE.NONE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.NONE;
    controls.touches.ONE = THREE.TOUCH.NONE;
    controls.touches.TWO = THREE.TOUCH.DOLLY;
  }
}

window.setOrbitControlEnabled = setOrbitControlEnabled;