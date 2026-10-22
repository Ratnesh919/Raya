import { LoaderAnimation } from './LoaderAnimation.js';

export class ControlsHUD {
  constructor({ vrmManager, animationEngine, expressionManager, lifeSimulator }) {
    this.vrmManager = vrmManager;
    this.animationEngine = animationEngine;
    this.expressionManager = expressionManager;
    this.lifeSimulator = lifeSimulator;

    this.modelSelectEl = document.getElementById('model-select');
    this.fileInputEl = document.getElementById('file-input-vrm');
    this.btnUploadEl = document.getElementById('btn-upload-vrm');
    this.btnCameraEl = document.getElementById('btn-camera-toggle');

    // Advanced Cybernetic Holographic Loader Animation
    this.loaderAnimation = new LoaderAnimation();

    this.currentCameraMode = 'portrait';
    this.hideTimeout = null;

    // Connect avatar loading progress directly to the visual site loader
    this.vrmManager.onLoadProgress = (pct, text) => {
      this.updateProgress(pct, text);
    };

    this.setupListeners();
    this.setupDragAndDrop();
  }

  setupListeners() {
    // Model dropdown change
    this.modelSelectEl.addEventListener('change', async (e) => {
      const url = e.target.value;
      if (url === 'custom') {
        this.fileInputEl.click();
        return;
      }
      await this.loadModelWithLoader(url);
    });

    // Custom VRM file upload button
    this.btnUploadEl.addEventListener('click', () => {
      this.fileInputEl.click();
    });

    this.fileInputEl.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        const payload = files.length > 1 ? files : files[0];
        await this.loadModelWithLoader(payload);
      }
    });

    // Camera mode toggle (default is Portrait close-up matching user preference)
    if (this.btnCameraEl) {
      this.btnCameraEl.title = 'Switch to Full Body';
      this.btnCameraEl.addEventListener('click', () => {
        this.currentCameraMode = this.currentCameraMode === 'portrait' ? 'full' : 'portrait';
        this.vrmManager.setCameraMode(this.currentCameraMode);
        const isFull = this.currentCameraMode === 'full';
        this.btnCameraEl.classList.toggle('active-mode', isFull);
        this.btnCameraEl.title = isFull ? 'Switch to Portrait (Close-up)' : 'Switch to Full Body';
      });
    }

    // Emotion & Behavioral Movement Chips
    document.querySelectorAll('[data-emotion]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const emotion = el.getAttribute('data-emotion');
        document.querySelectorAll('[data-emotion]').forEach((b) => b.classList.remove('active'));
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 4500);

        if (this.lifeSimulator && typeof this.lifeSimulator.triggerBehavior === 'function') {
          this.lifeSimulator.triggerBehavior(emotion, 5.0);
        }
        this.expressionManager.setEmotionWithAutoReset(emotion, 5000);
      });
    });
  }

  setupDragAndDrop() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []);
      const mainFile = files.find((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.fbx') || n.endsWith('.vrm') || n.endsWith('.glb');
      });

      if (mainFile) {
        const payload = files.length > 1 ? files : mainFile;
        await this.loadModelWithLoader(payload);
      }
    });
  }

  async loadModelWithLoader(urlOrFile) {
    let loadingMsg = 'Initializing 3D Avatar...';
    if (typeof urlOrFile === 'string') {
      loadingMsg = urlOrFile.toLowerCase().includes('.fbx') ? 'Loading FBX Model & Textures...' : 'Loading 3D VRM Model...';
    } else if (Array.isArray(urlOrFile)) {
      loadingMsg = 'Processing FBX Model & Texture Assets...';
    } else if (urlOrFile instanceof File) {
      loadingMsg = urlOrFile.name.toLowerCase().endsWith('.fbx') ? 'Processing FBX Model...' : 'Processing VRM File...';
    }

    this.showLoading(loadingMsg);
    try {
      await this.vrmManager.loadModel(urlOrFile);
    } catch (err) {
      alert('Failed to load 3D model: ' + err.message);
    } finally {
      this.hideLoading();
    }
  }

  updateProgress(pct, text = null) {
    this.loaderAnimation.updateProgress(pct, text);

    if (pct >= 100) {
      this.hideLoading(450);
    }
  }

  showLoading(text = 'Initializing 3D Neural Avatar...') {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.loaderAnimation.playIntro(text);
  }

  hideLoading(delayMs = 0) {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (delayMs > 0) {
      this.hideTimeout = setTimeout(() => {
        this.loaderAnimation.playOutro();
        this.hideTimeout = null;
      }, delayMs);
    } else {
      this.loaderAnimation.playOutro();
    }
  }
}
