console.log("three.js Version: " + THREE.REVISION);

let container;
let scene, camera, renderer;
let controls;

let time, frame = 0;
const fps = { value: 0 };

let zoomVelocity = 0;
let _pinchLastDist = null;

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
  controls.enableZoom = false; // zoom handled manually with custom damping
  controls.minDistance = 350;
  controls.maxDistance = 3200;
  controls.enableDamping = false;
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
  initCustomZoom();

  renderer.setAnimationLoop(animate);
}

function initCustomZoom() {
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomVelocity += e.deltaY * ui.zoomSpeed;
  }, { passive: false });

  renderer.domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      _pinchLastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: false });

  renderer.domElement.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (_pinchLastDist !== null) {
      zoomVelocity += (_pinchLastDist - dist) * 2 * ui.zoomSpeed;
    }
    _pinchLastDist = dist;
    e.preventDefault();
  }, { passive: false });

  renderer.domElement.addEventListener('touchend', () => {
    _pinchLastDist = null;
  });
}

function applyCustomZoom() {
  if (!camera || !controls || zoomVelocity === 0) return;
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  const dist = camera.position.distanceTo(controls.target);
  const newDist = THREE.MathUtils.clamp(
    dist + zoomVelocity,
    controls.minDistance,
    controls.maxDistance
  );
  camera.position.copy(controls.target).addScaledVector(dir, newDist);

  // Treat zoomDamping as resistance: lower values glide longer, higher values stop faster.
  const damping = THREE.MathUtils.clamp(ui.zoomDamping, 0.0001, 0.9999);
  const retention = 1.0 - damping;
  zoomVelocity *= retention;

  if (Math.abs(zoomVelocity) < 0.01) zoomVelocity = 0;
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
    applyCustomZoom();
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