import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PROP } from './HumanRig.js';

/**
 * EP-02 "Golden Field" — THE RONIN
 * ============================================================================
 * Loads public/assets/ronin_v5.glb (1.78 m, Meshy 24-joint Mixamo-convention
 * skeleton, dark lamellar armour, topknot, twin swords) and drives it with the SAME
 * procedural pose system the cowboy used. The GLB's six Meshy clips
 * (idle/walk/run/crouch/mount/ride, director-approved 2026-08-27) are kept on
 * `actions` and DO drive the bones whenever no rifle is in hand — see the
 * clip branches in Player.js. The procedural layer remains the primary driver
 * for weapon work: the
 * mount choreography is saddle-aware and the walk gait is slope-aware in
 * ways a fixed clip cannot be, and the weapon system poses arms onto the
 * rifle through IK. The clips are reserved for possible flavour layers.
 *
 * The facade presents the exact interface of rig/Rig.js with one semantic
 * difference, handled here: Rig bones have identity rest rotations and
 * world-aligned axes with children along -Y, while the GLB skeleton has
 * arbitrary rest orientations with children along +Y. Every facade method
 * therefore works in WORLD space:
 *
 *   rot(name,x,y,z)   world-axis euler applied on top of the current pose
 *   setRot(name,x,y,z) absolute world-axis orientation
 *   trs(name,dx,dy,dz) translate in WORLD space (converted to local)
 *   aimWorld(bone,dir,pole) point the bone's +Y (child axis) along dir
 *   ik2(root,mid,l1,l2,target,pole) analytic two-bone IK, +Y convention
 *   reset()/sync()    restore bind pose / refresh world matrices
 *
 * Bones the pose system expects but the GLB does not have (hat, coat
 * skirt, satchel) are plain Object3D dummies hung off the right parents so
 * the secondary-motion code keeps running harmlessly.
 * ============================================================================
 */

const NAME_MAP = {
  hips: 'Hips',
  /* the GLB spine chain runs Hips -> Spine02 -> Spine01 -> Spine (top) */
  spine: 'Spine02', chest: 'Spine',
  neck: 'neck', head: 'Head',
  clavL: 'LeftShoulder', armL: 'LeftArm', foreL: 'LeftForeArm', handL: 'LeftHand',
  clavR: 'RightShoulder', armR: 'RightArm', foreR: 'RightForeArm', handR: 'RightHand',
  thighL: 'LeftUpLeg', shinL: 'LeftLeg', footL: 'LeftFoot', toeL: 'LeftToeBase',
  thighR: 'RightUpLeg', shinR: 'RightLeg', footR: 'RightFoot', toeR: 'RightToeBase',
};

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

class RoninFacade {
  constructor(scene) {
    this.scene = scene;
    this.root = scene;                       // sync() walks from here
    this.map = new Map();

    const byGlb = new Map();
    scene.traverse((o) => { if (o.isBone) byGlb.set(o.name, o); });
    for (const [rs, glb] of Object.entries(NAME_MAP)) {
      const b = byGlb.get(glb);
      if (b) this.map.set(rs, b);
    }
    /* Dummy bones for the cowboy-only attachments (coat skirt, satchel,
       hat). Parented to match where HumanRig hung them, in world offsets. */
    const hips = this.map.get('hips'), head = this.map.get('head');
    const dummies = {
      hat: [head, [0, 0.21, 0.03]],
      coatR: [hips, [-0.11, -0.02, 0.05]],
      coatB: [hips, [0, -0.02, -0.12]],
      coatL: [hips, [0.11, -0.02, 0.05]],
      satchel: [hips, [0.19, -0.05, -0.05]],
    };
    scene.updateMatrixWorld(true);
    for (const [name, [parent, off]] of Object.entries(dummies)) {
      if (!parent) continue;
      const d = new THREE.Object3D();
      d.name = 'ronin_' + name;
      const wp = parent.getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(off[0], off[1], off[2]));
      parent.add(d);
      d.position.copy(parent.worldToLocal(wp));
      this.map.set(name, d);
    }

    /* Bind-pose snapshot: reset() returns here every frame. */
    this.rest = new Map();
    for (const b of this.map.values()) {
      this.rest.set(b, {
        p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone(),
      });
    }

    /* Measured limb lengths for the IK constants the pose layer reads from
       PROP (overridden by loadRonin below). */
    this.limb = {};
    const dist = (a, b) => {
      const A = this.map.get(a), B = this.map.get(b);
      if (!A || !B) return 0;
      return A.getWorldPosition(new THREE.Vector3())
        .distanceTo(B.getWorldPosition(new THREE.Vector3()));
    };
    this.limb.legL1 = dist('thighL', 'shinL');
    this.limb.legL2 = dist('shinL', 'footL');
    this.limb.armL1 = dist('armL', 'foreL');
    this.limb.armL2 = dist('foreL', 'handL');
    this.limb.hipY = this.map.get('hips').getWorldPosition(new THREE.Vector3()).y;
    this.limb.headY = this.map.get('head').getWorldPosition(new THREE.Vector3()).y;
    this.limb.shoulderY = this.map.get('armL').getWorldPosition(new THREE.Vector3()).y;
    this.limb.ankleY = this.map.get('footL').getWorldPosition(new THREE.Vector3()).y;
  }

  get(name) {
    const b = this.map.get(name);
    if (!b) throw new Error('RoninRig: unknown bone ' + name);
    return b;
  }

  reset() {
    for (const [b, r] of this.rest) {
      b.position.copy(r.p);
      b.quaternion.copy(r.q);
      b.scale.copy(r.s);
    }
    /* The GLB binds with the arms in an A-pose, ~35 deg out from the body;
       the cowboy's rest (which every procedural pose is written against)
       hangs the arms straight down. Fold the corrective into the base so
       the pose layer sees the same starting point. */
    this.rot('armL', 0, 0, -0.35);
    this.rot('armR', 0, 0, 0.35);
  }

  sync() { this.root.updateMatrixWorld(true); }

  worldPos(name, target = new THREE.Vector3()) {
    return target.setFromMatrixPosition(this.get(name).matrixWorld);
  }

  /** World-axis additive euler on top of the current pose. */
  rot(name, x, y, z) {
    const b = this.get(name);
    _e.set(x || 0, y || 0, z || 0, 'XYZ');
    _q.setFromEuler(_e);
    if (b.parent) {
      b.parent.updateWorldMatrix(true, false);
      b.parent.getWorldQuaternion(_q2).invert();
      // worldQ' = q * worldQ  =>  localQ' = pq^-1 * q * pq * localQ
      b.parent.getWorldQuaternion(_q3);
      _q2.multiply(_q).multiply(_q3);
      b.quaternion.premultiply(_q2);
    } else {
      b.quaternion.premultiply(_q);
    }
    return b;
  }

  /** Absolute world-axis orientation (replaces current orientation). */
  setRot(name, x, y, z) {
    const b = this.get(name);
    _e.set(x || 0, y || 0, z || 0, 'XYZ');
    _q.setFromEuler(_e);
    if (b.parent) {
      b.parent.updateWorldMatrix(true, false);
      b.parent.getWorldQuaternion(_q2).invert();
      b.quaternion.copy(_q2.multiply(_q));
    } else {
      b.quaternion.copy(_q);
    }
    return b;
  }

  /** Translate in WORLD space. */
  trs(name, dx, dy, dz) {
    const b = this.get(name);
    b.parent.updateWorldMatrix(true, false);
    _v.setFromMatrixPosition(b.matrixWorld);
    _v.x += dx || 0; _v.y += dy || 0; _v.z += dz || 0;
    b.position.copy(b.parent.worldToLocal(_v));
    return b;
  }

  /** Point the bone's local +Y (the GLB's child axis) along a world dir. */
  aimWorld(bone, dir, pole) {
    _y.copy(dir).normalize();                          // local +Y
    _z.copy(pole).addScaledVector(_y, -pole.dot(_y));
    if (_z.lengthSq() < 1e-8) {
      _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
      if (_z.lengthSq() < 1e-8) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
    }
    _z.normalize();
    _x.crossVectors(_y, _z).normalize();
    _z.crossVectors(_x, _y).normalize();
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    if (bone.parent) {
      bone.parent.updateWorldMatrix(true, false);
      bone.parent.getWorldQuaternion(_q2).invert();
      _q.premultiply(_q2);
    }
    bone.quaternion.copy(_q);
  }

  /** Analytic two-bone IK, +Y child convention. Mirrors Rig.ik2. */
  ik2(rootName, midName, l1, l2, target, pole) {
    const rootB = this.get(rootName);
    const midB = this.get(midName);
    rootB.updateWorldMatrix(true, false);
    _v.setFromMatrixPosition(rootB.matrixWorld);
    _v2.copy(target).sub(_v);
    let d = _v2.length();
    const dmin = Math.abs(l1 - l2) + 1e-3;
    const dmax = l1 + l2 - 1e-3;
    if (d < dmin) d = dmin;
    if (d > dmax) d = dmax;
    if (_v2.lengthSq() < 1e-9) _v2.set(0, -1, 0);
    _v2.normalize();

    const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const a = Math.acos(cosA);

    _x.copy(pole).addScaledVector(_v2, -pole.dot(_v2));
    if (_x.lengthSq() < 1e-8) _x.set(0, 0, 1).addScaledVector(_v2, -_v2.z);
    _x.normalize();
    const dir1 = _z.copy(_v2).multiplyScalar(Math.cos(a)).addScaledVector(_x, Math.sin(a)).normalize().clone();

    this.aimWorld(rootB, dir1, pole);
    rootB.updateWorldMatrix(false, false);
    midB.updateWorldMatrix(true, false);
    const kneeW = new THREE.Vector3().setFromMatrixPosition(midB.matrixWorld);
    const dir2 = new THREE.Vector3().copy(target).sub(kneeW);
    if (dir2.lengthSq() < 1e-9) dir2.set(0, -1, 0);
    dir2.normalize();
    this.aimWorld(midB, dir2, pole);
    midB.updateWorldMatrix(false, false);
    return kneeW;
  }
}

/**
 * Load the ronin and hand back { scene, facade, mixer, actions }.
 * Also patches the shared PROP constants with the ronin's measured
 * proportions so the pose layer's IK reach stays honest.
 */
export async function loadRonin(ctx) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('assets/ronin_v5.glb');
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  /* Material integration: shadows, and the same aerial perspective every
     in-world material carries. */
  const sky = ctx.get('sky');
  scene.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      /* The export ships emissiveFactor [1,1,1] with the albedo ALSO bound as
         the emissive map: the whole figure self-glows and the dark lamellar
         washes out to lavender under a bright sky. Kill the emission; temper
         the doubled specular while we are here. */
      if (m.emissive) m.emissive.setRGB(0, 0, 0);
      m.emissiveIntensity = 0;
      if ('specularIntensity' in m) m.specularIntensity = 1.0;
      m.dithering = true;
      if (sky && sky.injectAerialPerspective) sky.injectAerialPerspective(m);
    }
  });

  const facade = new RoninFacade(scene);

  /* Facing verified live: the GLB rest faces the group's +Z, the same
     convention as the cowboy (probed via the headfront helper joint vs group
     forward). No flip. The holder just namespaces the subtree. */
  const holder = new THREE.Group();
  holder.name = 'roninHolder';
  holder.add(scene);

  /* Patch the pose layer's anthropometrics to the ronin's real proportions. */
  if (facade.limb.legL1 > 0.1) PROP.legL1 = facade.limb.legL1;
  if (facade.limb.legL2 > 0.1) PROP.legL2 = facade.limb.legL2;
  if (facade.limb.armL1 > 0.05) PROP.armL1 = facade.limb.armL1;
  if (facade.limb.armL2 > 0.05) PROP.armL2 = facade.limb.armL2;
  if (facade.limb.hipY > 0.3) PROP.hipY = facade.limb.hipY;
  if (facade.limb.headY > 1.0) PROP.eyeY = facade.limb.headY + 0.06;
  if (facade.limb.shoulderY > 1.0) PROP.shoulderY = facade.limb.shoulderY;
  if (facade.limb.ankleY > 0.02) PROP.ankleY = facade.limb.ankleY;
  PROP.height = 1.78;

  /* The GLB's six Meshy clips: the bone driver whenever the rifle is slung. */
  const mixer = new THREE.AnimationMixer(scene);
  const actions = {};
  for (const clip of gltf.animations || []) {
    actions[clip.name] = mixer.clipAction(clip);
  }

  return { scene: holder, facade, mixer, actions, gltf };
}
