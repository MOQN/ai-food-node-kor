function setupThree() {
  if (typeof window.setupParticles === 'function') {
    window.setupParticles(scene);
  }

  if (typeof window.setupTextMeshes === 'function') {
    window.setupTextMeshes(scene);
  }

  // Call the external wrapper to setup shaders
  setupShaders(scene, ui.depthScale);
}

function updateThree() {
  if (typeof window.updateParticles === 'function') {
    window.updateParticles(time);
  }

  if (typeof window.updateTextMeshes === 'function') {
    window.updateTextMeshes(time);
  }

  // Call the external wrapper to update shaders every frame
  updateShaders(time, ui.depthScale, ui.meshTilt, {
    meshScale: ui.meshScale,
    incomingDepthOffset: ui.incomingDepthOffset,
    outgoingDepthOffset: ui.outgoingDepthOffset
  });

  // swing the mesh back and forth for a more dynamic look
  if (instancedObjs) {
    instancedObjs.rotation.y = 0.0;
    instancedObjs.rotation.z = 0.0;
  }

  if (typeof updateGUI === 'function') {
    updateGUI();
  }
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

  const key = event.key?.toLowerCase();
  const isTransitionActive =
    typeof window.isShaderTransitionActive === 'function' &&
    window.isShaderTransitionActive();

  if (event.code === 'Space' && isTransitionActive) {
    event.preventDefault();
    return;
  }

  if (key === ' ') {
    if (typeof window.loadShaderTestImages === 'function') {
      window.loadShaderTestImages();
    }
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (typeof triggerClickPulse === 'function') {
      triggerClickPulse();
    }
  }

  if (key === 'f') {
    const fs = fullscreen();
    fullscreen(!fs);
  }

  if (key === 'h') {
    if (typeof window.toggleGUI === 'function') {
      window.toggleGUI();
    }
  }

  if (key === '0') {
    event.preventDefault();

    if (typeof window.hideAllShaderMeshes === 'function') {
      window.hideAllShaderMeshes();
    }

    if (typeof window.resetImageSequence === 'function') {
      window.resetImageSequence();
    }
  }
});