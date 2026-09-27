import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRMHumanoid } from '@pixiv/three-vrm';

// Comprehensive Biped & Generic Rig to VRM Humanoid Bone Mapping
const BONE_CANDIDATES = {
  // Body Bones
  hips: ['bip001pelvis', 'bip01pelvis', 'pelvis', 'hip', 'hips', 'mixamorighips'],
  spine: ['bip001spine', 'bip01spine', 'spine', 'mixamorigspine'],
  chest: ['bip001spine1', 'bip01spine1', 'spine1', 'chest', 'mixamorigspine1'],
  upperChest: ['bip001spine2', 'bip01spine2', 'spine2', 'upperchest', 'mixamorigspine2'],
  neck: ['bip001neck', 'bip01neck', 'neck', 'mixamorigneck'],
  head: ['bip001head', 'bip01head', 'head', 'mixamorighead'],

  leftShoulder: ['bip001lclavicle', 'bip01lclavicle', 'clavicle_l', 'l_clavicle', 'shoulder_l', 'mixamorigleftshoulder'],
  leftUpperArm: ['bip001lupperarm', 'bip01lupperarm', 'upperarm_l', 'l_upperarm', 'arm_l', 'mixamorigleftarm'],
  leftLowerArm: ['bip001lforearm', 'bip01lforearm', 'forearm_l', 'l_forearm', 'lowerarm_l', 'mixamorigleftforearm'],
  leftHand: ['bip001lhand', 'bip01lhand', 'hand_l', 'l_hand', 'wrist_l', 'mixamoriglefthand'],

  rightShoulder: ['bip001rclavicle', 'bip01rclavicle', 'clavicle_r', 'r_clavicle', 'shoulder_r', 'mixamorigrightshoulder'],
  rightUpperArm: ['bip001rupperarm', 'bip01rupperarm', 'upperarm_r', 'r_upperarm', 'arm_r', 'mixamorigrightarm'],
  rightLowerArm: ['bip001rforearm', 'bip01rforearm', 'forearm_r', 'r_forearm', 'lowerarm_r', 'mixamorigrightforearm'],
  rightHand: ['bip001rhand', 'bip01rhand', 'hand_r', 'r_hand', 'wrist_r', 'mixamorigrighthand'],

  leftUpperLeg: ['bip001lthigh', 'bip01lthigh', 'thigh_l', 'l_thigh', 'upperleg_l', 'mixamorigleftupleg'],
  leftLowerLeg: ['bip001lcalf', 'bip01lcalf', 'calf_l', 'l_calf', 'lowerleg_l', 'mixamorigleftleg'],
  leftFoot: ['bip001lfoot', 'bip01lfoot', 'foot_l', 'l_foot', 'ankle_l', 'mixamorigleftfoot'],
  leftToes: ['bip001ltoe0', 'bip01ltoe0', 'toe_l', 'l_toe', 'toes_l', 'mixamoriglefttoebase'],

  rightUpperLeg: ['bip001rthigh', 'bip01rthigh', 'thigh_r', 'r_thigh', 'upperleg_r', 'mixamorigrightupleg'],
  rightLowerLeg: ['bip001rcalf', 'bip01rcalf', 'calf_r', 'r_calf', 'lowerleg_r', 'mixamorigrightleg'],
  rightFoot: ['bip001rfoot', 'bip01rfoot', 'foot_r', 'r_foot', 'ankle_r', 'mixamorigrightfoot'],
  rightToes: ['bip001rtoe0', 'bip01rtoe0', 'toe_r', 'r_toe', 'toes_r', 'mixamorigrighttoebase'],

  // Left Hand Fingers
  leftThumbMetacarpal: ['bip001lfinger0', 'bip01lfinger0', 'thumb_01_l', 'l_thumb1', 'mixamoriglefthandthumb1'],
  leftThumbProximal: ['bip001lfinger01', 'bip01lfinger01', 'thumb_02_l', 'l_thumb2', 'mixamoriglefthandthumb2'],
  leftThumbDistal: ['bip001lfinger02', 'bip01lfinger02', 'thumb_03_l', 'l_thumb3', 'mixamoriglefthandthumb3'],
  leftIndexProximal: ['bip001lfinger1', 'bip01lfinger1', 'index_01_l', 'l_index1', 'mixamoriglefthandindex1'],
  leftIndexIntermediate: ['bip001lfinger11', 'bip01lfinger11', 'index_02_l', 'l_index2', 'mixamoriglefthandindex2'],
  leftIndexDistal: ['bip001lfinger12', 'bip01lfinger12', 'index_03_l', 'l_index3', 'mixamoriglefthandindex3'],
  leftMiddleProximal: ['bip001lfinger2', 'bip01lfinger2', 'middle_01_l', 'l_middle1', 'mixamoriglefthandmiddle1'],
  leftMiddleIntermediate: ['bip001lfinger21', 'bip01lfinger21', 'middle_02_l', 'l_middle2', 'mixamoriglefthandmiddle2'],
  leftMiddleDistal: ['bip001lfinger22', 'bip01lfinger22', 'middle_03_l', 'l_middle3', 'mixamoriglefthandmiddle3'],
  leftRingProximal: ['bip001lfinger3', 'bip01lfinger3', 'ring_01_l', 'l_ring1', 'mixamoriglefthandring1'],
  leftRingIntermediate: ['bip001lfinger31', 'bip01lfinger31', 'ring_02_l', 'l_ring2', 'mixamoriglefthandring2'],
  leftRingDistal: ['bip001lfinger32', 'bip01lfinger32', 'ring_03_l', 'l_ring3', 'mixamoriglefthandring3'],
  leftLittleProximal: ['bip001lfinger4', 'bip01lfinger4', 'pinky_01_l', 'little_01_l', 'l_pinky1', 'mixamoriglefthandpinky1'],
  leftLittleIntermediate: ['bip001lfinger41', 'bip01lfinger41', 'pinky_02_l', 'little_02_l', 'l_pinky2', 'mixamoriglefthandpinky2'],
  leftLittleDistal: ['bip001lfinger42', 'bip01lfinger42', 'pinky_03_l', 'little_03_l', 'l_pinky3', 'mixamoriglefthandpinky3'],

  // Right Hand Fingers
  rightThumbMetacarpal: ['bip001rfinger0', 'bip01rfinger0', 'thumb_01_r', 'r_thumb1', 'mixamorigrighthandthumb1'],
  rightThumbProximal: ['bip001rfinger01', 'bip01rfinger01', 'thumb_02_r', 'r_thumb2', 'mixamorigrighthandthumb2'],
  rightThumbDistal: ['bip001rfinger02', 'bip01rfinger02', 'thumb_03_r', 'r_thumb3', 'mixamorigrighthandthumb3'],
  rightIndexProximal: ['bip001rfinger1', 'bip01rfinger1', 'index_01_r', 'r_index1', 'mixamorigrighthandindex1'],
  rightIndexIntermediate: ['bip001rfinger11', 'bip01rfinger11', 'index_02_r', 'r_index2', 'mixamorigrighthandindex2'],
  rightIndexDistal: ['bip001rfinger12', 'bip01rfinger12', 'index_03_r', 'r_index3', 'mixamorigrighthandindex3'],
  rightMiddleProximal: ['bip001rfinger2', 'bip01rfinger2', 'middle_01_r', 'r_middle1', 'mixamorigrighthandmiddle1'],
  rightMiddleIntermediate: ['bip001rfinger21', 'bip01rfinger21', 'middle_02_r', 'r_middle2', 'mixamorigrighthandmiddle2'],
  rightMiddleDistal: ['bip001rfinger22', 'bip01rfinger22', 'middle_03_r', 'r_middle3', 'mixamorigrighthandmiddle3'],
  rightRingProximal: ['bip001rfinger3', 'bip01rfinger3', 'ring_01_r', 'r_ring1', 'mixamorigrighthandring1'],
  rightRingIntermediate: ['bip001rfinger31', 'bip01rfinger31', 'ring_02_r', 'r_ring2', 'mixamorigrighthandring2'],
  rightRingDistal: ['bip001rfinger32', 'bip01rfinger32', 'ring_03_r', 'r_ring3', 'mixamorigrighthandring3'],
  rightLittleProximal: ['bip001rfinger4', 'bip01rfinger4', 'pinky_01_r', 'little_01_r', 'r_pinky1', 'mixamorigrighthandpinky1'],
  rightLittleIntermediate: ['bip001rfinger41', 'bip01rfinger41', 'pinky_02_r', 'little_02_r', 'r_pinky2', 'mixamorigrighthandpinky2'],
  rightLittleDistal: ['bip001rfinger42', 'bip01rfinger42', 'pinky_03_r', 'little_03_r', 'r_pinky3', 'mixamorigrighthandpinky3']
};

// Facial Blendshape & Viseme Morph Target Mapping
const MORPH_TARGET_PRESETS = {
  // Eye blinks
  blink: ['E_Close', 'blink', 'Blink', 'eye_close', 'eyeClose', 'Fcl_EYE_Close'],
  blinkLeft: ['E_Close_L', 'blink_l', 'Blink_L', 'blinkLeft', 'eye_close_l'],
  blinkRight: ['E_Close_R', 'blink_r', 'Blink_R', 'blinkRight', 'eye_close_r'],

  // Emotions
  happy: ['B_Happy', 'B_Cheerful', 'E_Smile_R', 'E_Smile_L', 'M_Smile_R', 'M_Smile_L', 'happy', 'Joy', 'fun', 'joy'],
  relaxed: ['B_Cheerful', 'M_Smile_R', 'M_Smile_L', 'relaxed', 'fun'],
  sad: ['B_Sad', 'E_Sad', 'sad', 'Sorrow', 'sorrow'],
  angry: ['B_Anger', 'E_Anger', 'M_Anger', 'angry', 'Angry'],
  surprised: ['B_Up_Add', 'E_Focus', 'surprised', 'Surprised'],
  think: ['B_Flat', 'E_Focus', 'confused'],

  // Visemes (Lip-Sync Mouth Articulation)
  aa: ['Aa', 'A', 'M_A', 'mouth_a', 'v_aa', 'aa', 'viseme_aa'],
  ee: ['E', 'M_E', 'mouth_e', 'v_ee', 'ee', 'viseme_ee'],
  ih: ['I', 'M_I', 'mouth_i', 'v_ih', 'ih', 'viseme_ih'],
  oh: ['O', 'M_O', 'mouth_o', 'v_oh', 'oh', 'viseme_oh'],
  ou: ['U', 'M_U', 'mouth_u', 'v_ou', 'ou', 'viseme_ou'],

  // Gaze / LookAt
  lookUp: ['Pupil_Up', 'lookUp'],
  lookDown: ['Pupil_Down', 'lookDown'],
  lookRight: ['Pupil_R', 'lookRight'],
  lookLeft: ['Pupil_L', 'lookLeft']
};

export class FBXAvatarLoader {
  constructor() {
    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Load FBX model from URL or File/FileList, automatically configure materials,
   * map humanoid skeleton with VRMHumanoid, and wrap morph targets with ExpressionManager.
   *
   * @param {string|File|File[]} urlOrFiles
   * @param {Object} options
   * @param {Function} options.onProgress
   * @returns {Promise<Object>} Avatar wrapper with VRM-compatible interface
   */
  async load(urlOrFiles, options = {}) {
    const { onProgress } = options;

    let fbxFile = null;
    let url = null;
    const localTextureFiles = new Map();

    if (Array.isArray(urlOrFiles)) {
      for (const f of urlOrFiles) {
        const lower = f.name.toLowerCase();
        if (lower.endsWith('.fbx')) {
          fbxFile = f;
        } else if (/\.(png|jpe?g|webp|bmp)$/i.test(lower)) {
          localTextureFiles.set(lower, URL.createObjectURL(f));
          // Strip prefix/suffix for fuzzy matching (e.g. "t_...bangs_d.png" -> "bangs")
          const cleanName = lower.replace(/^t_/, '').replace(/(_d|_n|_hm|_id|_m)?\.[^.]+$/, '');
          localTextureFiles.set(cleanName, URL.createObjectURL(f));
        }
      }
    } else if ((typeof File !== 'undefined' && urlOrFiles instanceof File) || (urlOrFiles && typeof urlOrFiles === 'object' && urlOrFiles.name?.toLowerCase().endsWith('.fbx'))) {
      if (urlOrFiles.name.toLowerCase().endsWith('.fbx')) {
        fbxFile = urlOrFiles;
      }
    } else if (typeof urlOrFiles === 'string') {
      url = urlOrFiles;
    }

    if (onProgress) onProgress(20, 'Reading FBX geometry & skeleton...');

    let asset = null;
    if (fbxFile) {
      const buffer = await fbxFile.arrayBuffer();
      asset = this.fbxLoader.parse(buffer, '');
    } else if (url) {
      asset = await new Promise((resolve, reject) => {
        this.fbxLoader.load(
          url,
          (g) => resolve(g),
          (xhr) => {
            if (xhr.total > 0 && onProgress) {
              const pct = Math.min(80, Math.round((xhr.loaded / xhr.total) * 60) + 20);
              onProgress(pct, `Downloading FBX model (${pct}%)...`);
            }
          },
          (err) => reject(err)
        );
      });
    } else {
      throw new Error('No valid FBX file or URL provided');
    }

    if (onProgress) onProgress(82, 'Normalizing coordinate frame & orientation...');

    // 1. Auto-Orientation & Scaling (Handles Unreal Engine cm scale & +Z up convention)
    const initialBox = new THREE.Box3().setFromObject(asset);
    const initialSize = initialBox.getSize(new THREE.Vector3());

    // Unreal / 3ds Max exports have height along Z axis
    if (initialSize.z > initialSize.y * 1.2) {
      asset.rotation.x = -Math.PI / 2;
    }

    // Centimeter to Meter scale conversion
    if (Math.max(initialSize.y, initialSize.z) > 10) {
      asset.scale.setScalar(0.01);
    }
    asset.updateMatrixWorld(true);

    // Ground feet at Y = 0.00
    const transformedBox = new THREE.Box3().setFromObject(asset);
    if (Math.abs(transformedBox.min.y) > 0.001) {
      asset.position.y -= transformedBox.min.y;
      asset.updateMatrixWorld(true);
    }

    if (onProgress) onProgress(88, 'Mapping humanoid bones & textures...');

    // 2. Bone Discovery and VRMHumanoid Rig Construction
    const allBones = new Map();
    asset.traverse((child) => {
      if (child.isBone || (child.isObject3D && child.type === 'Bone')) {
        const lower = child.name.toLowerCase();
        allBones.set(lower, child);
        // Strip common prefixes (e.g. "bip001-", "mixamorig:")
        allBones.set(lower.replace(/^(bip001|bip01|mixamorig)[:_]?/i, ''), child);
      }
    });

    const humanBones = {};
    for (const [vrmBoneName, candidates] of Object.entries(BONE_CANDIDATES)) {
      for (const cand of candidates) {
        const match = allBones.get(cand.toLowerCase());
        if (match) {
          humanBones[vrmBoneName] = { node: match };
          break;
        }
      }
    }

    // Instantiate official VRMHumanoid for retargeting & normalized bone animation
    let humanoid = null;
    try {
      if (humanBones.hips) {
        humanoid = new VRMHumanoid(humanBones);
      }
    } catch (e) {
      console.warn('[FBXAvatarLoader] VRMHumanoid creation warning:', e);
    }

    // 3. Texture Binding & Material Setup
    const baseDir = url ? url.substring(0, url.lastIndexOf('/') + 1) : '';
    await this.setupMaterials(asset, baseDir, localTextureFiles);

    // 4. Wrap Morph Targets into VRM-compatible ExpressionManager
    const expressionManager = this.createExpressionManager(asset);

    // 5. Wrap everything into a VRM-compatible Avatar object
    const wrapperGroup = new THREE.Group();
    wrapperGroup.name = 'FBXAvatarRoot';
    wrapperGroup.add(asset);

    if (humanoid?.normalizedHumanBonesRoot) {
      wrapperGroup.add(humanoid.normalizedHumanBonesRoot);
    }

    // Clean face-forward default rotation
    wrapperGroup.rotation.y = Math.PI;

    if (onProgress) onProgress(98, 'Finalizing avatar systems...');

    const avatar = {
      isFBX: true,
      scene: wrapperGroup,
      humanoid,
      expressionManager,
      meta: {
        metaVersion: '0',
        title: url ? url.split('/').pop().replace('.fbx', '') : 'FBX Avatar'
      },
      springBoneManager: {
        joints: [] // Safe empty joints array for breeze simulation
      },
      update(delta) {
        if (humanoid) humanoid.update();
        if (expressionManager) expressionManager.update();
      }
    };

    return avatar;
  }

  /**
   * Automatically resolve diffuse & alpha textures for model materials
   */
  async setupMaterials(asset, baseDir, localTextureFiles) {
    const textureCache = new Map();

    const loadTexture = (pathOrBlob) => {
      if (textureCache.has(pathOrBlob)) {
        return Promise.resolve(textureCache.get(pathOrBlob));
      }
      return new Promise((resolve) => {
        this.textureLoader.load(
          pathOrBlob,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = true;
            textureCache.set(pathOrBlob, tex);
            resolve(tex);
          },
          undefined,
          () => resolve(null)
        );
      });
    };

    const meshes = [];
    asset.traverse((obj) => {
      if (obj.isMesh) meshes.push(obj);
    });

    for (const mesh of meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = [];

      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        const matName = (mat.name || '').trim();
        const lowerName = matName.toLowerCase();

        // Standardize onto MeshStandardMaterial for high quality lighting & anime shaders
        const newMat = new THREE.MeshStandardMaterial({
          name: matName,
          roughness: 0.65,
          metalness: 0.05
        });

        // Alpha / Transparency detection (e.g. bangs, fringe, sheer cloth)
        if (lowerName.includes('alpha') || lowerName.includes('trans') || lowerName.includes('glass')) {
          newMat.transparent = true;
          newMat.alphaTest = 0.45;
          newMat.depthWrite = true;
        }

        // Texture name candidate discovery
        let matchedTexture = null;

        // A. Check local dropped texture files
        if (localTextureFiles.size > 0) {
          for (const [key, blobUrl] of localTextureFiles.entries()) {
            if (lowerName.includes(key) || key.includes(lowerName.replace(/^mi_/i, ''))) {
              matchedTexture = await loadTexture(blobUrl);
              if (matchedTexture) break;
            }
          }
        }

        // B. Check URL path relative to model directory (e.g. /models/Cantarella/Textures/)
        if (!matchedTexture && baseDir) {
          // Try standard naming variations:
          // "MI_R2T1KanteleilaMd10011Bangs" -> "T_R2T1KanteleilaMd10011Bangs_D.png"
          const cleanPart = matName.replace(/^MI_/i, '');
          const candidates = [
            `Textures/T_${cleanPart}_D.png`,
            `Textures/T_${cleanPart}.png`,
            `Textures/${cleanPart}_D.png`,
            `Textures/${cleanPart}.png`,
            `T_${cleanPart}_D.png`,
            `${cleanPart}_D.png`,
            `${cleanPart}.png`
          ];

          for (const relPath of candidates) {
            const fullUrl = baseDir + relPath;
            matchedTexture = await loadTexture(fullUrl);
            if (matchedTexture) break;
          }
        }

        if (matchedTexture) {
          newMat.map = matchedTexture;
          newMat.needsUpdate = true;
        } else if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          newMat.map = mat.map;
        }

        newMats.push(newMat);
      }

      mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
    }
  }

  /**
   * Wraps SkinnedMesh morph targets into a VRM-compatible expression manager
   */
  createExpressionManager(asset) {
    const morphMeshes = [];
    const morphNames = new Set();

    asset.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
        morphMeshes.push(obj);
        for (const name of Object.keys(obj.morphTargetDictionary)) {
          morphNames.add(name);
        }
      }
    });

    const values = new Map();
    const expressionsList = [];

    // Register all discovered morph targets
    for (const name of morphNames) {
      expressionsList.push({
        expressionName: name,
        name,
        binds: [{ weight: 1.0 }]
      });
    }

    // Register preset mappings
    for (const preset of Object.keys(MORPH_TARGET_PRESETS)) {
      expressionsList.push({
        expressionName: preset,
        name: preset,
        binds: [{ weight: 1.0 }]
      });
    }

    const resolveTargetNames = (name) => {
      if (MORPH_TARGET_PRESETS[name]) {
        return MORPH_TARGET_PRESETS[name];
      }
      return [name];
    };

    return {
      expressions: expressionsList,

      getExpression(name) {
        const targets = resolveTargetNames(name);
        for (const t of targets) {
          if (morphNames.has(t)) {
            return { expressionName: name, name: t, binds: [{ weight: 1.0 }] };
          }
        }
        return morphNames.has(name) ? { expressionName: name, name, binds: [{ weight: 1.0 }] } : null;
      },

      setValue(name, value) {
        values.set(name, value);
        const targets = resolveTargetNames(name);

        for (const mesh of morphMeshes) {
          for (const target of targets) {
            const idx = mesh.morphTargetDictionary[target];
            if (idx !== undefined) {
              mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(value, 0, 1);
            }
          }
        }
      },

      getValue(name) {
        return values.get(name) || 0;
      },

      update() {
        // Direct assignment on morphTargetInfluences takes immediate effect in Three.js
      }
    };
  }
}
