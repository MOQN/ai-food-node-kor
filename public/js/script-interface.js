// Data & Configuration
const TAG_DATA = {
  food: ['Noodles', 'Dessert', 'Pasta', 'Hotpot', 'Strawberry', 'Cream', 'Chili Powder', 'Sushi', 'Burger', 'Steak', 'Chocolate'],
  taste: ['Spicy', 'Creamy', 'Sweet', 'Refreshing', 'Greasy', 'Clean', 'Savory', 'Sour', 'Bitter'],
  genre: ['K-Pop', 'Rock', 'R&B', 'Rap', 'Chinese Classical', 'Jazz', 'EDM', 'Acoustic', 'Heavy Metal'],
  moodSpeed: ['Chill & Slow', 'Steady & Medium', 'Upbeat & Fast', 'Hyper & Super Fast'],
  moodVibe: ['A Bit Melancholic', 'Just Chilling', 'Super Excited!']
};

const INSTRUMENT_MAP = {
  'K-Pop': 'sleek synthesizers and glittering pop microphones',
  'Rock': 'electric guitars and heavy drum kits',
  'R&B': 'smooth bass guitars and modern keyboards',
  'Rap': 'turntables, beatpads, and gold microphones',
  'Chinese Classical': 'guzheng, erhu, and traditional bamboo flutes',
  'Jazz': 'saxophones, trumpets, and a classy upright bass',
  'EDM': 'DJ decks, neon synthesizers, and glowing launchpads',
  'Acoustic': 'wooden acoustic guitars, cajons, and tambourines',
  'Heavy Metal': 'spiky flying-V guitars and massive double-kick drums'
};

const OUTPUT_FOLDER = "AIxFood";
const DEFAULT_SPEED_MOOD = 'Steady & Medium';
const DEFAULT_VIBE_MOOD = 'Just Chilling';
const TOTAL_LOOP_VISUALS = 3;
const VISUAL_LOOP_INTERVAL_MS = 1200;
const IMAGE_REGEN_PROMPT_APPEND = ', high-energy action performance, energetic stage presence, dramatic camera pan right';
const SIMPLE_SWAP_MODE = true;

// Dynamic image pairs loaded from server
let imagePairs = [];
let currentImageIndex = -1;

// ==========================================
// History Management & Band Class
// ==========================================
let historyGrid = [];

class Band {
  constructor(id, colorUri, depthUri, soundUri) {
    this.id = id;
    this.colorUri = colorUri;
    this.depthUri = depthUri;
    this.soundUri = soundUri;
    this.meshGroup = null;
  }

  buildPlaneMesh() {
    if (!window.THREE) {
      console.warn("THREE.js is not loaded yet.");
      return;
    }

    const textureLoader = new window.THREE.TextureLoader();
    const map = textureLoader.load(this.colorUri);

    const innerGeo = new window.THREE.PlaneGeometry(100, 100);
    const innerMat = new window.THREE.MeshBasicMaterial({
      map: map,
      side: window.THREE.DoubleSide
    });
    const innerMesh = new window.THREE.Mesh(innerGeo, innerMat);

    const outerGeo = new window.THREE.PlaneGeometry(106, 106);
    const outerMat = new window.THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: window.THREE.DoubleSide
    });
    const outerMesh = new window.THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.z = -0.5;

    const group = new window.THREE.Group();
    group.add(outerMesh);
    group.add(innerMesh);

    this.meshGroup = group;
  }
}

// State Management
let currentBase64Image = null;
let currentSessionTimestamp = "";
let generatedVisuals = [];
let visualLoopTimerId = null;
let visualLoopIndex = 0;
let activeVisualGenerationToken = 0;
let bandArrivalHideTimerId = null;

const selections = {
  food: new Set(),
  taste: new Set(),
  genre: new Set(),
  moodSpeed: new Set(),
  moodVibe: new Set()
};

// Utility Functions
function getFormattedTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}-${hh}${min}${ss}`;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function stopVisualLoop() {
  if (visualLoopTimerId) {
    clearInterval(visualLoopTimerId);
    visualLoopTimerId = null;
  }
}

function clearBandArrivalTimer() {
  if (bandArrivalHideTimerId) {
    clearTimeout(bandArrivalHideTimerId);
    bandArrivalHideTimerId = null;
  }
}

function showBandArrivalMessage() {
  const topArea = document.querySelector('#step-result .result-top-area');
  if (!topArea) return;

  clearBandArrivalTimer();
  topArea.classList.remove('message-hidden');

  bandArrivalHideTimerId = setTimeout(() => {
    topArea.classList.add('message-hidden');
  }, 4000);
}

function resetSelectionUI() {
  document.querySelectorAll('.tag-btn.active').forEach((button) => {
    button.classList.remove('active');
  });

  selections.food.clear();
  selections.taste.clear();
  selections.genre.clear();
  selections.moodSpeed.clear();
  selections.moodVibe.clear();

  document.querySelectorAll('.next-btn').forEach((button) => {
    button.disabled = true;
  });

  if (commentsFood) commentsFood.value = '';
  if (commentsTaste) commentsTaste.value = '';
  if (commentsGenre) commentsGenre.value = '';
  if (fileInput) fileInput.value = '';

  applyDefaultMoodSelections();
}

function setContainerThreeOpacityState(state) {
  const containerThree = document.getElementById('container-three');
  if (!containerThree) return;

  containerThree.classList.remove('dimmed', 'active');

  if (state === 'dimmed') {
    containerThree.classList.add('dimmed');
    return;
  }

  containerThree.classList.add('active');
}

function updateStep4GenerateState() {
  if (!generateBtn) return;

  const hasSpeedMood = selections.moodSpeed.size > 0;
  const hasVibeMood = selections.moodVibe.size > 0;

  generateBtn.disabled = !(hasSpeedMood && hasVibeMood);
}

function applyDefaultMoodSelections() {
  const defaults = [
    { containerId: 'tags-mood-speed', category: 'moodSpeed', value: DEFAULT_SPEED_MOOD },
    { containerId: 'tags-mood-vibe', category: 'moodVibe', value: DEFAULT_VIBE_MOOD }
  ];

  defaults.forEach(({ containerId, category, value }) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    selections[category].clear();
    selections[category].add(value);

    Array.from(container.children).forEach((button) => {
      button.classList.toggle('active', button.innerText === value);
    });
  });

  updateStep4GenerateState();
}

function inviteNextBand() {
  setContainerThreeOpacityState('dimmed');

  stopVisualLoop();
  clearBandArrivalTimer();
  generatedVisuals = [];
  visualLoopIndex = 0;
  activeVisualGenerationToken += 1;
  currentBase64Image = null;
  currentSessionTimestamp = '';

  const topArea = document.querySelector('#step-result .result-top-area');
  if (topArea) {
    topArea.classList.remove('message-hidden');
  }

  if (statusImage) statusImage.innerText = 'IMAGE';

  document.querySelectorAll('.loader-text, .circular-loader').forEach((element) => {
    element.classList.remove('done');
  });

  resetSelectionUI();
  showStep(0);
}

function beginNewVisualSequence() {
  stopVisualLoop();
  generatedVisuals = [];
  visualLoopIndex = 0;
  activeVisualGenerationToken += 1;
  return activeVisualGenerationToken;
}

function isResultStepVisible() {
  const resultStep = document.getElementById('step-result');
  return Boolean(resultStep && !resultStep.classList.contains('hidden'));
}

function displayVisual(visual, options = {}) {
  if (!visual?.imageDataURI) return;

  initThreeJSShader(visual.imageDataURI, visual.depthDataURI, options);
}

function startVisualLoop(token) {
  stopVisualLoop();

  if (generatedVisuals.length < 2) return;

  visualLoopTimerId = window.setInterval(() => {
    if (token !== activeVisualGenerationToken || !isResultStepVisible()) {
      stopVisualLoop();
      return;
    }

    visualLoopIndex = (visualLoopIndex + 1) % generatedVisuals.length;
    displayVisual(generatedVisuals[visualLoopIndex], {
      animateIn: false,
      pulseOnSwap: false
    });
  }, VISUAL_LOOP_INTERVAL_MS);
}

// DOM Elements
const dropOverlay = document.getElementById('drop-overlay');
const fileInput = document.getElementById('file-input');
const generateBtn = document.getElementById('generate-btn');

const statusImage = document.getElementById('status-image');

const commentsFood = document.getElementById('comments-food');
const commentsTaste = document.getElementById('comments-taste');
const commentsGenre = document.getElementById('comments-genre');

// Step Navigation
function showStep(stepIndex) {
  if (stepIndex !== 'result') {
    stopVisualLoop();
    clearBandArrivalTimer();
  }

  document.querySelectorAll('.step').forEach(step => {
    if (step.id === `step-${stepIndex}`) {
      step.classList.remove('hidden');
      setTimeout(() => step.classList.add('active'), 50);
    } else {
      step.classList.remove('active');
      setTimeout(() => {
        if (!step.classList.contains('active')) step.classList.add('hidden');
      }, 600);
    }
  });
}

document.querySelectorAll('.next-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const nextStep = e.target.getAttribute('data-next');
    if (nextStep) showStep(nextStep);
  });
});

// Initialization & UI
function init() {
  buildTagButtons('tags-food', TAG_DATA.food, 'food', '1');
  buildTagButtons('tags-taste', TAG_DATA.taste, 'taste', '2');
  buildTagButtons('tags-genre', TAG_DATA.genre, 'genre', '3', true);
  buildTagButtons('tags-mood-vibe', TAG_DATA.moodVibe, 'moodVibe', '4', true, DEFAULT_VIBE_MOOD);
  buildTagButtons('tags-mood-speed', TAG_DATA.moodSpeed, 'moodSpeed', '4', true, DEFAULT_SPEED_MOOD);
  setContainerThreeOpacityState('active');
  bindCommentTextareaEnterAdvance();
  updateStep4GenerateState();

  // Load image pairs dynamically from server
  loadImagePairs();

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', inviteNextBand);

  if (SIMPLE_SWAP_MODE) {
    document.body.classList.add('simple-swap-mode');
    showStep('result');
  }
}

function bindCommentTextareaEnterAdvance() {
  document.querySelectorAll('.comment-box').forEach((textarea) => {
    textarea.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;

      event.preventDefault();

      const step = textarea.closest('.step');
      if (!step) return;

      const nextButton = step.querySelector('.next-btn');
      if (nextButton && !nextButton.disabled) {
        nextButton.click();
      }
    });
  });
}

function buildTagButtons(containerId, items, category, stepNum, isSingleSelect = false, defaultItem = null) {
  const container = document.getElementById(containerId);
  const nextBtn = document.querySelector(`#step-${stepNum} .next-btn`);
  if (!container) return;

  const shouldApplyDefault = isSingleSelect && Boolean(defaultItem);

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.innerText = item;

    if (shouldApplyDefault && item === defaultItem) {
      btn.classList.add('active');
      selections[category].clear();
      selections[category].add(item);
    }

    btn.addEventListener('click', () => {
      if (isSingleSelect) {
        Array.from(container.children).forEach(c => c.classList.remove('active'));
        selections[category].clear();
        btn.classList.add('active');
        selections[category].add(item);
      } else {
        const isActive = btn.classList.toggle('active');
        if (isActive) selections[category].add(item);
        else selections[category].delete(item);
      }

      if (stepNum === '4') {
        updateStep4GenerateState();
      } else if (nextBtn) {
        nextBtn.disabled = selections[category].size === 0;
      }

      if (category === 'food' || category === 'taste') {
        if (typeof window.updateTextLabels === 'function') {
          const labels = [...selections.food, ...selections.taste].slice(0, 6);
          window.updateTextLabels(labels);
        }
      }
    });
    container.appendChild(btn);
  });

  if (stepNum === '4') {
    updateStep4GenerateState();
  }
}

// File Handling
function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert("Invalid file. Please upload an image.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentBase64Image = e.target.result;
    showStep(1);
  };
  reader.readAsDataURL(file);
}

const chooseFileBtn = document.getElementById('choose-file-btn');
if (chooseFileBtn) chooseFileBtn.addEventListener('click', () => fileInput.click());
if (fileInput) fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) processFile(e.target.files[0]);
});

let dragCounter = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; if (dropOverlay) dropOverlay.classList.add('show'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0 && dropOverlay) dropOverlay.classList.remove('show'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); dragCounter = 0; if (dropOverlay) dropOverlay.classList.remove('show'); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]); });

// Main Execution
if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    const visualToken = beginNewVisualSequence();
    showStep('loading');

    document.querySelectorAll('.loader-text, .circular-loader').forEach(el => el.classList.remove('done'));
    if (statusImage) statusImage.innerText = "VISUAL";

    const foods = Array.from(selections.food);
    const tastes = Array.from(selections.taste);
    const genres = Array.from(selections.genre);
    const speedMood = Array.from(selections.moodSpeed)[0] || DEFAULT_SPEED_MOOD;
    const vibeMood = Array.from(selections.moodVibe)[0] || DEFAULT_VIBE_MOOD;

    const foodStr = foods.length > 0 ? foods.join(", ") : "generic food";
    const tasteStr = tastes.length > 0 ? tastes.join(", ") : "delicious";
    const genreStr = genres.length > 0 ? genres[0] : "Jazz";

    const foodComment = commentsFood ? commentsFood.value.trim() : '';
    const tasteComment = commentsTaste ? commentsTaste.value.trim() : '';
    const genreDetail = commentsGenre ? ` (${commentsGenre.value.trim()})` : "";
    const foodDetail = foodComment ? ` (${foodComment})` : "";
    const tasteDetail = tasteComment ? ` (${tasteComment})` : "";
    const instruments = INSTRUMENT_MAP[genreStr] || 'various musical instruments';

    const imagePrompt = `the food remain completely unchanged and realistic, preserving the original appearance and texture, photorealistic food, macro photography, tilt-shift effect, highly detailed. tiny food-shape musicians are generated based on ${foodStr}${foodDetail} and performing as a small cozy band across a food landscape. cute miniature ${foodStr} characters playing ${instruments}${genreDetail}. The overall atmosphere has a ${tasteStr}${tasteDetail} and ${genreStr} vibe, passionate and dynamic performance.`;

    currentSessionTimestamp = getFormattedTimestamp();

    const payloadImage = {
      promptText: imagePrompt,
      seed: Math.floor(Math.random() * 1000000),
      referenceImage: currentBase64Image,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}`
    };

    fetchMedia('/api/generate-image', payloadImage, 'image').then((imageData) => {
      if (imageData && imageData.success) {
        setContainerThreeOpacityState('active');

        const initialVisual = {
          imageDataURI: imageData.imageDataURI,
          depthDataURI: imageData.depthDataURI
        };
        generatedVisuals = [initialVisual];
        visualLoopIndex = 0;

        // 1. Create Band instance and generate Plane Meshes
        const newBand = new Band(
          currentSessionTimestamp,
          imageData.imageDataURI,
          imageData.depthDataURI,
          null
        );
        newBand.buildPlaneMesh(); // This creates the bordered plane group

        // 2. Add to global history
        historyGrid.push(newBand);
        console.log("Total Bands in History:", historyGrid.length);

        if (statusImage) statusImage.innerText = "IMAGE & DEPTH READY";

        showStep('result');
        showBandArrivalMessage();

        displayVisual(initialVisual, { animateIn: true, pulseOnSwap: false });

        void generateAdditionalVisuals(imagePrompt, visualToken);
      } else {
        alert("Generation failed. Check server logs.");
        showStep(0);
      }
    });
  });
}

// Network Requests
async function fetchMedia(endpoint, payload, type) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    document.getElementById('loader-image')?.classList.add('done');
    document.getElementById(`status-${type}`)?.classList.add('done');

    if (!result.success) {
      console.error(`[Fetch Error - ${type}]`, result.error);
      return null;
    }

    return type === 'image' ? result : result.dataURI;

  } catch (err) {
    console.error(`[Fetch Error - ${type}]`, err);
    return null;
  }
}

async function fetchNextImageIteration(payload) {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (!result.success || !result.imageDataURI || !result.depthDataURI) {
    throw new Error(result.error || 'Image regeneration failed.');
  }

  return result;
}

async function generateAdditionalVisuals(originalPrompt, token) {
  let referenceImage = generatedVisuals[0]?.imageDataURI || currentBase64Image;
  const hyperDynamicPrompt = `${originalPrompt}${IMAGE_REGEN_PROMPT_APPEND}`;

  while (generatedVisuals.length < TOTAL_LOOP_VISUALS) {
    if (token !== activeVisualGenerationToken || !isResultStepVisible()) {
      return;
    }

    const nextPayload = {
      promptText: hyperDynamicPrompt,
      seed: Math.floor(Math.random() * 1000000),
      referenceImage,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}-loop-${generatedVisuals.length + 1}`
    };

    try {
      const loopResult = await fetchNextImageIteration(nextPayload);
      generatedVisuals.push({
        imageDataURI: loopResult.imageDataURI,
        depthDataURI: loopResult.depthDataURI
      });
      referenceImage = loopResult.imageDataURI;
    } catch (err) {
      console.error('[Loop] Failed.', err);
      break;
    }
  }

  if (token !== activeVisualGenerationToken) {
    return;
  }

  startVisualLoop(token);
}

// Shader Integration Hook
function initThreeJSShader(imageURI, depthURI, options) {
  if (window.updateThreeJSMaterial) {
    window.updateThreeJSMaterial(imageURI, depthURI, options);
  }
}

init();

// to test
async function loadImagePairs() {
  try {
    console.log('[ImagePairs] Fetching from /api/image-pairs...');
    const res = await fetch('/api/image-pairs');

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error('[ImagePairs] Received non-JSON response:', text.substring(0, 200));
      throw new Error(`Expected JSON but got: ${contentType || 'unknown'}`);
    }

    const data = await res.json();
    imagePairs = data.pairs || [];
    console.log(`[ImagePairs] Loaded ${imagePairs.length} image pairs:`, imagePairs);

    // Update GUI sequence display
    if (window.updateSequenceDisplay) {
      window.updateSequenceDisplay(imagePairs.length);
    }
  } catch (err) {
    console.error('[ImagePairs] Failed to load:', err);
    imagePairs = [];
  }
}

function updateSequenceDisplay(totalCount, currentIdx = -1) {
  const safeTotal = Number.isFinite(Number(totalCount)) ? Math.max(0, Number(totalCount)) : 0;
  const safeCurrent = currentIdx >= 0 ? currentIdx : 0;

  if (typeof window.setSequenceInfo === 'function') {
    window.setSequenceInfo(safeCurrent, safeTotal);
  } else if (typeof window.ui !== 'undefined') {
    window.ui.sequence = `Current: ${safeCurrent} | Total: ${safeTotal}`;
  }
}

function resetImageSequence() {
  currentImageIndex = -1;
  updateSequenceDisplay(imagePairs.length, 0);
}

async function loadShaderTestImages() {
  if (imagePairs.length === 0) {
    console.warn('[loadShaderTestImages] No image pairs loaded');
    return;
  }

  currentImageIndex = (currentImageIndex + 1) % imagePairs.length;
  const pair = imagePairs[currentImageIndex];

  showStep('result');

  // Update GUI sequence display
  if (window.updateSequenceDisplay) {
    window.updateSequenceDisplay(imagePairs.length, currentImageIndex);
  }

  const applyWhenReady = () => {
    if (window.updateThreeJSMaterial) {
      initThreeJSShader(pair.image, pair.depth, {
        animateIn: true,
        swapDuration: 8.0
      });
    } else {
      setTimeout(applyWhenReady, 100);
    }
  };

  setTimeout(applyWhenReady, 300);
}

window.loadShaderTestImages = loadShaderTestImages;
window.updateSequenceDisplay = updateSequenceDisplay;
window.loadImagePairs = loadImagePairs;
window.resetImageSequence = resetImageSequence;