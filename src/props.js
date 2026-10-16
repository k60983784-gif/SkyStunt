// Kit props for the track scenery: Kenney Racing Kit barriers (neon city) and Nature Kit rocks/trees (canyon, volcanic, glacier).
// Licence: CC0 (see public/models/library/<pack>/License.txt). Visual only: no colliders, so physics and netcode are unchanged.
// Each model is fitted to a real-world size in metres, instanced (one InstancedMesh per sub-mesh), and placed off the road.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTrack } from '../shared/tracks.js';
import { mulberry32 } from '../shared/math.js';

const RACING = 'kenney-racing-kit';
const NATURE = 'kenney-nature-kit';

// Per-track plan. `kind: 'barrier'` puts walls along both road edges; `kind: 'scatter'` places props off-road.
// `baseOffset` lowers the scatter base below the track's groundY (canyon scenery uses groundY - 6 too).
const PLAN = {
  neon_skyline: {
    kind: 'barrier',
    types: [
      { pack: RACING, file: 'barrierRed', length: 6 },
      { pack: RACING, file: 'barrierWhite', length: 6 },
    ],
  },
  canyon_skyway: {
    kind: 'scatter', baseOffset: -6, offMin: 18, offMax: 70,
    types: [
      { pack: NATURE, file: 'rock_largeA', height: 9 },
      { pack: NATURE, file: 'rock_largeC', height: 11 },
      { pack: NATURE, file: 'rock_tallB', height: 14 },
      { pack: NATURE, file: 'plant_bushLarge', height: 3 },
    ],
  },
  volcanic_ruins: {
    kind: 'scatter', baseOffset: 0, offMin: 16, offMax: 60,
    types: [
      { pack: NATURE, file: 'rock_largeD', height: 8 },
      { pack: NATURE, file: 'rock_tallE', height: 11 },
      { pack: NATURE, file: 'rock_smallE', height: 3 },
    ],
  },
  glacier_overpass: {
    kind: 'scatter', baseOffset: 0, offMin: 18, offMax: 70,
    types: [
      { pack: NATURE, file: 'tree_pineRoundA', height: 16 },
      { pack: NATURE, file: 'tree_pineRoundC', height: 19 },
      { pack: NATURE, file: 'tree_pineSmallA', height: 12 },
      { pack: NATURE, file: 'tree_pineTallB', height: 22 },
    ],
  },
};

const loader = new GLTFLoader();
const sourceCache = new Map();

function loadSource(pack, file) {
  const url = `/models/library/${pack}/${file}.glb`;
  if (!sourceCache.has(url)) {
    sourceCache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return sourceCache.get(url);
}

// Fits a copy of the source model to a size in metres. Origin is at the base centre.
// For walls (`length`), the long horizontal axis is aligned to +X so placement can yaw it along the road.
function makeTemplate(src, fit) {
  const root = new THREE.Group();
  root.add(src.clone(true));
  root.updateMatrixWorld(true);
  let size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  if (fit.length && size.z > size.x) { root.rotation.y = Math.PI / 2; root.updateMatrixWorld(true); size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); }
  const s = fit.height ? fit.height / Math.max(size.y, 1e-6) : fit.length / Math.max(size.x, size.z, 1e-6);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
  root.updateMatrixWorld(true);
  // Matte, unlit-looking material: the Kit materials are fully metallic with no environment map, which renders near-black.
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src0 = Array.isArray(o.material) ? o.material[0] : o.material;
    o.material = new THREE.MeshStandardMaterial({ color: src0.color ? src0.color.clone() : 0xffffff, roughness: 0.85, metalness: 0 });
  });
  return root;
}

// One InstancedMesh per sub-mesh; each instance matrix = placement * sub-mesh transform inside the template.
function instanceTemplate(template, placements) {
  const out = new THREE.Group();
  const meshes = [];
  template.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const tmp = new THREE.Matrix4();
  for (const mesh of meshes) {
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    placements.forEach((P, i) => inst.setMatrixAt(i, tmp.multiplyMatrices(P, mesh.matrixWorld)));
    inst.instanceMatrix.needsUpdate = true;
    out.add(inst);
  }
  return out;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function barrierPlacements(t, rnd, count) {
  const out = [];
  const hwExtra = 0.8; // metres outside the road edge
  for (let k = 0; k < t.N && out.length < count; k += 3) {
    let gapNear = false;
    for (let d = -4; d <= 4 && !gapNear; d++) if (t.gap[(k + d + t.N) % t.N]) gapNear = true;
    if (gapNear) continue;
    const tx = t.tx[k], tz = t.tz[k];
    const yaw = Math.atan2(-tz, tx); // rotates +X onto the road tangent (horizontal projection)
    const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw);
    for (const side of [-1, 1]) {
      const off = side * (t.w[k] / 2 + hwExtra);
      const pos = new THREE.Vector3(t.x[k] + t.rx[k] * off, t.y[k] + 0.05, t.z[k] + t.rz[k] * off);
      out.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
    }
  }
  return out;
}

function scatterPlacements(t, plan, rnd, count, quality) {
  const base = t.groundY + (plan.baseOffset || 0);
  const out = [];
  const step = quality === 'low' ? 14 : 10;
  const candidates = [];
  for (let k = 0; k < t.N; k += step) {
    const off = (rnd() < 0.5 ? -1 : 1) * (plan.offMin + rnd() * (plan.offMax - plan.offMin));
    const x = t.x[k] + t.rx[k] * off, z = t.z[k] + t.rz[k] * off;
    let ok = true;
    for (let j = 0; j < t.N && ok; j += 8) {
      const dx = t.x[j] - x, dz = t.z[j] - z;
      if (dx * dx + dz * dz < 14 * 14) ok = false;
    }
    if (ok) candidates.push({ x, z });
  }
  // Even subsample when the track has more candidates than the cap.
  const stride = Math.max(1, Math.ceil(candidates.length / count));
  for (let i = 0; i < candidates.length && out.length < count; i += stride) {
    const c = candidates[i];
    const s = 0.85 + rnd() * 0.35;
    const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rnd() * Math.PI * 2);
    out.push({ c, matrix: new THREE.Matrix4().compose(new THREE.Vector3(c.x, base, c.z), q, new THREE.Vector3(s, s, s)) });
  }
  return out.map((o) => o.matrix);
}

/** Returns a group that fills in asynchronously as the kit models load. */
export function buildKitProps(trackId, quality) {
  const group = new THREE.Group();
  const plan = PLAN[trackId];
  if (!plan) return group;
  loadKitProps(trackId, plan, quality).then((g) => group.add(g)).catch((err) => console.warn('kit props failed', trackId, err));
  return group;
}

async function loadKitProps(trackId, plan, quality) {
  const t = getTrack(trackId);
  const rnd = mulberry32(trackId.length * 104729 + 3);
  const cap = quality === 'low' ? 60 : 120;
  const sources = await Promise.all(plan.types.map((ty) => loadSource(ty.pack, ty.file)));
  const templates = plan.types.map((ty, i) => makeTemplate(sources[i], ty));
  const perType = templates.map(() => []);
  if (plan.kind === 'barrier') {
    const all = barrierPlacements(t, rnd, cap * 2);
    all.forEach((m, i) => perType[i % templates.length].push(m));
  } else {
    const all = scatterPlacements(t, plan, rnd, cap, quality);
    all.forEach((m) => perType[Math.floor(rnd() * templates.length)].push(m));
  }
  const out = new THREE.Group();
  templates.forEach((tpl, i) => { if (perType[i].length) out.add(instanceTemplate(tpl, perType[i])); });
  return out;
}

export const KIT_PLANNED_TRACKS = Object.keys(PLAN);
