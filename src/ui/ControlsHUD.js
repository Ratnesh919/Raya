import { LoaderAnimation } from './LoaderAnimation.js';

export class ControlsHUD {
  constructor({ vrmManager, animationEngine, expressionManager }) {
    this.vrmManager = vrmManager;
    this.animationEngine = animationEngine;
    this.expressionManager = expressionManager;

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
      const file = e.target.files?.[0];
      if (file) {
        await this.loadModelWithLoader(file);
      }
    });

    // Camera mode toggle (default is Portrait close-up matching user preference)
    if (this.btnCameraEl) {
      this.btnCameraEl.title = 'Switch to Full Body';
      this.btnCameraEl.addEventListener('click', () => {
        this.currentCameraMode = this.currentCameraMode === 'portrait' ? 'full' : 'portrait';
        this.vrmManager.setCameraMode(this.currentCameraMode);
        this.btnCameraEl.title = this.currentCameraMode === 'portrait' ? 'Switch to Full Body' : 'Switch to Portrait';
      });
    }


    // Emotion chips
    document.querySelectorAll('[data-emotion]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const emotion = el.getAttribute('data-emotion');
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
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.vrm') || file.name.endsWith('.glb'))) {
        await this.loadModelWithLoader(file);
      }
    });
  }

  async loadModelWithLoader(urlOrFile) {
    this.showLoading(typeof urlOrFile === 'string' ? 'Loading 3D Model...' : 'Processing VRM File...');
    try {
      await this.vrmManager.loadModel(urlOrFile);
    } catch (err) {
      alert('Failed to load VRM model: ' + err.message);
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
