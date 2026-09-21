import * as THREE from 'three';
import { VRMManager } from './vrm/VRMManager.js';
import { AnimationEngine } from './vrm/AnimationEngine.js';
import { ExpressionManager } from './vrm/ExpressionManager.js';
import { LipSyncEngine } from './vrm/LipSyncEngine.js';
import { LifeSimulator } from './vrm/LifeSimulator.js';
import { ChestPhysics } from './vrm/ChestPhysics.js';

import { LLMService } from './ai/LLMService.js';
import { VoiceService } from './ai/VoiceService.js';
import { MemoryService } from './ai/MemoryService.js';

import { ChatUI } from './ui/ChatUI.js';
import { ControlsHUD } from './ui/ControlsHUD.js';
import { SettingsModal } from './ui/SettingsModal.js';

async function bootstrap() {
  console.log('🚀 Initializing Raya AI Assistant...');

  const canvas = document.getElementById('vrm-canvas');

  // 1. Core 3D VRM Systems
  const vrmManager = new VRMManager(canvas);
  const animationEngine = new AnimationEngine(vrmManager);
  const expressionManager = new ExpressionManager(vrmManager);
  const lipSyncEngine = new LipSyncEngine(vrmManager);
  const lifeSimulator = new LifeSimulator(vrmManager);
  const chestPhysics = new ChestPhysics(vrmManager);

  // 2. AI, Voice & Netlify Database Memory Services
  const memoryService = new MemoryService();
  await memoryService.loadMemory();

  const llmService = new LLMService();
  llmService.setMemoryService(memoryService);

  const voiceService = new VoiceService(lipSyncEngine);

  // 3. User Interface Layer
  const chatUI = new ChatUI({
    llmService,
    voiceService,
    expressionManager,
    animationEngine,
    vrmManager,
    memoryService
  });

  const controlsHUD = new ControlsHUD({
    vrmManager,
    animationEngine,
    expressionManager
  });

  const settingsModal = new SettingsModal({
    llmService,
    voiceService
  });

  // Attach to window for diagnostics and runtime access
  window.Raya = {
    vrmManager,
    animationEngine,
    expressionManager,
    chestPhysics,
    chatUI,
    controlsHUD,
    fingerController: animationEngine.fingerController,
    setFingerPose: (pose, hand, speed) => animationEngine.setFingerPose(pose, hand, speed),
    setFingerCurl: (hand, finger, amount) => animationEngine.setFingerCurl(hand, finger, amount),
    setFingerSpread: (hand, amount) => animationEngine.setFingerSpread(hand, amount)
  };

  // 4. Main Render Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    // Pause rendering when tab is inactive to save battery and prevent mobile overheating
    if (document.hidden) return;

    // Clamp delta to max 0.05s (20fps step) to prevent physics explosion/spiral of death on mobile
    const rawDelta = clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);

    // Update animations & retargeted bones
    animationEngine.update(delta);

    // Update cubic smooth facial emotions
    expressionManager.update(delta);

    // Update real-time audio visemes & lip sync
    lipSyncEngine.update(delta);

    // Update procedural life simulations (breathing, saccades, gaze, blinking)
    lifeSimulator.update(delta);

    // Update physics-based secondary motion for chest/breast bones
    chestPhysics.update(delta);

    // Render VRM scene
    vrmManager.render(delta);
  }

  animate();

  // 5. Load Initial Model
  controlsHUD.showLoading('Connecting to 3D Viewport...');
  try {
    const defaultModelUrl = '/models/changli.vrm';
    await vrmManager.loadModel(defaultModelUrl);

    // Add welcoming greeting to chat drawer with happy expression
    const mem = memoryService.getMemory();
    const greeting = mem.userName
      ? `Welcome back, ${mem.userName}! I'm Raya, your AI companion. I'm ready to chat whenever you are! ✨`
      : "Hello! I am Raya, your AI companion. I'm ready to talk online whenever you are. Let's chat!";
    chatUI.addMessageToDrawer('assistant', greeting);
    expressionManager.setEmotionWithAutoReset('happy', 6000);

    // Speak introductory greeting upon the user's first interaction (satisfies browser autoplay policies)
    let hasGreeted = false;
    const triggerInitialGreeting = () => {
      if (hasGreeted) return;
      hasGreeted = true;
      ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
        window.removeEventListener(evt, triggerInitialGreeting);
      });
      const drawerList = document.getElementById('messages-list');
      if (drawerList && drawerList.children.length <= 1) {
        voiceService.speak(greeting);
      }
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
      window.addEventListener(evt, triggerInitialGreeting, { once: true });
    });
  } catch (err) {
    controlsHUD.hideLoading();
    console.error('Failed to load initial avatar:', err);
    chatUI.addMessageToDrawer('assistant', '⚠️ Could not load avatar. Please check your model file or load a custom VRM from the menu.');
  }

  // Hook slider label live updates in settings
  const pitchSlider = document.getElementById('setting-pitch');
  const rateSlider = document.getElementById('setting-rate');
  const pitchVal = document.getElementById('pitch-val');
  const rateVal = document.getElementById('rate-val');
  if (pitchSlider && pitchVal) {
    pitchSlider.addEventListener('input', (e) => (pitchVal.textContent = e.target.value));
  }
  if (rateSlider && rateVal) {
    rateSlider.addEventListener('input', (e) => (rateVal.textContent = e.target.value));
  }

  // 6. Hook Appearance Controls (Skin & Hair Brightness)
  const popoverEl = document.getElementById('appearance-popover');
  const btnAppearanceToggle = document.getElementById('btn-appearance-toggle');
  const btnCloseAppearance = document.getElementById('btn-close-appearance');
  const popSkinSlider = document.getElementById('pop-skin-brightness');
  const popSkinVal = document.getElementById('pop-skin-val');
  const popHairSlider = document.getElementById('pop-hair-brightness');
  const popHairVal = document.getElementById('pop-hair-val');
  const popLightSlider = document.getElementById('pop-overall-brightness');
  const popLightVal = document.getElementById('pop-light-val');
  const btnResetAppearance = document.getElementById('btn-reset-appearance');

  // Sync initial values from vrmManager (Default skin brightness is 0.85, 15% reduced)
  if (popSkinSlider && popSkinVal) {
    popSkinSlider.value = vrmManager.skinBrightness;
    popSkinVal.textContent = Math.round(vrmManager.skinBrightness * 100) + '%';
    popSkinSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      vrmManager.setSkinBrightness(val);
      popSkinVal.textContent = Math.round(val * 100) + '%';
    });
  }

  if (popHairSlider && popHairVal) {
    popHairSlider.value = vrmManager.hairBrightness;
    popHairVal.textContent = Math.round(vrmManager.hairBrightness * 100) + '%';
    popHairSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      vrmManager.setHairBrightness(val);
      popHairVal.textContent = Math.round(val * 100) + '%';
    });
  }

  if (popLightSlider && popLightVal) {
    popLightSlider.value = vrmManager.overallBrightness;
    popLightVal.textContent = Math.round(vrmManager.overallBrightness * 100) + '%';
    popLightSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      vrmManager.setOverallBrightness(val);
      popLightVal.textContent = Math.round(val * 100) + '%';
    });
  }

  if (btnAppearanceToggle && popoverEl) {
    btnAppearanceToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popoverEl.style.display === 'none' || !popoverEl.style.display;
      popoverEl.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (btnCloseAppearance && popoverEl) {
    btnCloseAppearance.addEventListener('click', () => {
      popoverEl.style.display = 'none';
    });
  }

  // Close popover on click outside
  document.addEventListener('click', (e) => {
    if (popoverEl && popoverEl.style.display === 'block') {
      if (!popoverEl.contains(e.target) && e.target !== btnAppearanceToggle && !btnAppearanceToggle.contains(e.target)) {
        popoverEl.style.display = 'none';
      }
    }
  });

  const popQualitySelect = document.getElementById('pop-graphics-quality');
  const popQualityTag = document.getElementById('pop-quality-tag');

  if (popQualitySelect) {
    popQualitySelect.value = vrmManager.graphicsQuality;
    if (popQualityTag) {
      popQualityTag.textContent = vrmManager.graphicsQuality.toUpperCase() + ' / GPU';
    }
    popQualitySelect.addEventListener('change', (e) => {
      const q = e.target.value;
      vrmManager.setGraphicsQuality(q);
      if (popQualityTag) {
        popQualityTag.textContent = q.toUpperCase() + ' / GPU';
      }
    });
  }

  if (btnResetAppearance) {
    btnResetAppearance.addEventListener('click', () => {
      // User preferred visual defaults: 70% skin, 50% hair, 55% lighting
      vrmManager.setSkinBrightness(0.70);
      vrmManager.setHairBrightness(0.50);
      vrmManager.setOverallBrightness(0.55);
      vrmManager.setGraphicsQuality('high');
      if (popSkinSlider) popSkinSlider.value = 0.70;
      if (popSkinVal) popSkinVal.textContent = '70%';
      if (popHairSlider) popHairSlider.value = 0.50;
      if (popHairVal) popHairVal.textContent = '50%';
      if (popLightSlider) popLightSlider.value = 0.55;
      if (popLightVal) popLightVal.textContent = '55%';
      if (popQualitySelect) popQualitySelect.value = 'high';
      if (popQualityTag) popQualityTag.textContent = 'HIGH / GPU';

      // Reset fingers to relaxed
      animationEngine.setFingerPose('relaxed');
      document.querySelectorAll('.finger-chip-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-finger-pose') === 'relaxed');
      });
      const fingerLabel = document.getElementById('pop-finger-active-label');
      if (fingerLabel) fingerLabel.textContent = 'Relaxed';
      const fingerSlider = document.getElementById('pop-finger-curl-slider');
      const fingerVal = document.getElementById('pop-finger-curl-val');
      if (fingerSlider) fingerSlider.value = 0.22;
      if (fingerVal) fingerVal.textContent = '22%';
    });
  }

  // Realtime Finger Pose Chips
  const fingerChips = document.querySelectorAll('.finger-chip-btn');
  const fingerActiveLabel = document.getElementById('pop-finger-active-label');
  const fingerCurlSlider = document.getElementById('pop-finger-curl-slider');
  const fingerCurlVal = document.getElementById('pop-finger-curl-val');

  fingerChips.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pose = btn.getAttribute('data-finger-pose');
      if (!pose) return;

      fingerChips.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (fingerActiveLabel) {
        fingerActiveLabel.textContent = pose.charAt(0).toUpperCase() + pose.slice(1);
      }

      animationEngine.setFingerPose(pose);

      if (fingerCurlSlider && fingerCurlVal) {
        const estCurl = pose === 'fist' ? 0.98 : (pose === 'open' ? 0.0 : (pose === 'peace' ? 0.45 : 0.25));
        fingerCurlSlider.value = estCurl;
        fingerCurlVal.textContent = Math.round(estCurl * 100) + '%';
      }
    });
  });

  // Realtime Finger Curl Slider
  if (fingerCurlSlider && fingerCurlVal) {
    fingerCurlSlider.addEventListener('input', (e) => {
      const curl = parseFloat(e.target.value);
      fingerCurlVal.textContent = Math.round(curl * 100) + '%';

      // Apply curl directly to all fingers in real-time
      ['thumb', 'index', 'middle', 'ring', 'little'].forEach((f) => {
        animationEngine.setFingerCurl('both', f, curl);
      });

      if (fingerActiveLabel) {
        fingerActiveLabel.textContent = `Custom (${Math.round(curl * 100)}%)`;
      }
      fingerChips.forEach((b) => b.classList.remove('active'));
    });
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
