let pane;
let isGuiVisible = true;
let ui = {
  sequence: 'Current: 0 | Total: 0',
  orbitFullControlEnabled: true,
  fps: 0,
  depthScale: 100,
  meshTilt: 0.0,
  meshScale: 1.8,
  incomingDepthOffset: -420,
  outgoingDepthOffset: 120
};

function setupGUI() {
  pane = new Pane();
  pane.addBinding(ui, 'sequence', {
    label: 'Sequence',
    readonly: true,
  });
  pane.addBlade({ view: 'separator' });
  pane.addBinding(ui, 'fps', {
    label: 'FPS',
    readonly: true,
  });
  pane.addBinding(ui, 'fps', {
    label: 'FPS Graph',
    readonly: true,
    view: 'graph',
    min: 0,
    max: 120,
  });
  pane.addBlade({ view: 'separator' });

  const orbitToggle = pane.addBinding(ui, 'orbitFullControlEnabled', {
    label: 'Orbit Full Control',
  });

  orbitToggle.on('change', (ev) => {
    if (typeof window.setOrbitControlEnabled === 'function') {
      window.setOrbitControlEnabled(ev.value);
    }
  });

  if (typeof window.setOrbitControlEnabled === 'function') {
    window.setOrbitControlEnabled(ui.orbitFullControlEnabled);
  }

  pane.addBlade({ view: 'separator' });

  pane.addBinding(ui, 'depthScale', {
    label: 'Depth Scale',
    min: 0,
    max: 100,
    step: 1,
  });

  pane.addBinding(ui, 'meshTilt', {
    label: 'Mesh Tilt',
    min: -0.8,
    max: 0.8,
    step: 0.01,
  });

  pane.addBinding(ui, 'meshScale', {
    label: 'Mesh Scale',
    min: 0.3,
    max: 2.5,
    step: 0.01,
  });

  pane.addBinding(ui, 'incomingDepthOffset', {
    label: 'Incoming Z',
    min: -800,
    max: 0,
    step: 1,
  });

  pane.addBinding(ui, 'outgoingDepthOffset', {
    label: 'Outgoing Z',
    min: 0,
    max: 200,
    step: 1,
  });

}

function updateGUI() {
  //

  pane.refresh();
}

function toggleGUI() {
  if (!pane) return;
  isGuiVisible = !isGuiVisible;

  if ('hidden' in pane) {
    pane.hidden = !isGuiVisible;
    return;
  }

  if (pane.element) {
    pane.element.style.display = isGuiVisible ? '' : 'none';
  }
}

function setSequenceInfo(currentIndex, totalCount) {
  const safeTotal = Number.isFinite(Number(totalCount)) ? Math.max(0, Number(totalCount)) : 0;
  const safeCurrent = Number.isFinite(Number(currentIndex))
    ? Math.max(0, Math.min(Number(currentIndex), Math.max(0, safeTotal - 1)))
    : 0;

  ui.sequence = `Current: ${safeCurrent} | Total: ${safeTotal}`;
}

window.ui = ui;
window.setSequenceInfo = setSequenceInfo;
window.toggleGUI = toggleGUI;