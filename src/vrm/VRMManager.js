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
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    const isLowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                     (navigator.deviceMemory && navigator.deviceMemory <= 4);

    this.graphicsQuality = localStorage.getItem('raya_graphics_quality') || (isLowEnd ? 'low' : (isMobile ? 'balanced' : 'high'));
    this.currentDpr = this.graphicsQuality === 'high' ? Math.min(window.devicePixelRatio, 2.0) : (this.graphicsQuality === 'balanced' ? Math.min(window.devicePixelRatio, 1.5) : 1.0);

    // 1. High Performance WebGL Renderer with hardware antialiasing (MSAA)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true, // Hardware 4x MSAA
      powerPreference: 'high-performance', // Forces discrete/high-power GPU on PC & mobile
      precision: this.graphicsQuality === 'low' ? 'mediump' : 'highp',
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

    // 3. 3D Antique Chair for Sitting Animations and Room Setting
    this.chairGroup = new THREE.Group();
    this.chairGroup.name = 'RayaChairGroup';
    this.chairGroup.visible = true;
    this.scene.add(this.chairGroup);
    this.loadAntiqueChair('/models/antique_chair.glb');

    // 4. Camera with responsive mobile framing
    this.camera = new THREE.PerspectiveCamera(
      28,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    this.cameraDefaultPos = new THREE.Vector3(0, 1.25, 3.8);
    this.cameraClosePos = new THREE.Vector3(0, 1.35, 1.9); // Portrait talking focus
    this.cameraTarget = new THREE.Vector3(0, 1.15, 0);
    this.currentCameraMode = 'default';

    this.updateCameraForScreen();
    this.camera.position.copy(this.cameraDefaultPos);
    this.camera.lookAt(this.cameraTarget);

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
    if (level === 'high') {
      this.currentDpr = Math.min(window.devicePixelRatio, 2.0);
    } else if (level === 'balanced') {
      this.currentDpr = Math.min(window.devicePixelRatio, 1.5);
    } else {
      this.currentDpr = 1.0;
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
      this.cameraDefaultPos.set(0, 1.12, 3.8 * Math.min(phoneScale * 0.72, 1.55));
      this.cameraClosePos.set(0, 1.28, 2.2 * Math.min(phoneScale * 0.65, 1.4));
      this.cameraTarget.set(0, 1.02, 0);
    } else {
      this.cameraDefaultPos.set(0, 1.25, 3.8);
      this.cameraClosePos.set(0, 1.35, 1.9);
      this.cameraTarget.set(0, 1.15, 0);
    }

    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.cameraTarget);
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

  setCameraMode(mode = 'default') {
    this.currentCameraMode = mode;
    const targetPos = mode === 'portrait' ? this.cameraClosePos : this.cameraDefaultPos;
    const targetLook = mode === 'portrait' ? new THREE.Vector3(0, 1.30, 0) : this.cameraTarget;

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
    if (!vrmInstance?.humanoid) return;
    const lArm = vrmInstance.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rArm = vrmInstance.humanoid.getNormalizedBoneNode('rightUpperArm');
    if (lArm) {
      lArm.rotation.z = 1.25;
      lArm.rotation.x = 0.1;
    }
    if (rArm) {
      rArm.rotation.z = -1.25;
      rArm.rotation.x = 0.1;
    }
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
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (obj.material) {
            obj.material.depthWrite = true;
          }
        }
      });

      this.scene.add(vrm.scene);
      this.isLoading = false;

      // Notify ALL registered listeners (AnimationEngine, ExpressionManager, LipSync, LifeSimulator, etc.)
      this.modelLoadedListeners.forEach((cb) => {
        try {
          cb(vrm);
        } catch (err) {
          console.error('[VRMManager] Model listener error:', err);
        }
      });

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
  }

  /**
   * Loads and accurately positions the 3D Antique Chair for sitting animations
   */
  loadAntiqueChair(url = '/models/antique_chair.glb') {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      url,
      (gltf) => {
        const chairModel = gltf.scene;
        chairModel.name = 'RayaAntiqueChairModel';

        // Traverse to enable shadows and optimize materials
        chairModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              // Calibrate materials: Sketchfab 1.0 metalness renders pitch black without HDR;
              // 0.12 metalness and 0.55 roughness brings out gorgeous antique mahogany wood, gold trim, and red velvet cushion
              node.material.metalness = 0.12;
              node.material.roughness = 0.55;
              node.material.needsUpdate = true;
            }
          }
        });

        // Compute raw bounds to normalize scale and ground floor contact
        const rawBox = new THREE.Box3().setFromObject(chairModel);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);

        console.log('[VRMManager] Loaded Antique Chair GLB. Raw dimensions:', rawSize);

        // Ergonomic human scale: seat height at 0.46m, total backrest height ~1.21m
        const scale = 0.5234;
        chairModel.scale.set(scale, scale, scale);

        // Ground feet at Y = 0 and center seat cushion at origin (X=0, Z=0)
        chairModel.position.set(
          -0.06 * scale,
          1.3108 * scale,
          -0.562 * scale
        );

        // Clear existing children in chairGroup and append calibrated model
        while (this.chairGroup.children.length > 0) {
          this.chairGroup.remove(this.chairGroup.children[0]);
        }
        this.chairGroup.add(chairModel);

        // Position chair in scene: comfortably behind avatar's standing space
        this.chairGroup.position.set(0, 0, -0.22);
        console.log('[VRMManager] Antique Chair successfully grounded and calibrated.');
      },
      undefined,
      (err) => {
        console.warn('[VRMManager] Could not load antique chair GLB, using fallback chair:', err);
        const fallback = this.createFallbackChair();
        this.chairGroup.add(fallback);
      }
    );
  }

  createFallbackChair() {
    const chair = new THREE.Group();
    chair.name = 'RayaFallbackChair';

    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x18102e,
      roughness: 0.42,
      metalness: 0.15
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd8b4fe,
      metalness: 0.88,
      roughness: 0.18
    });

    const seatGeo = new THREE.CylinderGeometry(0.32, 0.30, 0.09, 32);
    const seatMesh = new THREE.Mesh(seatGeo, cushionMat);
    seatMesh.position.set(0, 0.46, 0);
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    chair.add(seatMesh);

    const backGeo = new THREE.BoxGeometry(0.46, 0.36, 0.05);
    const backMesh = new THREE.Mesh(backGeo, cushionMat);
    backMesh.position.set(0, 0.72, -0.22);
    chair.add(backMesh);

    chair.position.set(0, 0, -0.06);
    return chair;
  }

  setChairVisible(isSitting) {
    if (this.chairGroup) {
      this.chairGroup.visible = true;
    }
    // Smooth camera framing: lower camera target slightly when seated to center character
    if (this.cameraTarget) {
      this.cameraTarget.set(0, isSitting ? 1.02 : 1.15, 0);
    }
    if (this.camera) {
      this.camera.lookAt(this.cameraTarget);
    }
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
      this.currentVrm.update(deltaTime);
      // Soft real-time breeze physics for hair and cloth
      if (this.graphicsQuality !== 'low' && this.currentVrm.springBoneManager) {
        this.updateBreeze(deltaTime);
        this.currentVrm.springBoneManager.update(deltaTime);
      }
    }

    // Adaptive FPS watchdog: dynamically optimize pixel ratio if low-end device is dropping frames
    this.frameCount++;
    this.frameTimeAccum += deltaTime;
    if (this.frameTimeAccum >= 2.0) {
      const avgFps = this.frameCount / this.frameTimeAccum;
      if (avgFps < 22 && this.currentDpr > 0.75) {
        this.currentDpr = Math.max(0.75, this.currentDpr - 0.1);
        this.renderer.setPixelRatio(this.currentDpr);
      }
      this.frameCount = 0;
      this.frameTimeAccum = 0;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
