import { resolvePreset, MODE_FRAMES, paintFrame } from 'thinking-orbs/engine';

/**
 * LoaderAnimation
 * Minimalist, elegant Thinking Orb loading screen controller matching the demo component.
 * Uses thinking-orbs canvas rendering engine for a smooth 3D dot-matrix solving orb.
 */
export class LoaderAnimation {
  constructor() {
    this.overlay = document.getElementById('loading-overlay');
    this.pill = document.getElementById('thinking-orb-pill');
    this.canvas = document.getElementById('loading-thinking-orb-canvas');
    this.statusText = document.getElementById('loading-orb-text');

    this.isRunning = false;
    this.rafId = null;
    this.state = 'solving';
    this.size = 64;

    this.initOrb();
  }

  initOrb() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.size * dpr);
    this.canvas.height = Math.round(this.size * dpr);
    this.ctx = this.canvas.getContext('2d');
    const { mode, speed: baseSpeed, opts } = resolvePreset(this.state, this.size);
    this.frameFn = MODE_FRAMES[mode];
    this.presetOpts = opts;
    this.effSpeed = baseSpeed * 1.0;
    this.dpr = dpr;

    this.startLoop();
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    const render = (timeMs) => {
      if (!this.isRunning) return;
      if (this.ctx && this.frameFn) {
        const tSec = (timeMs / 1000) * this.effSpeed;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.clearRect(0, 0, this.size, this.size);
        paintFrame(this.ctx, this.frameFn(this.size, tSec, this.presetOpts), true, null);
      }
      this.rafId = requestAnimationFrame(render);
    };

    this.rafId = requestAnimationFrame(render);
  }

  stopLoop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  playIntro(text = 'Initializing...') {
    if (this.statusText && text) {
      this.statusText.textContent = text;
    }
    if (this.overlay) {
      this.overlay.classList.add('active');
      this.overlay.style.opacity = '1';
      this.overlay.style.visibility = 'visible';
    }
    if (this.pill) {
      this.pill.style.opacity = '1';
      this.pill.style.transform = 'scale(1)';
    }
    this.startLoop();
  }

  updateProgress(pct, text = null) {
    if (text && this.statusText) {
      this.statusText.textContent = text;
    }
  }

  playOutro(onComplete = null) {
    if (this.pill) {
      this.pill.style.opacity = '0';
      this.pill.style.transform = 'scale(0.96)';
    }
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        this.overlay.classList.remove('active');
        this.overlay.style.visibility = 'hidden';
        this.stopLoop();
        if (onComplete) onComplete();
      }, 400);
    } else {
      this.stopLoop();
      if (onComplete) onComplete();
    }
  }

  hideImmediately() {
    this.stopLoop();
    if (this.overlay) {
      this.overlay.classList.remove('active');
      this.overlay.style.opacity = '0';
      this.overlay.style.visibility = 'hidden';
    }
  }
}
