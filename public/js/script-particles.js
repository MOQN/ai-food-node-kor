// script-particles.js
// Dust particles: flow right very slowly, white only, fade out by lifespan.

const SHADER_MESH_HALF_W = 800;  // matches shader physicalWidth  / 2
const SHADER_MESH_HALF_H = 450;  // matches shader physicalHeight / 2
const PARTICLE_AREA_SCALE = 2.0;
const PARTICLE_HALF_W = SHADER_MESH_HALF_W * PARTICLE_AREA_SCALE;
const PARTICLE_HALF_H = SHADER_MESH_HALF_H * PARTICLE_AREA_SCALE;

let backgroundPointCloud = null;
let backgroundParticleGeometry = null;
let backgroundParticles = [];

const DUST_CONFIG = {
  maxParticles: 5000,
  spawnPerFrame: 120,
  pointSize: 11,
  speedXMin: 0.4375,
  speedXMax: 1.125,
  speedZNoise: 0.16,
  flowStrengthY: 0.55,
  flowSpatialFreqX: 0.0085,
  flowTemporalFreq: 0.42,
  flowPhaseJitter: 6.283,
  damping: 0.997,
  lifeReductionMin: 0.003,
  lifeReductionMax: 0.008,
  spawnZCenter: 250,
  spawnZSpread: 1340,
  zMin: -420,
  zMax: 920
};

function setParticleColorGridFromImage(imageLike) {
  // No-op by design: particles are fixed white.
}

function setParticleColorGridFromImageURI(imageURI) {
  // No-op by design: particles are fixed white.
}

// ─── Particle class ──────────────────────────────────────────────────────────

class DustParticle {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.baseSpeedX = 0;
    this.flowSeed = 0;
    this.flowPhase = 0;
    this.age = 0;
    this.lifespan = 1.0;
    this.lifeReduction = 0.01;
    this.isDone = false;
  }

  init(staggerLife) {
    const x = THREE.MathUtils.randFloatSpread(PARTICLE_HALF_W * 2);
    const y = THREE.MathUtils.randFloatSpread(PARTICLE_HALF_H * 2);
    const z = DUST_CONFIG.spawnZCenter +
      THREE.MathUtils.randFloatSpread(DUST_CONFIG.spawnZSpread);

    this.pos.set(x, y, z);
    this.age = 0;
    this.lifespan = staggerLife !== undefined ? staggerLife : (0.9 + Math.random() * 0.6);
    this.isDone = false;
    this.lifeReduction = THREE.MathUtils.randFloat(
      DUST_CONFIG.lifeReductionMin,
      DUST_CONFIG.lifeReductionMax
    );

    this.baseSpeedX = THREE.MathUtils.randFloat(DUST_CONFIG.speedXMin, DUST_CONFIG.speedXMax);
    this.flowSeed = Math.random() * 1000;
    this.flowPhase = Math.random() * DUST_CONFIG.flowPhaseJitter;

    const sz = (Math.random() - 0.5) * DUST_CONFIG.speedZNoise;
    this.vel.set(this.baseSpeedX, 0, sz);

    return this;
  }

  update(timeSeconds) {
    this.vel.multiplyScalar(DUST_CONFIG.damping);

    const flow = Math.sin(
      this.flowSeed +
      this.pos.x * DUST_CONFIG.flowSpatialFreqX +
      timeSeconds * DUST_CONFIG.flowTemporalFreq +
      this.flowPhase
    );

    this.vel.x = THREE.MathUtils.lerp(this.vel.x, this.baseSpeedX, 0.045);
    this.vel.y = THREE.MathUtils.lerp(this.vel.y, flow * DUST_CONFIG.flowStrengthY, 0.14);

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.pos.z += this.vel.z;
    this.age += 0.016;
    this.lifespan -= this.lifeReduction;
    if (
      this.lifespan <= 0 ||
      this.pos.x > PARTICLE_HALF_W + 80 ||
      this.pos.y < -PARTICLE_HALF_H - 220 ||
      this.pos.y > PARTICLE_HALF_H + 220 ||
      this.pos.z < DUST_CONFIG.zMin ||
      this.pos.z > DUST_CONFIG.zMax
    ) {
      this.isDone = true;
    }
  }
}

// ─── Setup / Update ──────────────────────────────────────────────────────────

function buildBackgroundPoints(maxCount) {
  const positions = new Float32Array(maxCount * 3);
  const colors = new Float32Array(maxCount * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);

  const particleTexture = new THREE.TextureLoader().load('asset/particle_texture.jpg');
  particleTexture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.PointsMaterial({
    size: DUST_CONFIG.pointSize,
    map: particleTexture,
    alphaMap: particleTexture,
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    alphaTest: 0.01,
    sizeAttenuation: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return { geometry, mesh: new THREE.Points(geometry, material) };
}

function setupParticles(scene) {
  if (!scene || backgroundPointCloud) return;

  const bundle = buildBackgroundPoints(DUST_CONFIG.maxParticles);
  backgroundParticleGeometry = bundle.geometry;
  backgroundPointCloud = bundle.mesh;
  backgroundPointCloud.renderOrder = 50;
  scene.add(backgroundPointCloud);
}

function updateParticles(currentTime) {
  if (!backgroundPointCloud || !backgroundParticleGeometry) return;
  const timeSeconds = Number.isFinite(currentTime) ? currentTime * 0.001 : performance.now() * 0.001;

  // Gradually fill pool so particles are staggered on load
  if (backgroundParticles.length < DUST_CONFIG.maxParticles) {
    for (let i = 0; i < DUST_CONFIG.spawnPerFrame; i++) {
      if (backgroundParticles.length >= DUST_CONFIG.maxParticles) break;
      backgroundParticles.push(new DustParticle().init(Math.random()));
    }
  }

  const positions = backgroundParticleGeometry.attributes.position.array;
  const colors = backgroundParticleGeometry.attributes.color.array;

  for (let i = 0; i < backgroundParticles.length; i++) {
    const p = backgroundParticles[i];
    p.update(timeSeconds);

    if (p.isDone) {
      p.init();
    }

    const i3 = i * 3;
    positions[i3] = p.pos.x;
    positions[i3 + 1] = p.pos.y;
    positions[i3 + 2] = p.pos.z;

    // White-only particles with brightness fade from lifespan.
    const fade = Math.max(0, Math.min(0.6, Math.pow(p.lifespan, 1.8) * 0.6));
    colors[i3] = fade;
    colors[i3 + 1] = fade;
    colors[i3 + 2] = fade;
  }

  backgroundParticleGeometry.setDrawRange(0, backgroundParticles.length);
  backgroundParticleGeometry.attributes.position.needsUpdate = true;
  backgroundParticleGeometry.attributes.color.needsUpdate = true;
}

window.setupParticles = setupParticles;
window.updateParticles = updateParticles;
window.setParticleColorGridFromImage = setParticleColorGridFromImage;
window.setParticleColorGridFromImageURI = setParticleColorGridFromImageURI;
