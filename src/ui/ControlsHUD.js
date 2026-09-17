export class ControlsHUD {
  constructor({ vrmManager, animationEngine, expressionManager }) {
    this.vrmManager = vrmManager;
    this.animationEngine = animationEngine;
    this.expressionManager = expressionManager;

    this.modelSelectEl = document.getElementById('model-select');
    this.fileInputEl = document.getElementById('file-input-vrm');
    this.btnUploadEl = document.getElementById('btn-upload-vrm');
    this.btnCameraEl = document.getElementById('btn-camera-toggle');
    this.loadingOverlayEl = document.getElementById('loading-overlay');
    this.loadingTextEl = document.getElementById('loading-text');
    this.loaderBarFillEl = document.getElementById('loader-bar-fill');
    this.loadingPctEl = document.getElementById('loading-pct');

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
    const clampedPct = Math.min(100, Math.max(0, Math.round(pct)));
    if (this.loaderBarFillEl) {
      this.loaderBarFillEl.style.width = `${clampedPct}%`;
    }
    if (this.loadingPctEl) {
      this.loadingPctEl.textContent = `${clampedPct}%`;
    }
    if (text && this.loadingTextEl) {
      this.loadingTextEl.textContent = text;
    }

    const stepBadge = document.getElementById('loader-step-badge');
    if (stepBadge) {
      if (clampedPct < 25) {
        stepBadge.textContent = 'STAGE 01 // NEURAL INIT';
      } else if (clampedPct < 60) {
        stepBadge.textContent = 'STAGE 02 // MTOON SHADERS';
      } else if (clampedPct < 85) {
        stepBadge.textContent = 'STAGE 03 // SPRING DYNAMICS';
      } else if (clampedPct < 100) {
        stepBadge.textContent = 'STAGE 04 // VOICE & VISEMES';
      } else {
        stepBadge.textContent = 'SYSTEM ONLINE // CONNECTED';
      }
    }

    if (clampedPct >= 100) {
      this.hideLoading(550);
    }
  }

  showLoading(text = 'Initializing 3D Neural Avatar...') {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.loadingTextEl) this.loadingTextEl.textContent = text;
    if (this.loaderBarFillEl) this.loaderBarFillEl.style.width = '8%';
    if (this.loadingPctEl) this.loadingPctEl.textContent = '8%';
    const stepBadge = document.getElementById('loader-step-badge');
    if (stepBadge) stepBadge.textContent = 'STAGE 01 // NEURAL INIT';
    this.loadingOverlayEl?.classList.add('active');
  }

  hideLoading(delayMs = 0) {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (delayMs > 0) {
      this.hideTimeout = setTimeout(() => {
        this.loadingOverlayEl?.classList.remove('active');
        this.hideTimeout = null;
      }, delayMs);
    } else {
      this.loadingOverlayEl?.classList.remove('active');
    }
  }
}
