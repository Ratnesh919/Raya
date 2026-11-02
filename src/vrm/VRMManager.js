import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { FBXAvatarLoader } from './FBXAvatarLoader.js';

export class VRMManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.currentVrm = null;
    this.currentModelUrl = null;
    this.isLoading = false;
    this.fbxAvatarLoader = new FBXAvatarLoader();

    // Visual adjustment settings: Changli defaults (Skin 80%, Hair 65%, Lighting 45%) across all models
    if (!localStorage.getItem('raya_visual_defaults_v8')) {
      localStorage.setItem('raya_visual_defaults_v8', 'true');
      localStorage.setItem('raya_skin_brightness', '0.80');
      localStorage.setItem('raya_hair_brightness', '0.65');
      localStorage.setItem('raya_overall_brightness', '0.45');
    }
    this.skinBrightness = parseFloat(localStorage.getItem('raya_skin_brightness') || '0.80');
    this.hairBrightness = parseFloat(localStorage.getItem('raya_hair_brightness') || '0.65');
    this.overallBrightness = parseFloat(localStorage.getItem('raya_overall_brightness') || '0.45');

    // Model loaded listener array (ensures multiple consumers all receive loaded VRM)
    this.modelLoadedListeners = [];

    // Callbacks
    this.onLoadProgress = null;
    this.onError = null;

    // Breeze simulation timer
    this.windTime = 0;

    this.initScene();
    this.setOverallBrightness(this.overallBrightness);
  }

  addModelLoadedListener(cb) {
    this.modelLoadedListeners.push(cb);
    if (this.currentVrm) {
      try { cb(this.currentVrm); } catch (e) { console.error(e); }
    }
  }

  initScene() {
    const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    const isLowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                     (navigator.deviceMemory && navigator.deviceMemory <= 4);

    this.isMobile = isMobile;
    this.graphicsQuality = localStorage.getItem('raya_graphics_quality') || (isLowEnd ? 'low' : (isMobile ? 'balanced' : 'high'));

    // On mobile devices, cap DPR to prevent extreme fill-rate overhead (e.g. 1080x2400 screen with DPR 3x is 9 million pixels)
    if (this.isMobile) {
      this.currentDpr = this.graphicsQuality === 'high'
        ? Math.min(window.devicePixelRatio, 1.25)
        : (this.graphicsQuality === 'balanced' ? Math.min(window.devicePixelRatio, 1.10) : 1.0);
    } else {
      this.currentDpr = this.graphicsQuality === 'high'
        ? Math.min(window.devicePixelRatio, 2.0)
        : (this.graphicsQuality === 'balanced' ? Math.min(window.devicePixelRatio, 1.5) : 1.0);
    }

    // 1. High Performance WebGL Renderer with device-adaptive MSAA
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !this.isMobile, // Disable heavy 4x MSAA on mobile tile GPUs to save GPU memory & heat
      powerPreference: 'high-performance', // Forces discrete/high-power GPU on PC & mobile
      precision: (this.isMobile || this.graphicsQuality === 'low') ? 'mediump' : 'highp',
      stencil: false,
      depth: true
    });
    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // FPS Watchdog counters
    this.frameCount = 0;
    this.frameTimeAccum = 0;

    // 2. Scene
    this.scene = new THREE.Scene();

    // 3. Camera with responsive mobile framing (Default is Portrait close-up matching user preference)
    this.camera = new THREE.PerspectiveCamera(
      28,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    this.currentCameraMode = 'portrait';
    this.cameraPortraitPos = new THREE.Vector3(0, 1.38, 1.58);
    this.cameraPortraitTarget = new THREE.Vector3(0, 1.35, 0);
    this.cameraFullBodyPos = new THREE.Vector3(0, 1.25, 3.8);
    this.cameraFullBodyTarget = new THREE.Vector3(0, 1.15, 0);

    // 3D Orbital Camera state & scratch math
    this.cameraTarget = new THREE.Vector3().copy(this.cameraPortraitTarget);
    this.cameraSpherical = new THREE.Spherical();
    this._cameraOffset = new THREE.Vector3();

    this.updateCameraForScreen();
    this.camera.position.copy(this.cameraPortraitPos);
    this.camera.lookAt(this.cameraTarget);

    // 5. Lighting
    this.setupLighting();

    // 6. Orbit & Drag state (with mobile touch & pinch zoom)
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.turnDeltaY = 0;
    this.turnDeltaX = 0;
    this.chestPhysics = null;
    this.setupInteractions();
    this.setupGyroscope();
    this.setupPhoneShake();

    // 7. Resize listener
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setGraphicsQuality(level) {
    this.graphicsQuality = level;
    localStorage.setItem('raya_graphics_quality', level);
    if (this.isMobile) {
      if (level === 'high') {
        this.currentDpr = Math.min(window.devicePixelRatio, 1.25);
      } else if (level === 'balanced') {
        this.currentDpr = Math.min(window.devicePixelRatio, 1.10);
      } else {
        this.currentDpr = 1.0;
      }
    } else {
      if (level === 'high') {
        this.currentDpr = Math.min(window.devicePixelRatio, 2.0);
      } else if (level === 'balanced') {
        this.currentDpr = Math.min(window.devicePixelRatio, 1.5);
      } else {
        this.currentDpr = 1.0;
      }
    }
    this.renderer.setPixelRatio(this.currentDpr);
  }

  updateCameraForScreen() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    this.camera.aspect = aspect;

    if (aspect < 1.0) {
      // Mobile portrait screen framing
      // Phone aspect ratio typically ~0.46 (iPhone) to 0.56 (9:16)
      const phoneScale = 1.0 / Math.max(aspect, 0.45);

      // Portrait: Focus cleanly on head, face, and chest centered above bottom controls
      this.cameraPortraitPos.set(0, 1.38, 1.65 * Math.min(phoneScale * 0.55, 1.25));
      this.cameraPortraitTarget.set(0, 1.34, 0);

      // Full Body: Target lowered to Y=0.70 so avatar center of mass is centered,
      // ensuring head is safely below top bar and feet (Y=0) have full clearance above bottom chat bar
      this.cameraFullBodyPos.set(0, 0.82, 3.65 * Math.min(phoneScale * 0.65, 1.45));
      this.cameraFullBodyTarget.set(0, 0.70, 0);
    } else {
      // Desktop / PC (Preserved - user confirmed "it is good for pc")
      this.cameraPortraitPos.set(0, 1.38, 1.58);
      this.cameraPortraitTarget.set(0, 1.35, 0);
      this.cameraFullBodyPos.set(0, 1.25, 3.8);
      this.cameraFullBodyTarget.set(0, 1.15, 0);
    }

    this.camera.updateProjectionMatrix();
    const targetPos = this.currentCameraMode === 'full' ? this.cameraFullBodyPos : this.cameraPortraitPos;
    const targetLook = this.currentCameraMode === 'full' ? this.cameraFullBodyTarget : this.cameraPortraitTarget;
    this.cameraTarget.copy(targetLook);
    this.camera.position.copy(targetPos);
    this.camera.lookAt(this.cameraTarget);

    if (this._cameraOffset && this.cameraSpherical) {
      this._cameraOffset.subVectors(this.camera.position, this.cameraTarget);
      this.cameraSpherical.setFromVector3(this._cameraOffset);
    }
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.ambientLight.userData.baseIntensity = 0.95;
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xfff5f0, 1.4);
    this.keyLight.userData.baseIntensity = 1.4;
    this.keyLight.position.set(1.5, 2.5, 2.5);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.85);
    this.fillLight.userData.baseIntensity = 0.85;
    this.fillLight.position.set(-2, 1.5, 1.5);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xcc66ff, 1.2);
    this.rimLight.userData.baseIntensity = 1.2;
    this.rimLight.position.set(0, 3, -3);
    this.scene.add(this.rimLight);

    this.underLight = new THREE.DirectionalLight(0x66ccff, 0.4);
    this.underLight.userData.baseIntensity = 0.4;
    this.underLight.position.set(0, -1, 2);
    this.scene.add(this.underLight);
  }

  setupInteractions() {
    const el = this.canvas;

    // Prevent default context menu so right-click drag is uninterrupted
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Desktop Pointer Controls (Left-click: avatar rotation, Right-click: camera Y-axis movement)
    // Touch pointers are strictly excluded here so they never conflict with mobile touch handlers below
    this.dragButton = -1;

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.dragButton = e.button;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    });

    const stopDragging = (e) => {
      if (e && e.pointerType === 'touch') return;
      this.isDragging = false;
      this.dragButton = -1;
      if (e && e.pointerId) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (!this.isDragging) return;

      if (this.dragButton === 0 && this.currentVrm) {
        // Left click drag: rotate avatar model horizontally (around local Y axis)
        const deltaX = e.clientX - this.previousMousePosition.x;
        const turn = deltaX * 0.008;
        this.currentVrm.scene.rotation.y += turn;
        this.turnDeltaY += turn;
      } else if (this.dragButton === 2) {
        // Right click drag: full 3D orbital camera angle control
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        // Azimuth (horizontal 3D orbit around avatar)
        this.cameraSpherical.theta -= deltaX * 0.008;

        // Elevation / Pitch (vertical 3D tilt angle)
        const pitchTurn = deltaY * 0.006;
        this.turnDeltaX += pitchTurn;
        this.cameraSpherical.phi += pitchTurn;

        // Safe clamping on polar angle to prevent gimbal flipping
        this.cameraSpherical.phi = THREE.MathUtils.clamp(
          this.cameraSpherical.phi,
          0.12,                  // ~7° from zenith (overhead high-angle view)
          Math.PI / 2 + 0.45     // ~115° (upward low-angle view)
        );

        this._cameraOffset.setFromSpherical(this.cameraSpherical);
        this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
        this.camera.lookAt(this.cameraTarget);
      }

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('wheel', (e) => {
      const zoomDelta = e.deltaY * 0.002;
      const minRadius = this.currentCameraMode === 'full' ? 1.5 : 0.7;
      const maxRadius = this.currentCameraMode === 'full' ? 6.5 : 4.5;
      this.cameraSpherical.radius = THREE.MathUtils.clamp(
        this.cameraSpherical.radius + zoomDelta,
        minRadius,
        maxRadius
      );
      this._cameraOffset.setFromSpherical(this.cameraSpherical);
      this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
      this.camera.lookAt(this.cameraTarget);
    }, { passive: true });

    // Dedicated Mobile Touch Controls:
    // 1-Finger: Smooth, responsive turntable rotation (horizontal) and elevation tilt (vertical)
    // 2-Finger ONLY: Pinch-to-zoom and two-finger pan (strictly prohibited on single-finger drag)
    let touchStartDist = 0;
    let touchStartRadius = 0;
    let previousTwoTouchCenter = null;
    let touchPreviousPos = null;

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        touchPreviousPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartDist = 0;
        previousTwoTouchCenter = null;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        touchPreviousPos = null;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartRadius = this.cameraSpherical.radius;
        previousTwoTouchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging && touchPreviousPos) {
        const deltaX = e.touches[0].clientX - touchPreviousPos.x;
        const deltaY = e.touches[0].clientY - touchPreviousPos.y;

        // 1-Finger Horizontal: rotate avatar model around Y axis with swift, free turntable responsiveness
        if (this.currentVrm) {
          const turn = deltaX * 0.016; // Responsive rotation speed
          this.currentVrm.scene.rotation.y += turn;
          this.turnDeltaY += turn;
        }

        // 1-Finger Vertical: smooth vertical elevation tilt (up/down camera rotation)
        // Dragging DOWN tilts camera down (low angle), Dragging UP tilts camera up (high angle)
        const pitchTurn = deltaY * 0.012; // Responsive pitch sensitivity
        this.turnDeltaX += pitchTurn;
        this.cameraSpherical.phi += pitchTurn;
        this.cameraSpherical.phi = THREE.MathUtils.clamp(
          this.cameraSpherical.phi,
          0.12,
          Math.PI / 2 + 0.45
        );

        this._cameraOffset.setFromSpherical(this.cameraSpherical);
        this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
        this.camera.lookAt(this.cameraTarget);

        touchPreviousPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        // Zooming and orbital panning are mathematically restricted to 2-finger touches ONLY
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const currentCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };

        // 2-Finger Pinch: Zoom camera in/out
        const factor = touchStartDist / Math.max(currentDist, 1);
        const minRadius = this.currentCameraMode === 'full' ? 1.5 : 0.7;
        const maxRadius = this.currentCameraMode === 'full' ? 6.5 : 4.5;
        this.cameraSpherical.radius = THREE.MathUtils.clamp(
          touchStartRadius * factor,
          minRadius,
          maxRadius
        );

        // 2-Finger Pan: Full 3D orbital camera angle (azimuth + pitch)
        if (previousTwoTouchCenter) {
          const midDeltaX = currentCenter.x - previousTwoTouchCenter.x;
          const midDeltaY = currentCenter.y - previousTwoTouchCenter.y;

          const midPitchTurn = midDeltaY * 0.008;
          this.turnDeltaX += midPitchTurn;
          this.cameraSpherical.theta -= midDeltaX * 0.010;
          this.cameraSpherical.phi += midPitchTurn;
          this.cameraSpherical.phi = THREE.MathUtils.clamp(
            this.cameraSpherical.phi,
            0.12,
            Math.PI / 2 + 0.45
          );
        }
        previousTwoTouchCenter = currentCenter;

        this._cameraOffset.setFromSpherical(this.cameraSpherical);
        this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
        this.camera.lookAt(this.cameraTarget);
      }
    }, { passive: true });

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        this.isDragging = false;
        touchPreviousPos = null;
        touchStartDist = 0;
        previousTwoTouchCenter = null;
      } else if (e.touches.length === 1) {
        // Seamlessly switch from 2-finger pinch back to 1-finger model rotation
        this.isDragging = true;
        touchPreviousPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartDist = 0;
        previousTwoTouchCenter = null;
      }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  }

  /**
   * Phone Gyroscope Integration:
   * Rotates avatar head and gaze smoothly as user tilts phone,
   * strictly clamped to natural human anatomical limits (no 360-degree rotation).
   */
  setupGyroscope() {
    if (typeof window === 'undefined') return;

    this.gyroEnabled = true;
    this.gyroBaseline = null;
    this.targetGyroYaw = 0;   // Radians
    this.targetGyroPitch = 0; // Radians
    this.currentGyroYaw = 0;
    this.currentGyroPitch = 0;

    const handleOrientation = (e) => {
      if (!this.gyroEnabled || !this.currentVrm) return;
      if (e.gamma === null || e.beta === null) return;

      // gamma: Left-to-right tilt in degrees [-90, 90]
      // beta: Front-to-back tilt in degrees [-180, 180]
      if (!this.gyroBaseline) {
        this.gyroBaseline = { gamma: e.gamma, beta: e.beta };
        return;
      }

      // Delta from baseline
      const deltaGamma = e.gamma - this.gyroBaseline.gamma;
      const deltaBeta = e.beta - this.gyroBaseline.beta;

      // Convert degrees to radians
      const rawYaw = (deltaGamma * Math.PI) / 180;
      const rawPitch = (deltaBeta * Math.PI) / 180;

      // BIOMECHANICAL RANGE CONSTRAINT:
      // Real human head/neck cannot rotate 360 degrees!
      // Limit yaw to max ±45° (±0.78 rad) and pitch to max ±25° (±0.44 rad)
      const maxHumanYaw = 0.78;   // ~45°
      const maxHumanPitch = 0.44; // ~25°

      this.targetGyroYaw = THREE.MathUtils.clamp(rawYaw, -maxHumanYaw, maxHumanYaw);
      this.targetGyroPitch = THREE.MathUtils.clamp(-rawPitch, -maxHumanPitch, maxHumanPitch);
    };

    // Permission handler for iOS 13+ devices
    const requestGyroPermission = () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then((response) => {
            if (response === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, { passive: true });
            }
          })
          .catch(() => {});
      } else if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      }
    };

    // Request on first user interaction to satisfy browser security policies
    window.addEventListener('touchstart', requestGyroPermission, { once: true, passive: true });
    window.addEventListener('click', requestGyroPermission, { once: true, passive: true });
  }

  /**
   * Phone Shake Secondary Motion:
   * Uses DeviceMotionEvent linear acceleration to detect physical phone shake.
   * Feeds linear jerk impulses into ChestPhysics to jiggle secondary mass,
   * completely decoupled from gyroscope angular orientation.
   */
  setupPhoneShake() {
    if (typeof window === 'undefined') return;

    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    let lastShakeTime = 0;

    const handleMotion = (e) => {
      const acc = e.acceleration || e.accelerationIncludingGravity;
      if (!acc || acc.x === null) return;

      const deltaX = acc.x - lastX;
      const deltaY = acc.y - lastY;
      const deltaZ = acc.z - lastZ;
      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;

      const jerk = Math.hypot(deltaX, deltaY, deltaZ);
      // Jerk threshold: > 11 m/s^2 detects intentional physical phone shake
      if (jerk > 11) {
        const now = performance.now();
        if (now - lastShakeTime > 120) {
          lastShakeTime = now;
          const intensity = Math.min(1.8, (jerk - 11) / 10.0 + 0.3);
          if (this.chestPhysics) {
            this.chestPhysics.applyShakeImpulse(intensity, deltaX, deltaY);
          }
        }
      }
    };

    const requestMotionPermission = () => {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then((response) => {
            if (response === 'granted') {
              window.addEventListener('devicemotion', handleMotion, { passive: true });
            }
          })
          .catch(() => {});
      } else if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', handleMotion, { passive: true });
      }
    };

    window.addEventListener('touchstart', requestMotionPermission, { once: true, passive: true });
    window.addEventListener('click', requestMotionPermission, { once: true, passive: true });
  }

  updateGyro(deltaTime) {
    if (!this.currentVrm || !this.gyroEnabled) return;

    // Smooth lerp (soft spring-damped tracking)
    const lerpSpeed = THREE.MathUtils.clamp(deltaTime * 6.0, 0, 1);
    const prevYaw = this.currentGyroYaw;
    this.currentGyroYaw = THREE.MathUtils.lerp(this.currentGyroYaw, this.targetGyroYaw, lerpSpeed);
    this.currentGyroPitch = THREE.MathUtils.lerp(this.currentGyroPitch, this.targetGyroPitch, lerpSpeed);

    const deltaGyro = this.currentGyroYaw - prevYaw;
    this.turnDeltaY += deltaGyro;

    // Apply clamped gyro rotation smoothly onto avatar head/neck without exceeding human limits
    if (this.currentVrm.humanoid) {
      const neck = this.currentVrm.humanoid.getNormalizedBoneNode('neck');
      const head = this.currentVrm.humanoid.getNormalizedBoneNode('head');
      if (neck) {
        neck.rotation.y = THREE.MathUtils.clamp(neck.rotation.y + this.currentGyroYaw * 0.40, -0.45, 0.45);
        neck.rotation.x = THREE.MathUtils.clamp(neck.rotation.x + this.currentGyroPitch * 0.40, -0.30, 0.30);
      }
      if (head) {
        head.rotation.y = THREE.MathUtils.clamp(head.rotation.y + this.currentGyroYaw * 0.60, -0.75, 0.75);
        head.rotation.x = THREE.MathUtils.clamp(head.rotation.x + this.currentGyroPitch * 0.60, -0.35, 0.35);
      }
    }
  }

  setCameraMode(mode = 'portrait') {
    this.currentCameraMode = mode;
    const targetPos = mode === 'full' ? this.cameraFullBodyPos : this.cameraPortraitPos;
    const targetLook = mode === 'full' ? this.cameraFullBodyTarget : this.cameraPortraitTarget;

    const startTarget = this.cameraTarget.clone();
    const startTime = performance.now();
    const duration = 600; // ms

    // Target spherical parameters
    const targetOffset = new THREE.Vector3().subVectors(targetPos, targetLook);
    const targetSpherical = new THREE.Spherical().setFromVector3(targetOffset);

    const startSpherical = this.cameraSpherical.clone();
    // Smoothly blend theta towards 0 (front-facing) if heavily rotated, or preserve subtle angle
    const destTheta = Math.abs(startSpherical.theta) > Math.PI * 0.5 ? 0 : startSpherical.theta * 0.35;

    const animateCamera = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 0.5 - Math.cos(t * Math.PI) / 2;

      // Smoothly interpolate target look-at point
      this.cameraTarget.lerpVectors(startTarget, targetLook, ease);

      // Smoothly interpolate spherical coordinates (radius, phi, theta)
      this.cameraSpherical.radius = THREE.MathUtils.lerp(startSpherical.radius, targetSpherical.radius, ease);
      this.cameraSpherical.phi = THREE.MathUtils.lerp(startSpherical.phi, targetSpherical.phi, ease);
      this.cameraSpherical.theta = THREE.MathUtils.lerp(startSpherical.theta, destTheta, ease);

      this._cameraOffset.setFromSpherical(this.cameraSpherical);
      this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
      this.camera.lookAt(this.cameraTarget);

      if (t < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        this.cameraTarget.copy(targetLook);
        this.cameraSpherical.copy(targetSpherical);
        this.cameraSpherical.theta = destTheta;
        this._cameraOffset.setFromSpherical(this.cameraSpherical);
        this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
        this.camera.lookAt(this.cameraTarget);
      }
    };
    requestAnimationFrame(animateCamera);
  }

  poseRestingArms(vrmInstance) {
    // Idle animation drives all humanoid bones naturally
  }

  setSkinBrightness(val) {
    this.skinBrightness = THREE.MathUtils.clamp(val, 0.2, 2.0);
    localStorage.setItem('raya_skin_brightness', this.skinBrightness.toString());
    this.applyVisualAdjustments();
  }

  setHairBrightness(val) {
    this.hairBrightness = THREE.MathUtils.clamp(val, 0.2, 2.0);
    localStorage.setItem('raya_hair_brightness', this.hairBrightness.toString());
    this.applyVisualAdjustments();
  }

  setOverallBrightness(val) {
    this.overallBrightness = THREE.MathUtils.clamp(val, 0.2, 2.5);
    localStorage.setItem('raya_overall_brightness', this.overallBrightness.toString());
    this.ambientLight.intensity = (this.ambientLight.userData.baseIntensity || 0.95) * this.overallBrightness;
    this.keyLight.intensity = (this.keyLight.userData.baseIntensity || 1.4) * this.overallBrightness;
    this.fillLight.intensity = (this.fillLight.userData.baseIntensity || 0.85) * this.overallBrightness;
  }

  applyVisualAdjustments() {
    if (!this.currentVrm) return;

    this.currentVrm.scene.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((mat) => {
          const name = (mat.name || '').toLowerCase();
          const isHair = name.includes('hair') || name.includes('kami') || name.includes('toufa');
          const isSkin =
            name.includes('face') ||
            name.includes('skin') ||
            name.includes('body') ||
            name.includes('head') ||
            name.includes('hada') ||
            name.includes('kao') ||
            name.includes('arm') ||
            name.includes('leg');

          const scale = isHair
            ? this.hairBrightness
            : isSkin
            ? this.skinBrightness
            : 1.0;

          if (mat.color) {
            if (!mat.userData.baseColor) {
              mat.userData.baseColor = mat.color.clone();
            }
            mat.color.copy(mat.userData.baseColor).multiplyScalar(scale);
          }

          if (mat.shadeColor) {
            if (!mat.userData.baseShadeColor) {
              mat.userData.baseShadeColor = mat.shadeColor.clone();
            }
            mat.shadeColor.copy(mat.userData.baseShadeColor).multiplyScalar(scale);
          }
        });
      }
    });
  }

  async loadModel(urlOrFile) {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const isFBX =
        (Array.isArray(urlOrFile) && urlOrFile.some((f) => f.name?.toLowerCase().endsWith('.fbx'))) ||
        (urlOrFile instanceof File && urlOrFile.name.toLowerCase().endsWith('.fbx')) ||
        (typeof urlOrFile === 'string' && urlOrFile.toLowerCase().includes('.fbx'));

      let vrm = null;

      if (isFBX) {
        if (this.onLoadProgress) {
          this.onLoadProgress(15, 'Initializing FBX neural avatar...');
        }
        vrm = await this.fbxAvatarLoader.load(urlOrFile, {
          onProgress: (pct, msg) => {
            if (this.onLoadProgress) this.onLoadProgress(pct, msg);
          }
        });
      } else {
        let url = urlOrFile;
        if (urlOrFile instanceof File) {
          url = URL.createObjectURL(urlOrFile);
        }

        if (this.onLoadProgress) {
          this.onLoadProgress(10, 'Initializing 3D neural assets...');
        }

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        let simulatedPct = 12;
        const gltf = await new Promise((resolve, reject) => {
          loader.load(
            url,
            (g) => {
              if (this.onLoadProgress) {
                this.onLoadProgress(90, 'Compiling shaders & spring bones...');
              }
              resolve(g);
            },
            (progress) => {
              if (this.onLoadProgress) {
                if (progress.total > 0) {
                  const pct = Math.min(88, Math.round((progress.loaded / progress.total) * 88));
                  this.onLoadProgress(pct, `Downloading model assets (${pct}%)...`);
                } else {
                  simulatedPct = Math.min(85, simulatedPct + 6);
                  this.onLoadProgress(simulatedPct, `Downloading character neural mesh (${simulatedPct}%)...`);
                }
              }
            },
            (err) => reject(err)
          );
        });

        vrm = gltf.userData.vrm;
        if (!vrm) {
          throw new Error('GLTF loaded is not a valid VRM model.');
        }

        if (this.onLoadProgress) {
          this.onLoadProgress(95, 'Optimizing humanoid skeleton...');
        }

        // Optimize VRM performance & orientation (matching My Portfolio VRMCharacterEngine)
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        if (VRMUtils?.rotateVRM0) {
          VRMUtils.rotateVRM0(vrm);
        }
      }

      // Clean up previous model if any
      if (this.currentVrm) {
        this.scene.remove(this.currentVrm.scene);
        if (this.currentVrm.isFBX) {
          this.currentVrm.scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
              });
            }
          });
        } else {
          VRMUtils.deepDispose(this.currentVrm.scene);
        }
      }

      this.currentVrm = vrm;
      this.currentModelUrl = typeof urlOrFile === 'string' ? urlOrFile : (vrm.meta?.title || 'Custom Avatar');

      // Position model: centered, standing on floor, facing user directly
      vrm.scene.position.set(0, 0, 0);
      vrm.scene.rotation.set(0, Math.PI, 0); // Face user/camera directly from front

      // Reset camera azimuth & drag deltas so character is framed dead-center front-facing
      this.cameraSpherical.theta = 0;
      this._cameraOffset.setFromSpherical(this.cameraSpherical);
      this.camera.position.copy(this.cameraTarget).add(this._cameraOffset);
      this.camera.lookAt(this.cameraTarget);
      this.turnDeltaX = 0;
      this.turnDeltaY = 0;

      // Initial natural arm drop so character is not in stiff T-pose
      this.poseRestingArms(vrm);

      // Apply initial skin & hair brightness adjustments
      this.applyVisualAdjustments();

      // Enable shadows & render properties on meshes
      vrm.scene.traverse((obj) => {
        if (obj.isMesh) {
          if (!this.isMobile) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
          if (obj.material && !obj.material.transparent) {
            obj.material.depthWrite = true;
          }
        }
      });

      this.scene.add(vrm.scene);
      this.isLoading = false;

      // Notify ALL registered listeners (AnimationEngine, ExpressionManager, LipSync, LifeSimulator, etc.)
      // Awaiting listeners ensures the idle animation is active and rendered before the loader screen disappears
      for (const cb of this.modelLoadedListeners) {
        try {
          await cb(vrm);
        } catch (err) {
          console.error('[VRMManager] Model listener error:', err);
        }
      }

      if (this.onLoadProgress) {
        this.onLoadProgress(100, 'Companion Ready!');
      }

      return vrm;
    } catch (err) {
      this.isLoading = false;
      console.error('Failed to load model:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  onWindowResize() {
    this.updateCameraForScreen();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.currentDpr);
  }

  setChairVisible(isSitting) {
    // Chair has been removed; no-op safely
  }

  /**
   * Real-time soft breeze physics simulation across hair, ribbons, and cloth
   */
  updateBreeze(deltaTime) {
    if (!this.currentVrm?.springBoneManager?.joints) return;

    // On mobile devices, throttle breeze physics updates to ~25Hz to preserve battery and prevent thermal throttling
    if (this.isMobile) {
      this._breezeThrottle = (this._breezeThrottle || 0) + deltaTime;
      if (this._breezeThrottle < 0.04) return;
      this._breezeThrottle = 0;
    }

    this.windTime = (this.windTime || 0) + deltaTime;
    const t = this.windTime;

    // Gentle natural micro-breeze: gravity remains primarily downward (-1.0) so hair & ribbons hang naturally
    // without being blown horizontally sideways
    const windX = Math.sin(t * 1.5) * 0.028 + Math.cos(t * 0.7) * 0.012;
    const windZ = Math.cos(t * 1.2) * 0.022 + Math.sin(t * 2.6) * 0.010;

    if (!this._breezeDir) {
      this._breezeDir = new THREE.Vector3();
    }
    // Normalize ONCE per frame instead of hundreds of times inside the joint loop
    this._breezeDir.set(windX, -1.0, windZ).normalize();

    const joints = this.currentVrm.springBoneManager.joints;
    for (let i = 0; i < joints.length; i++) {
      const boneName = (joints[i].bone?.name || '').toLowerCase();
      // Exclude breast bones so ambient wind breeze does not pull or distort them
      if (boneName.includes('breast') || boneName.includes('mune') || boneName.includes('bust')) {
        continue;
      }

      const settings = joints[i].settings;
      if (!settings) continue;

      if (settings._origGravityPower === undefined) {
        settings._origGravityPower = (settings.gravityPower !== undefined && settings.gravityPower > 0) ? settings.gravityPower : 1.0;
      }

      // Preserve natural downward gravity power (ensures hair and ribbons hang down gracefully)
      settings.gravityPower = settings._origGravityPower;

      if (settings.gravityDir) {
        settings.gravityDir.copy(this._breezeDir);
      }
    }
  }

  render(deltaTime) {
    if (this.currentVrm) {
      // 1. Real-time breeze physics vectors (modifies spring bone joint forces)
      if (this.graphicsQuality !== 'low' && this.currentVrm.springBoneManager) {
        this.updateBreeze(deltaTime);
      }
      // 2. VRM update: @pixiv/three-vrm already updates humanoid, lookAt, and springBoneManager
      // (Redundant second springBoneManager.update call eliminated to save 50% physics CPU)
      this.currentVrm.update(deltaTime);

      // 3. Phone Gyroscope Head/Gaze tracking (blends natural head rotation clamped to human limits)
      if (this.gyroEnabled) {
        this.updateGyro(deltaTime);
      }

      // 4. Apply physics-based rotational inertia & dynamic secondary motion for chest/breast bones
      // Executes directly after currentVrm.update so it blends dynamically on top of spring bones & animations!
      if (this.chestPhysics) {
        this.chestPhysics.update(deltaTime);
      }
    }

    // Adaptive FPS watchdog: dynamically optimize pixel ratio if low-end device is dropping frames
    this.frameCount++;
    this.frameTimeAccum += deltaTime;
    if (this.frameTimeAccum >= 2.0) {
      const avgFps = this.frameCount / this.frameTimeAccum;
      const minDpr = this.isMobile ? 0.75 : 1.0;
      if (avgFps < 22 && this.currentDpr > minDpr) {
        this.currentDpr = Math.max(minDpr, this.currentDpr - 0.1);
        this.renderer.setPixelRatio(this.currentDpr);
      }
      this.frameCount = 0;
      this.frameTimeAccum = 0;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
