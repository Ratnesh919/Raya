import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class VRMManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.currentVrm = null;
    this.currentModelUrl = null;
    this.isLoading = false;

    // Visual adjustment settings matching user configuration (70% skin, 50% hair, 55% lighting)
    if (!localStorage.getItem('raya_visual_defaults_v5')) {
      localStorage.setItem('raya_visual_defaults_v5', 'true');
      localStorage.setItem('raya_skin_brightness', '0.70');
      localStorage.setItem('raya_hair_brightness', '0.50');
      localStorage.setItem('raya_overall_brightness', '0.55');
    }
    this.skinBrightness = parseFloat(localStorage.getItem('raya_skin_brightness') || '0.70');
    this.hairBrightness = parseFloat(localStorage.getItem('raya_hair_brightness') || '0.50');
    this.overallBrightness = parseFloat(localStorage.getItem('raya_overall_brightness') || '0.55');

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

    this.updateCameraForScreen();
    this.camera.position.copy(this.cameraPortraitPos);
    this.camera.lookAt(this.cameraPortraitTarget);

    // 5. Lighting
    this.setupLighting();

    // 6. Orbit & Drag state (with mobile touch & pinch zoom)
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.setupInteractions();

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
      const phoneScale = 1.0 / Math.max(aspect, 0.45);
      this.cameraPortraitPos.set(0, 1.34, 1.85 * Math.min(phoneScale * 0.65, 1.4));
      this.cameraPortraitTarget.set(0, 1.30, 0);
      this.cameraFullBodyPos.set(0, 1.12, 3.8 * Math.min(phoneScale * 0.72, 1.55));
      this.cameraFullBodyTarget.set(0, 1.02, 0);
    } else {
      this.cameraPortraitPos.set(0, 1.38, 1.58);
      this.cameraPortraitTarget.set(0, 1.35, 0);
      this.cameraFullBodyPos.set(0, 1.25, 3.8);
      this.cameraFullBodyTarget.set(0, 1.15, 0);
    }

    this.camera.updateProjectionMatrix();
    const targetPos = this.currentCameraMode === 'full' ? this.cameraFullBodyPos : this.cameraPortraitPos;
    const targetLook = this.currentCameraMode === 'full' ? this.cameraFullBodyTarget : this.cameraPortraitTarget;
    this.camera.position.copy(targetPos);
    this.camera.lookAt(targetLook);
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

    // Desktop Pointer Controls
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging || !this.currentVrm) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      this.currentVrm.scene.rotation.y += deltaX * 0.008;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('wheel', (e) => {
      const zoomDelta = e.deltaY * 0.002;
      const newZ = THREE.MathUtils.clamp(this.camera.position.z + zoomDelta, 1.2, 6.5);
      this.camera.position.z = newZ;
    }, { passive: true });

    // Mobile Touch Drag & Pinch-to-Zoom
    let touchStartDist = 0;
    let touchStartZ = 0;

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartZ = this.camera.position.z;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging && this.currentVrm) {
        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        this.currentVrm.scene.rotation.y += deltaX * 0.01;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = touchStartDist / Math.max(currentDist, 1);
        this.camera.position.z = THREE.MathUtils.clamp(touchStartZ * factor, 1.2, 6.5);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
      touchStartDist = 0;
    }, { passive: true });
  }

  setCameraMode(mode = 'portrait') {
    this.currentCameraMode = mode;
    const targetPos = mode === 'full' ? this.cameraFullBodyPos : this.cameraPortraitPos;
    const targetLook = mode === 'full' ? this.cameraFullBodyTarget : this.cameraPortraitTarget;

    const startPos = this.camera.position.clone();
    const startTime = performance.now();
    const duration = 650; // ms

    const animateCamera = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 0.5 - Math.cos(t * Math.PI) / 2;

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.camera.lookAt(targetLook);

      if (t < 1) {
        requestAnimationFrame(animateCamera);
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

      const vrm = gltf.userData.vrm;
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

      // Clean up previous model if any
      if (this.currentVrm) {
        this.scene.remove(this.currentVrm.scene);
        VRMUtils.deepDispose(this.currentVrm.scene);
      }

      this.currentVrm = vrm;
      this.currentModelUrl = url;

      // Position model: centered, standing on floor, facing user directly
      vrm.scene.position.set(0, 0, 0);
      vrm.scene.rotation.y = Math.PI; // Face user/camera by default

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
      console.error('Failed to load VRM model:', err);
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
    this.windTime = (this.windTime || 0) + deltaTime;
    const t = this.windTime;

    // Organic multi-harmonic breeze vectors (gentle gusts, direction shifts)
    const windX = Math.sin(t * 1.5) * 0.38 + Math.sin(t * 3.1) * 0.14 + Math.cos(t * 0.7) * 0.08;
    const windZ = Math.cos(t * 1.2) * 0.28 + Math.sin(t * 2.6) * 0.12;
    const windStrength = 0.55 + Math.sin(t * 0.9) * 0.22 + Math.cos(t * 2.2) * 0.10;

    for (const joint of this.currentVrm.springBoneManager.joints) {
      if (!joint.settings) continue;

      if (joint.settings._origGravityPower === undefined) {
        joint.settings._origGravityPower = joint.settings.gravityPower || 0;
      }

      // Gently flutter hair and clothing even if model author assigned 0 base gravity
      joint.settings.gravityPower = Math.max(joint.settings._origGravityPower, 0.48 * windStrength);

      if (joint.settings.gravityDir) {
        joint.settings.gravityDir.set(windX, -0.82, windZ).normalize();
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
