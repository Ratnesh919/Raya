import { animate, createTimeline, stagger } from 'animejs';

/**
 * LoaderAnimation
 * High-craft holographic cybernetic loading animation controller.
 * Utilizes Anime.js v4 timelines, spring physics, dynamic stage decryption,
 * and 3D magnetic card parallax (Design Spells).
 */
export class LoaderAnimation {
  constructor() {
    this.overlay = document.getElementById('loading-overlay');
    this.card = document.getElementById('loader-card');
    this.gyroContainer = document.getElementById('loader-gyro-container');
    this.coreCrystal = document.getElementById('gyro-core-crystal');
    this.barFill = document.getElementById('loader-bar-fill');
    this.pctBadge = document.getElementById('loading-pct');
    this.statusText = document.getElementById('loading-text');
    this.stepBadge = document.getElementById('loader-step-badge');
    this.latencyEl = document.getElementById('telem-latency');

    this.currentPct = 8;
    this.targetPct = 8;
    this.currentStageIndex = 1;
    this.isExiting = false;
    this.scrambleTimer = null;
    this.latencyInterval = null;
    this.pctAnim = null;

    this.setupParallaxTilt();
    this.startTelemetryJitter();
  }

  /**
   * Design Spell: Magnetic 3D Parallax Tilt
   * Interactively tilts the holographic card in 3D perspective based on pointer movement.
   */
  setupParallaxTilt() {
    if (!this.card || !this.overlay) return;

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let animFrame = null;

    const onPointerMove = (e) => {
      if (this.isExiting || !this.overlay.classList.contains('active')) return;

      const rect = this.card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;

      // Normalized coordinates from center (-1 to 1)
      const normX = Math.min(1, Math.max(-1, (e.clientX - cardCenterX) / (rect.width / 2)));
      const normY = Math.min(1, Math.max(-1, (e.clientY - cardCenterY) / (rect.height / 2)));

      // Subtle tilts: max 8deg
      targetRotY = normX * 9;
      targetRotX = -normY * 9;
    };

    const onPointerLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    const updateTiltPhysics = () => {
      // Smooth dampening interpolation
      currentRotX += (targetRotX - currentRotX) * 0.12;
      currentRotY += (targetRotY - currentRotY) * 0.12;

      if (this.card && !this.isExiting) {
        this.card.style.transform = `perspective(1000px) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;
      }

      animFrame = requestAnimationFrame(updateTiltPhysics);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    this.overlay.addEventListener('pointerleave', onPointerLeave);
    animFrame = requestAnimationFrame(updateTiltPhysics);
  }

  /**
   * Start live background telemetry jitter for authentic cyber diagnostic feel.
   */
  startTelemetryJitter() {
    if (this.latencyInterval) clearInterval(this.latencyInterval);
    this.latencyInterval = setInterval(() => {
      if (!this.overlay || !this.overlay.classList.contains('active')) return;
      if (this.latencyEl) {
        const ms = 8 + Math.floor(Math.random() * 9);
        this.latencyEl.textContent = `${ms}ms`;
      }
    }, 1200);
  }

  /**
   * Orchestrated boot sequence when loader appears.
   */
  playIntro(initialText = 'Initializing 3D Neural Viewport...') {
    this.isExiting = false;
    this.currentPct = 8;
    this.targetPct = 8;

    if (this.overlay) {
      this.overlay.classList.add('active');
      this.overlay.style.opacity = '1';
      this.overlay.style.visibility = 'visible';
    }

    if (this.barFill) this.barFill.style.width = '8%';
    if (this.pctBadge) this.pctBadge.textContent = '8%';
    if (this.statusText) this.statusText.textContent = initialText;

    this.setStage(1, 'STAGE 01 // NEURAL INIT', false);

    // Timeline for coordinated HUD entrance
    try {
      const tl = createTimeline({
        defaults: { ease: 'outCubic', duration: 600 }
      });

      // Card spring reveal
      if (this.card) {
        tl.add(this.card, {
          scale: [0.88, 1],
          opacity: [0, 1],
          duration: 650,
          ease: 'outBack(1.3)'
        }, 0);
      }

      // Tactical corner brackets snap in
      const corners = document.querySelectorAll('.hud-corner');
      if (corners.length > 0) {
        tl.add(corners, {
          scale: [0, 1],
          opacity: [0, 1],
          delay: stagger(70),
          duration: 400,
          ease: 'outBack(2)'
        }, 150);
      }

      // 3D Gyro spin-up
      if (this.gyroContainer) {
        tl.add(this.gyroContainer, {
          scale: [0.75, 1],
          opacity: [0, 1],
          duration: 700,
          ease: 'outCubic'
        }, 100);
      }

      // Stage nodes stagger reveal
      const stageItems = document.querySelectorAll('.stage-node-item');
      if (stageItems.length > 0) {
        tl.add(stageItems, {
          translateY: [10, 0],
          opacity: [0, 1],
          delay: stagger(60),
          duration: 450
        }, 250);
      }
    } catch (e) {
      console.warn('Anime.js intro animation fallback:', e);
    }
  }

  /**
   * Smoothly update progress percentage with number interpolation and stage tracking.
   */
  updateProgress(pct, statusText = null) {
    if (this.isExiting) return;

    const clamped = Math.min(100, Math.max(0, Math.round(pct)));
    this.targetPct = clamped;

    if (statusText && this.statusText) {
      this.statusText.textContent = statusText;
    }

    // Smoothly animate the numerical counter and progress bar width
    if (this.pctAnim) {
      try { this.pctAnim.pause(); } catch (_) {}
    }

    const startVal = this.currentPct;
    const endVal = this.targetPct;
    const counterObj = { val: startVal };

    try {
      this.pctAnim = animate(counterObj, {
        val: endVal,
        duration: Math.max(250, Math.abs(endVal - startVal) * 12),
        ease: 'outQuad',
        onUpdate: () => {
          this.currentPct = counterObj.val;
          const rounded = Math.round(counterObj.val);
          if (this.pctBadge) {
            this.pctBadge.textContent = `${rounded}%`;
          }
          if (this.barFill) {
            this.barFill.style.width = `${counterObj.val}%`;
          }
        }
      });
    } catch (e) {
      // Fallback if animejs fails
      this.currentPct = endVal;
      if (this.pctBadge) this.pctBadge.textContent = `${endVal}%`;
      if (this.barFill) this.barFill.style.width = `${endVal}%`;
    }

    // Stage progression logic
    let nextStage = 1;
    let nextStageText = 'STAGE 01 // NEURAL INIT';

    if (clamped < 25) {
      nextStage = 1;
      nextStageText = 'STAGE 01 // NEURAL INIT';
    } else if (clamped < 60) {
      nextStage = 2;
      nextStageText = 'STAGE 02 // MTOON SHADERS & TEXTURES';
    } else if (clamped < 85) {
      nextStage = 3;
      nextStageText = 'STAGE 03 // SKELETON & SPRING BONES';
    } else if (clamped < 100) {
      nextStage = 4;
      nextStageText = 'STAGE 04 // AUDIO & VISEMES';
    } else {
      nextStage = 4;
      nextStageText = 'SYSTEM ONLINE // NEURAL LINKED';
    }

    if (nextStage !== this.currentStageIndex || clamped === 100) {
      this.setStage(nextStage, nextStageText, true);
    }
  }

  /**
   * Update 4-segment stage nodes & trigger cyber text glitch on the badge.
   */
  setStage(stageNum, badgeText, animateGlitch = true) {
    this.currentStageIndex = stageNum;

    // Update 4 stage indicators
    const items = document.querySelectorAll('.stage-node-item');
    const lines = document.querySelectorAll('.stage-node-line');

    items.forEach((item, idx) => {
      const itemStage = idx + 1;
      item.classList.remove('active', 'completed');
      if (itemStage < stageNum) {
        item.classList.add('completed');
      } else if (itemStage === stageNum) {
        item.classList.add('active');
      }
    });

    lines.forEach((line, idx) => {
      if (idx + 1 < stageNum) {
        line.classList.add('active');
      } else {
        line.classList.remove('active');
      }
    });

    // Cyber-scramble glitch on stage badge text
    if (this.stepBadge) {
      if (!animateGlitch) {
        this.stepBadge.textContent = badgeText;
        return;
      }
      this.scrambleBadgeText(badgeText);
    }
  }

  /**
   * Cybernetic terminal text decryption effect
   */
  scrambleBadgeText(targetText) {
    if (this.scrambleTimer) clearInterval(this.scrambleTimer);
    const chars = 'ABCDEF0123456789_#@&><!';
    let iteration = 0;
    const maxIterations = 8;

    this.scrambleTimer = setInterval(() => {
      if (!this.stepBadge) return;

      if (iteration >= maxIterations) {
        this.stepBadge.textContent = targetText;
        clearInterval(this.scrambleTimer);
        this.scrambleTimer = null;
        return;
      }

      const scrambled = targetText
        .split('')
        .map((c, i) => {
          if (c === ' ' || c === '/' || i < Math.floor((iteration / maxIterations) * targetText.length)) {
            return c;
          }
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');

      this.stepBadge.textContent = scrambled;
      iteration++;
    }, 24);
  }

  /**
   * Grand Finale: Hyper-Drive Warp completion sequence at 100%.
   */
  playOutro(onComplete = null) {
    if (this.isExiting) return;
    this.isExiting = true;

    // 1. Full 100% completion badge state
    this.updateProgress(100, 'All Systems Operational');
    this.setStage(4, 'SYSTEM ONLINE // READY', true);

    try {
      const outroTl = createTimeline({
        defaults: { ease: 'outExpo' },
        onComplete: () => {
          if (this.overlay) {
            this.overlay.classList.remove('active');
            this.overlay.style.opacity = '0';
            this.overlay.style.visibility = 'hidden';
          }
          // Reset card transform
          if (this.card) {
            this.card.style.transform = 'none';
            this.card.style.opacity = '1';
          }
          this.isExiting = false;
          if (onComplete) onComplete();
        }
      });

      // Laser conduit flash burst
      if (this.barFill) {
        outroTl.add(this.barFill, {
          boxShadow: '0 0 35px #ffffff, 0 0 50px #00f2fe',
          duration: 300
        }, 0);
      }

      // Quantum core expansion burst
      if (this.coreCrystal) {
        outroTl.add(this.coreCrystal, {
          scale: [1, 2.1],
          opacity: [1, 0],
          duration: 450,
          ease: 'outExpo'
        }, 80);
      }

      // Outer rings expanding warp shockwave
      const rings = document.querySelectorAll('.gyro-ring');
      if (rings.length > 0) {
        outroTl.add(rings, {
          scale: [1, 1.6],
          opacity: [1, 0],
          duration: 450,
          ease: 'outExpo'
        }, 100);
      }

      // Card scale & dissolve
      if (this.card) {
        outroTl.add(this.card, {
          scale: [1, 1.05],
          opacity: [1, 0],
          duration: 420,
          ease: 'outCubic'
        }, 220);
      }

      // Overlay backdrop fade out
      if (this.overlay) {
        outroTl.add(this.overlay, {
          opacity: [1, 0],
          duration: 400,
          ease: 'linear'
        }, 280);
      }
    } catch (e) {
      console.warn('Anime.js outro fallback:', e);
      setTimeout(() => {
        this.overlay?.classList.remove('active');
        this.isExiting = false;
        if (onComplete) onComplete();
      }, 500);
    }
  }

  /**
   * Hide immediately without animation
   */
  hideImmediately() {
    this.isExiting = false;
    if (this.overlay) {
      this.overlay.classList.remove('active');
      this.overlay.style.opacity = '0';
      this.overlay.style.visibility = 'hidden';
    }
    if (this.card) {
      this.card.style.transform = 'none';
      this.card.style.opacity = '1';
    }
  }
}
