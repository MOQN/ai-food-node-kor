// script-shaders.js

let instancedObjs;
let sharedGeometry = null;
let shaderMeshes = [null, null];
let shaderMaterials = [null, null];

const SHADER_CONFIG = {
  gridX: 800,
  gridY: 450,
  physicalWidth: 1600,
  physicalHeight: 900,
  particleSize: 2.8,
  defaultDepthScale: 100.0,
  scatterRadiusXY: 860.0,
  scatterRadiusZ: 480.0,
  depthInvert: true,
  swapDuration: 8.0,
  meshScale: 1.8,
  incomingDepthOffset: -420.0,
  outgoingDepthOffset: 120.0,
  incomingStartXOffset: 340.0,
  outgoingEndXOffset: 420.0,
  zMin: -1000.0,
  zMax: 200.0,
  depthFluctuationSpeed: 0.62,
  swayAmountX: 0.018,
  swaySpeedX: 0.45,
  windDirectionX: 1.0,
  idleOrbitRadius: 1.35,
  idleOrbitSpeedMin: 0.82,
  idleOrbitSpeedMax: 1.92
};
let currentVisibleIndex = -1;
let outgoingIndex = -1;
let incomingIndex = -1;
let isSwapping = false;
let swapStartTime = 0;
let swapDurationSeconds = SHADER_CONFIG.swapDuration;

async function loadShaders() {
  const vRes = await fetch('shader/vertex.glsl');
  const fRes = await fetch('shader/fragment.glsl');

  return {
    vertex: await vRes.text(),
    fragment: await fRes.text()
  };
}

function configureTexture(texture) {
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

function loadTexture(loader, uri) {
  return new Promise((resolve, reject) => {
    loader.load(uri, resolve, undefined, reject);
  });
}

function buildSharedGeometry() {
  const gridX = SHADER_CONFIG.gridX;
  const gridY = SHADER_CONFIG.gridY;
  const instances = gridX * gridY;

  const instOffsets = [];
  const instUVs = [];
  const instRandoms = [];

  const physicalWidth = SHADER_CONFIG.physicalWidth;
  const physicalHeight = SHADER_CONFIG.physicalHeight;

  for (let y = 0; y < gridY; y++) {
    for (let x = 0; x < gridX; x++) {
      const posX = (x / (gridX - 1)) * physicalWidth - physicalWidth * 0.5;
      const posY = (y / (gridY - 1)) * physicalHeight - physicalHeight * 0.5;

      instOffsets.push(posX, posY, 0.0);
      instUVs.push(x / (gridX - 1), y / (gridY - 1));
      instRandoms.push(Math.random());
    }
  }

  const bufferGeometry = new THREE.BoxGeometry(
    SHADER_CONFIG.particleSize,
    SHADER_CONFIG.particleSize,
    SHADER_CONFIG.particleSize
  );

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = instances;

  geometry.index = bufferGeometry.index;
  geometry.setAttribute('position', bufferGeometry.attributes.position);
  geometry.setAttribute('normal', bufferGeometry.attributes.normal);
  geometry.setAttribute('uv', bufferGeometry.attributes.uv);

  geometry.setAttribute(
    'offset',
    new THREE.InstancedBufferAttribute(new Float32Array(instOffsets), 3)
  );

  geometry.setAttribute(
    'aUv',
    new THREE.InstancedBufferAttribute(new Float32Array(instUVs), 2)
  );

  geometry.setAttribute(
    'aRandom',
    new THREE.InstancedBufferAttribute(new Float32Array(instRandoms), 1)
  );

  return geometry;
}

function createMaterial(shaders, initialDepthScale) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uTime: { value: 0.0 },
      uProgress: { value: 1.0 },
      uPhase: { value: 0.0 },
      uVisible: { value: 0.0 },
      uWindDirectionX: { value: SHADER_CONFIG.windDirectionX },
      uIdleOrbitRadius: { value: SHADER_CONFIG.idleOrbitRadius },
      uIdleOrbitSpeedMin: { value: SHADER_CONFIG.idleOrbitSpeedMin },
      uIdleOrbitSpeedMax: { value: SHADER_CONFIG.idleOrbitSpeedMax },
      uDepthScale: {
        value:
          typeof initialDepthScale === 'number'
            ? initialDepthScale
            : SHADER_CONFIG.defaultDepthScale
      },
      uDepthInvert: { value: SHADER_CONFIG.depthInvert ? 1.0 : 0.0 },
      uScatterRadiusXY: { value: SHADER_CONFIG.scatterRadiusXY },
      uScatterRadiusZ: { value: SHADER_CONFIG.scatterRadiusZ },
      uIncomingDepthOffset: { value: SHADER_CONFIG.incomingDepthOffset },
      uOutgoingDepthOffset: { value: SHADER_CONFIG.outgoingDepthOffset },
      uIncomingStartXOffset: { value: SHADER_CONFIG.incomingStartXOffset },
      uOutgoingEndXOffset: { value: SHADER_CONFIG.outgoingEndXOffset },
      uZMin: { value: SHADER_CONFIG.zMin },
      uZMax: { value: SHADER_CONFIG.zMax }
    },
    vertexShader: shaders.vertex,
    fragmentShader: shaders.fragment,
    side: THREE.DoubleSide,
    transparent: true,
    premultipliedAlpha: true,
    alphaTest: 0.005,
    depthTest: true,
    depthWrite: true
  });
}

function setMaterialBaseUniforms(material, currentTimeSeconds, currentDepthScale, shaderControls = {}) {
  material.uniforms.uTime.value = currentTimeSeconds;

  const maxDepthScale = Number.isFinite(Number(currentDepthScale))
    ? Math.max(0, Math.min(100, Number(currentDepthScale)))
    : SHADER_CONFIG.defaultDepthScale;
  const depthWave = 0.5 + 0.5 * Math.sin(currentTimeSeconds * SHADER_CONFIG.depthFluctuationSpeed);
  material.uniforms.uDepthScale.value = maxDepthScale * depthWave;

  const nextIncomingOffset = Number(shaderControls.incomingDepthOffset);
  if (Number.isFinite(nextIncomingOffset)) {
    material.uniforms.uIncomingDepthOffset.value = nextIncomingOffset;
  }

  const nextOutgoingOffset = Number(shaderControls.outgoingDepthOffset);
  if (Number.isFinite(nextOutgoingOffset)) {
    material.uniforms.uOutgoingDepthOffset.value = nextOutgoingOffset;
  }

  material.uniforms.uZMin.value = SHADER_CONFIG.zMin;
  material.uniforms.uZMax.value = SHADER_CONFIG.zMax;
}

function applyTexturesToSlot(slotIndex, colorTexture, depthTexture) {
  const mat = shaderMaterials[slotIndex];
  if (!mat) return;

  mat.uniforms.tColor.value = colorTexture;
  mat.uniforms.tDepth.value = depthTexture;
}

function setSwapRenderOrder(incomingSlot, outgoingSlot) {
  if (incomingSlot >= 0 && shaderMeshes[incomingSlot]) {
    shaderMeshes[incomingSlot].renderOrder = 1;
  }
  if (outgoingSlot >= 0 && shaderMeshes[outgoingSlot]) {
    shaderMeshes[outgoingSlot].renderOrder = 2;
  }
}

function setSingleVisibleRenderOrder(visibleSlot) {
  for (let i = 0; i < shaderMeshes.length; i++) {
    if (!shaderMeshes[i]) continue;
    shaderMeshes[i].renderOrder = i === visibleSlot ? 1 : 2;
  }
}

async function setupShaders(scene, initialDepthScale) {
  const shaders = await loadShaders();

  sharedGeometry = buildSharedGeometry();
  instancedObjs = new THREE.Group();

  for (let i = 0; i < 2; i++) {
    const material = createMaterial(shaders, initialDepthScale);
    const mesh = new THREE.Mesh(sharedGeometry, material);

    material.uniforms.uVisible.value = 0.0;
    material.uniforms.uProgress.value = 1.0;
    mesh.renderOrder = i;

    shaderMaterials[i] = material;
    shaderMeshes[i] = mesh;
    instancedObjs.add(mesh);
  }

  instancedObjs.rotation.x = 0.0;
  instancedObjs.rotation.y = 0.0;
  instancedObjs.scale.setScalar(SHADER_CONFIG.meshScale);
  scene.add(instancedObjs);
}

function updateShaders(currentTime, currentDepthScale, meshTilt, shaderControls = {}) {
  if (!instancedObjs || !shaderMaterials[0] || !shaderMaterials[1]) return;

  const timeInSeconds = currentTime * 0.001;
  setMaterialBaseUniforms(shaderMaterials[0], timeInSeconds, currentDepthScale, shaderControls);
  setMaterialBaseUniforms(shaderMaterials[1], timeInSeconds, currentDepthScale, shaderControls);

  if (instancedObjs && typeof meshTilt === 'number') {
    instancedObjs.rotation.x = meshTilt + Math.sin(timeInSeconds * SHADER_CONFIG.swaySpeedX) * SHADER_CONFIG.swayAmountX;
  }

  const nextMeshScale = Number(shaderControls.meshScale);
  if (instancedObjs && Number.isFinite(nextMeshScale)) {
    instancedObjs.scale.setScalar(Math.max(0.05, nextMeshScale));
  }

  if (!isSwapping) {
    return;
  }

  const elapsed = Math.max(0, timeInSeconds - swapStartTime);
  const t = swapDurationSeconds <= 0.0001 ? 1.0 : Math.min(1.0, elapsed / swapDurationSeconds);
  const normalized = t < 0.5
    ? 4.0 * t * t * t
    : 1.0 - Math.pow(-2.0 * t + 2.0, 3.0) / 2.0;  // ease-in-out cubic

  if (outgoingIndex >= 0 && shaderMaterials[outgoingIndex]) {
    shaderMaterials[outgoingIndex].uniforms.uProgress.value = normalized;
  }

  if (incomingIndex >= 0 && shaderMaterials[incomingIndex]) {
    shaderMaterials[incomingIndex].uniforms.uProgress.value = normalized;
  }

  if (normalized >= 1.0) {
    isSwapping = false;

    if (outgoingIndex >= 0 && shaderMaterials[outgoingIndex]) {
      shaderMaterials[outgoingIndex].uniforms.uProgress.value = 1.0;
      shaderMaterials[outgoingIndex].uniforms.uPhase.value = 0.0;
    }

    currentVisibleIndex = incomingIndex;
    setSingleVisibleRenderOrder(currentVisibleIndex);
    outgoingIndex = -1;
    incomingIndex = -1;
  }
}

async function trigger25DAppearance(imageURI, depthURI, options = {}) {
  if (!imageURI) return;

  const loader = new THREE.TextureLoader();
  const targetDepth = depthURI || imageURI;
  const animateIn = options.animateIn !== false;
  const requestedSwapDuration = Number(options.swapDuration);

  if (Number.isFinite(requestedSwapDuration)) {
    swapDurationSeconds = Math.max(0.15, requestedSwapDuration);
  } else {
    swapDurationSeconds = SHADER_CONFIG.swapDuration;
  }

  try {
    const colorTexture = await loadTexture(loader, imageURI);
    const depthTexture = await loadTexture(loader, targetDepth);

    configureTexture(colorTexture);
    configureTexture(depthTexture);

    if (typeof window.setParticleColorGridFromImageURI === 'function') {
      window.setParticleColorGridFromImageURI(imageURI);
    }

    if (
      typeof window.setParticleColorGridFromImage === 'function' &&
      colorTexture?.image
    ) {
      window.setParticleColorGridFromImage(colorTexture.image);
    }

    if (!shaderMaterials[0] || !shaderMaterials[1]) return;

    if (currentVisibleIndex < 0) {
      const firstSlot = 0;
      applyTexturesToSlot(firstSlot, colorTexture, depthTexture);

      shaderMaterials[firstSlot].uniforms.uVisible.value = 1.0;
      shaderMaterials[firstSlot].uniforms.uPhase.value = 1.0;
      shaderMaterials[firstSlot].uniforms.uProgress.value = animateIn ? 0.0 : 1.0;

      currentVisibleIndex = firstSlot;
      setSingleVisibleRenderOrder(currentVisibleIndex);
      outgoingIndex = -1;
      incomingIndex = firstSlot;
      isSwapping = animateIn;
      if (animateIn) {
        swapStartTime = performance.now() * 0.001;
      }
      return;
    }

    const nextSlot = currentVisibleIndex === 0 ? 1 : 0;

    applyTexturesToSlot(nextSlot, colorTexture, depthTexture);

    outgoingIndex = currentVisibleIndex;
    incomingIndex = nextSlot;
    setSwapRenderOrder(incomingIndex, outgoingIndex);

    shaderMaterials[outgoingIndex].uniforms.uVisible.value = 1.0;
    shaderMaterials[outgoingIndex].uniforms.uPhase.value = 0.0;
    shaderMaterials[outgoingIndex].uniforms.uProgress.value = 0.0;

    shaderMaterials[incomingIndex].uniforms.uVisible.value = 1.0;
    shaderMaterials[incomingIndex].uniforms.uPhase.value = 1.0;
    shaderMaterials[incomingIndex].uniforms.uProgress.value = animateIn ? 0.0 : 1.0;

    if (animateIn) {
      isSwapping = true;
      swapStartTime = performance.now() * 0.001;
    } else {
      isSwapping = false;
      shaderMaterials[outgoingIndex].uniforms.uProgress.value = 1.0;
      shaderMaterials[incomingIndex].uniforms.uProgress.value = 1.0;
      currentVisibleIndex = incomingIndex;
      setSingleVisibleRenderOrder(currentVisibleIndex);
      outgoingIndex = -1;
      incomingIndex = -1;
    }
  } catch (error) {
    console.error('[Shader] Failed to load image/depth textures', error);
  }
}

function isShaderTransitionActive() {
  return isSwapping;
}

function hideAllShaderMeshes() {
  isSwapping = false;
  swapStartTime = 0;
  currentVisibleIndex = -1;
  outgoingIndex = -1;
  incomingIndex = -1;

  for (let i = 0; i < shaderMaterials.length; i++) {
    const material = shaderMaterials[i];
    if (!material) continue;

    material.uniforms.uVisible.value = 0.0;
    material.uniforms.uProgress.value = 1.0;
    material.uniforms.uPhase.value = 0.0;
  }
}

window.isShaderTransitionActive = isShaderTransitionActive;
window.hideAllShaderMeshes = hideAllShaderMeshes;
window.updateThreeJSMaterial = trigger25DAppearance;
