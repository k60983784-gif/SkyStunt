// Three.js world: track meshes, scenery, cars, hazards, camera, particles and lights.
import * as THREE from 'three';
import { getTrack } from '../shared/tracks.js';
import { CARS } from '../shared/cars.js';
import { mulberry32 } from '../shared/math.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const TMP = new THREE.Vector3();

/** Converts a Rapier-like {x,y,z,w} quaternion into a THREE.Quaternion. */
const qFrom = (q, out = new THREE.Quaternion()) => out.set(q.x, q.y, q.z, q.w);

// ---------- track + scenery ----------
export function buildTrackMeshes(trackId, theme, quality) {
  const t = getTrack(trackId);
  const group = new THREE.Group();

  // Road: one geometry, four material groups (top, underside, left wall, right wall).
  const geo = new THREE.BufferGeometry();
  const pos = t.verts;
  const idx = t.trimeshIdx;
  const perType = [[], [], [], []];
  for (let i = 0; i < idx.length; i += 6) {
    const type = (i / 6) % 4; // quads are emitted in the order top, bottom, left, right
    for (let j = 0; j < 6; j++) perType[type].push(idx[i + j]);
  }
  const ordered = [];
  const groups = [];
  for (let ty = 0; ty < 4; ty++) {
    groups.push({ start: ordered.length, count: perType[ty].length, materialIndex: ty });
    ordered.push(...perType[ty]);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(ordered);
  geo.computeVertexNormals();
  groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
  const mats = [
    new THREE.MeshStandardMaterial({ color: theme.road, roughness: trackId === 'glacier_overpass' ? 0.15 : 0.7, metalness: 0.1, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 1, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: theme.edge, emissive: theme.edge, emissiveIntensity: 0.9, roughness: 0.4, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: theme.edge, emissive: theme.edge, emissiveIntensity: 0.9, roughness: 0.4, side: THREE.DoubleSide }),
  ];
  const road = new THREE.Mesh(geo, mats);
  group.add(road);

  // Centre dashes (decorative): small emissive quads every 6 samples on non-gap road
  const dashGeo = new THREE.PlaneGeometry(0.35, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, Math.ceil(t.N / 6));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
  let di = 0;
  for (let k = 0; k < t.N; k += 6) {
    if (t.gap[k]) continue;
    const up = new THREE.Vector3(t.ux[k], t.uy[k], t.uz[k]);
    const fwd = new THREE.Vector3(t.tx[k], t.ty[k], t.tz[k]);
    const rgt = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const basis = new THREE.Matrix4().makeBasis(rgt, up, fwd);
    Q.setFromRotationMatrix(basis);
    M.compose(new THREE.Vector3(t.x[k] + t.ux[k] * 0.03, t.y[k] + t.uy[k] * 0.03, t.z[k] + t.uz[k] * 0.03), Q, S);
    dashes.setMatrixAt(di++, M);
  }
  dashes.count = di;
  dashes.instanceMatrix.needsUpdate = true;
  dashes.rotateX(-Math.PI / 2 + 0.0);
  group.add(dashes);

  // Pillars
  const pilGeo = new THREE.BoxGeometry(1.4, 1, 1.4);
  const pilMat = new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 0.9 });
  const pil = new THREE.InstancedMesh(pilGeo, pilMat, t.pillars.length);
  t.pillars.forEach((p, i) => {
    const h = p.top - p.bottom;
    M.compose(new THREE.Vector3(p.x, p.bottom + h / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
    pil.setMatrixAt(i, M);
  });
  group.add(pil);

  // Ground + theme-specific surfaces
  const groundSize = 4000;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = t.groundY - 0.05;
  group.add(ground);
  if (trackId === 'volcanic_ruins') {
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), new THREE.MeshStandardMaterial({ color: 0xff4a12, emissive: 0xff3300, emissiveIntensity: 1.1 }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = t.killY + 2.5;
    group.add(lava);
  }
  if (trackId === 'glacier_overpass') {
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), new THREE.MeshStandardMaterial({ color: 0x9fd8f0, roughness: 0.2, metalness: 0.1 }));
    ice.rotation.x = -Math.PI / 2;
    ice.position.y = t.groundY - 0.1;
    group.add(ice);
  }
  if (trackId === 'neon_skyline') {
    const grid = new THREE.GridHelper(1200, 120, theme.edge, 0x2a1a55);
    grid.position.y = t.groundY + 0.01;
    group.add(grid);
  }

  group.add(buildScenery(t, theme, trackId, quality));
  return { group, track: t };
}

function buildScenery(t, theme, trackId, quality) {
  const g = new THREE.Group();
  const rnd = mulberry32(trackId.length * 7919 + 17);
  const pts = [];
  for (let k = 0; k < t.N; k += 10) {
    const off = (rnd() < 0.5 ? -1 : 1) * (16 + rnd() * 55);
    const x = t.x[k] + t.rx[k] * off, z = t.z[k] + t.rz[k] * off;
    // Keep scenery away from every road section (avoids placing props on other roads)
    let ok = true;
    for (let j = 0; j < t.N && ok; j += 8) {
      const dx = t.x[j] - x, dz = t.z[j] - z;
      if (dx * dx + dz * dz < 14 * 14) ok = false;
    }
    if (ok) pts.push({ x, z, k });
  }
  const n = Math.min(pts.length, quality === 'low' ? 220 : 420);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const colorArr = [];
  let geo, mat;
  if (trackId === 'neon_skyline') {
    geo = new THREE.BoxGeometry(1, 1, 1);
    mat = new THREE.MeshStandardMaterial({ color: 0x1a1d3a, roughness: 0.5, metalness: 0.3, emissive: 0x0b0d2a, emissiveIntensity: 0.6 });
  } else if (trackId === 'canyon_skyway') {
    geo = new THREE.DodecahedronGeometry(1, 0);
    mat = new THREE.MeshStandardMaterial({ color: 0xb06a3c, roughness: 1, flatShading: true });
  } else if (trackId === 'volcanic_ruins') {
    geo = new THREE.ConeGeometry(1, 1, 5);
    mat = new THREE.MeshStandardMaterial({ color: 0x2b1a16, roughness: 1, emissive: 0x551200, emissiveIntensity: 0.4, flatShading: true });
  } else {
    geo = new THREE.ConeGeometry(1, 1, 6);
    mat = new THREE.MeshStandardMaterial({ color: 0xe6f7ff, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.92, flatShading: true });
  }
  const inst = new THREE.InstancedMesh(geo, mat, n);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const r = rnd();
    let sy, sx, sz;
    if (trackId === 'neon_skyline') { sx = 6 + r * 10; sz = 6 + r * 10; sy = 20 + rnd() * 90; }
    else if (trackId === 'canyon_skyway') { sx = 14 + r * 26; sz = 14 + r * 26; sy = 30 + rnd() * 90; }
    else if (trackId === 'volcanic_ruins') { sx = 4 + r * 8; sz = sx; sy = 6 + rnd() * 26; }
    else { sx = 6 + r * 12; sz = sx; sy = 10 + rnd() * 40; }
    const base = trackId === 'neon_skyline' ? t.groundY : (trackId === 'canyon_skyway' ? t.groundY - 6 : t.groundY);
    P.set(p.x, base + sy / 2, p.z);
    S.set(sx, sy, sz);
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    M.compose(P, Q, S);
    inst.setMatrixAt(i, M);
    if (trackId === 'neon_skyline') {
      const c = [theme.edge, theme.accent, 0xff7a1a, 0x7a5cff, 0x1ee6a0][Math.floor(rnd() * 5)];
      colorArr.push(new THREE.Color(0x1a1d3a).lerp(new THREE.Color(c), 0.12 + rnd() * 0.22));
    } else colorArr.push(new THREE.Color(0xffffff).multiplyScalar(0.85 + rnd() * 0.15));
    if (trackId === 'neon_skyline' && r < 0.25) {
      // neon sign stripe (emissive) near the top
      colorArr[colorArr.length - 1] = new THREE.Color(0x1a1d3a);
    }
  }
  inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colorArr.flatMap((c) => [c.r, c.g, c.b])), 3);
  g.add(inst);
  return g;
}

// ---------- car models ----------
// ---------- car body models (Kenney Car Kit, CC0; see public/models/kenney-car-kit/License.txt) ----------
const CAR_MODEL_FILES = { bolt: 'race.glb', dart: 'race-future.glb', titan: 'sedan-sports.glb', viper: 'hatchback-sports.glb' };
const CAR_MODEL_LENGTH = 4.0;      // metres, matches the physics box (2 x 2.0 half-length)
const CAR_MODEL_YAW = 0;           // radians; set to Math.PI if a model faces backwards in the game
const carBodyCache = new Map();

export function loadCarBody(carId) {
  const file = CAR_MODEL_FILES[carId] || CAR_MODEL_FILES.bolt;
  if (!carBodyCache.has(file)) {
    carBodyCache.set(file, new Promise((resolve, reject) => {
      new GLTFLoader().load(`/models/kenney-car-kit/${file}`, (gltf) => {
        const body = gltf.scene.getObjectByName('body');
        if (!body) reject(new Error(`no body node in ${file}`));
        else resolve(body);
      }, undefined, reject);
    }));
  }
  return carBodyCache.get(file);
}

// Dual-layer paint (see docs/RENDER_PIPELINE.md): conductor base with metallic flake normal detail,
// plus a clear-coat layer at weight 1.0 and low roughness.
let flakeTexture = null;
function getFlakeTexture() {
  if (flakeTexture) return flakeTexture;
  const size = 256;
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = Math.random() > 0.93 ? 1 : 0;
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
    const nx = -dx * 0.8, ny = -dy * 0.8, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz);
    const o = (y * size + x) * 4;
    data[o] = (nx * inv * 0.5 + 0.5) * 255; data[o + 1] = (ny * inv * 0.5 + 0.5) * 255; data[o + 2] = (nz * inv * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  flakeTexture = new THREE.DataTexture(data, size, size);
  flakeTexture.wrapS = flakeTexture.wrapT = THREE.RepeatWrapping;
  flakeTexture.repeat.set(4, 4);
  flakeTexture.generateMipmaps = true;
  flakeTexture.minFilter = THREE.LinearMipmapLinearFilter;
  flakeTexture.magFilter = THREE.LinearFilter;
  flakeTexture.anisotropy = 4;
  flakeTexture.needsUpdate = true;
  return flakeTexture;
}

function paintMaterialFrom(src, tint) {
  return new THREE.MeshPhysicalMaterial({
    map: src.map || null,
    color: tint ?? 0xffffff,
    metalness: 0.85,
    roughness: 0.42,
    normalMap: getFlakeTexture(),
    normalScale: new THREE.Vector2(0.18, 0.18),
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
}

// Replaces the procedural body with the Kenney model once it loads. The wheel rig is kept (physics pose drives it).
export function attachCarBody(carObj, carId, tint) {
  loadCarBody(carId).then((body) => {
    const model = new THREE.Group();
    const clone = body.clone(true);
    model.add(clone);
    model.rotation.y = CAR_MODEL_YAW;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); box.getSize(size);
    const s = CAR_MODEL_LENGTH / Math.max(size.z, 0.001);
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    const centre = new THREE.Vector3(); box2.getCenter(centre);
    model.position.set(-centre.x, -box2.min.y - 0.2, -centre.z);
    model.traverse((o) => {
      if (o.isMesh) {
        const src = o.material;
        o.material = paintMaterialFrom(Array.isArray(src) ? src[0] : src, tint);
        o.castShadow = false;
      }
    });
    for (const p of carObj.car.userData.proceduralParts || []) p.visible = false;
    carObj.car.add(model);
    carObj.car.userData.model = model;
  }).catch((e) => console.warn('car model failed, keeping procedural body:', e.message));
}

export function buildCarMesh(carId, color) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, 4.0),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 })
  );
  body.position.set(0, 0.25, 0);
  car.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.36, 0.9), body.material);
  nose.position.set(0, 0.2, 2.2);
  nose.rotation.x = -0.15;
  car.add(nose);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.46, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x0a0f1e, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.9 })
  );
  cabin.position.set(0, 0.7, -0.2);
  car.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  spoiler.position.set(0, 0.85, -1.9);
  car.add(spoiler);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 3.6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }));
  strip.position.set(0, 0.02, 0);
  car.add(strip);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 1.2 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), lightMat); h.position.set(x, 0.3, 2.22); car.add(h);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), tailMat); tl.position.set(x, 0.3, -2.02); car.add(tl);
  }
  car.userData.proceduralParts = car.children.slice();
  // wheels: pivot groups for steering (front) and spin
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcfd6ff, metalness: 0.8, roughness: 0.3 });
  const positions = [[0.855, 1.3], [-0.855, 1.3], [0.855, -1.3], [-0.855, -1.3]];
  positions.forEach(([x, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.2, z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8).rotateZ(Math.PI / 2), hubMat);
    spin.add(tire, hub);
    pivot.add(spin);
    car.add(pivot);
    wheels.push({ pivot, spin, front: i < 2, x });
  });
  return { car, wheels, color };
}

// ---------- particles ----------
// Camera modes. back: metres behind the car (negative = in front); up: metres above the car centre;
// ahead: look-at point metres ahead of the car; lookUp: look-at height; hideOwn: hide the player's car (in-cabin views).
export const CAMERA_MODES = [
  { id: 'chase',  name: 'Chase',        back: 9,   up: 3.2, ahead: 0,  lookUp: 1.2, fov: 65, speedBack: true, hideOwn: false },
  { id: 'bumper', name: 'Back view',    back: 4.5, up: 0.9, ahead: 0,  lookUp: 0.8, fov: 70, hideOwn: false },
  { id: 'front',  name: 'Front view',   back: -11, up: 2.4, ahead: 0,  lookUp: 1.0, fov: 60, hideOwn: false },
  { id: 'hood',   name: 'Hood',         back: -0.6, up: 1.25, ahead: 14, lookUp: 0.6, fov: 72, snap: true, hideOwn: true },
  { id: 'driver', name: 'Driver',       back: 0.35, up: 0.95, ahead: 14, lookUp: 0.5, fov: 70, snap: true, hideOwn: true },
  { id: 'fpv',    name: 'First person', back: 0.0, up: 1.35, ahead: 18, lookUp: 1.1, fov: 84, snap: true, hideOwn: true },
  { id: 'drone',  name: 'High',         back: 18,  up: 9,   ahead: 0,  lookUp: 0,   fov: 60, hideOwn: false },
];

export class Particles {
  constructor(scene, max = 700) {
    this.max = max;
    this.p = Array.from({ length: max }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, r: 1, g: 1, b: 1, grow: 0, add: false }));
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.siz = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1));
    const mat = new THREE.PointsMaterial({ size: 1, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }
  emit(x, y, z, o = {}) {
    const q = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    Object.assign(q, { alive: true, x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 1, max: o.life || 1, size: o.size || 1, r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1, grow: o.grow || 0, add: !!o.add });
  }
  update(dt) {
    const p = this.p;
    for (let i = 0; i < this.max; i++) {
      const q = p[i];
      if (!q.alive) { this.siz[i] = 0; this.pos[i * 3 + 1] = -9999; continue; }
      q.life -= dt;
      if (q.life <= 0) { q.alive = false; this.siz[i] = 0; this.pos[i * 3 + 1] = -9999; continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vy -= (q.grow < 0 ? 0 : 0) * dt;
      q.size += q.grow * dt;
      const a = q.life / q.max;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.r * a; this.col[i * 3 + 1] = q.g * a; this.col[i * 3 + 2] = q.b * a;
      this.siz[i] = Math.max(0, q.size);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

// ---------- scene wrapper ----------
export class World {
  constructor(canvas, quality = 'high') {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.5, 2500);
    this.camMode = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.cars = new Map();
    this.hazards = [];
    this.trackGroup = null;
    this.particles = new Particles(this.scene, quality === 'low' ? 300 : 700);
    this.shake = 0;
  }

  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  loadTrack(trackId) {
    if (this.trackGroup) { this.scene.remove(this.trackGroup); }
    this.trackGroup = null;
    const { track } = { track: getTrack(trackId) };
    const def = track.def;
    const th = def.theme;
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.fog, 120, this.quality === 'low' ? 700 : 1100);
    this.scene.children.filter((c) => c.isLight).forEach((l) => this.scene.remove(l));
    this.scene.add(new THREE.HemisphereLight(th.ambient, th.ground, 0.9));
    const sun = new THREE.DirectionalLight(th.sun, 1.2);
    sun.position.set(200, 400, 120);
    this.scene.add(sun);
    const built = buildTrackMeshes(trackId, th, this.quality);
    this.trackGroup = built.group;
    this.scene.add(built.group);
    this.track = built.track;
    // hazards (rebuilt per race)
    this.hazards.forEach((h) => this.scene.remove(h));
    this.hazards = [];
    for (const h of def.hazards) {
      const isSpin = h.type === 'spin';
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(h.size[0], h.size[1], h.size[2]),
        new THREE.MeshStandardMaterial({ color: isSpin ? 0xff3b1f : 0xffd23b, emissive: isSpin ? 0xff3b1f : 0xffa000, emissiveIntensity: 0.9, roughness: 0.4 })
      );
      this.scene.add(m);
      this.hazards.push(m);
    }
    for (const w of def.wind) {
      this.windZones = this.windZones || [];
    }
    this.theme = th;
  }

  ensureCar(id, carId, color) {
    if (!this.cars.has(id)) {
      const mesh = buildCarMesh(carId, color ?? CARS[carId]?.color ?? 0xffffff);
      attachCarBody(mesh, carId, color ?? CARS[carId]?.color ?? 0xffffff);
      this.scene.add(mesh.car);
      const label = makeLabel();
      mesh.car.add(label.sprite);
      this.cars.set(id, { ...mesh, label, prevPos: null, lastContacts: 0, prevSusp: null });
    }
    return this.cars.get(id);
  }

  removeAllCars() {
    for (const c of this.cars.values()) this.scene.remove(c.car);
    this.cars.clear();
  }

  /** Apply a pose to a car mesh. pose: {x,y,z,q(THREE.Quaternion),wheelRot[4],susp[4],steer,boost,speed} */
  applyPose(id, carId, pose, color, highlight) {
    const c = this.ensureCar(id, carId, color);
    c.car.position.set(pose.x, pose.y, pose.z);
    c.car.quaternion.copy(pose.q);
    for (let i = 0; i < 4; i++) {
      const w = c.wheels[i];
      w.spin.rotation.x = pose.wheelRot[i];
      const s = pose.susp[i] ?? 0.45;
      w.pivot.position.y = -0.2 - s + 0.0;
      w.pivot.rotation.set(0, 0, 0);
      if (w.front) w.pivot.rotation.y = pose.steer * 0.75;
    }
    return c;
  }

  update(dt) {
    this.particles.update(dt);
    for (const h of this.hazards) void h;
  }

  render(dt) {
    this.renderer.render(this.scene, this.camera);
  }

  /** Follow camera for a focus pose, using CAMERA_MODES[camMode]. */
  followCamera(focus, dt, speed) {
    if (!focus) return;
    const m = CAMERA_MODES[this.camMode] || CAMERA_MODES[0];
    const up = new THREE.Vector3(0, 1, 0);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(focus.q);
    const base = new THREE.Vector3(focus.x, focus.y, focus.z);
    const back = m.back + (m.speedBack ? Math.min(4, speed / 25) : 0);
    const target = base.clone().addScaledVector(fwd, -back).addScaledVector(up, m.up);
    const lookAt = base.clone().addScaledVector(fwd, m.ahead).addScaledVector(up, m.lookUp);
    if (this.camModeChanged || !this.camInit) { this.camPos.copy(target); this.camLook.copy(lookAt); this.camModeChanged = false; this.camInit = true; }
    const k = m.snap ? 1 : 1 - Math.pow(0.0008, dt);
    this.camPos.lerp(target, k);
    this.camLook.lerp(lookAt, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) { this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 3); }
    this.camera.lookAt(this.camLook);
    this.camera.fov = m.fov + Math.min(18, Math.max(0, (speed - 20) * 0.35));
    this.camera.updateProjectionMatrix();
    this.hideOwn = !!m.hideOwn;
    // nameplates: hide when the camera is too close, so they never fill the screen
    for (const c of this.cars.values()) {
      if (c.label.isMe) { c.label.sprite.visible = false; continue; }
      c.label.sprite.visible = this.camera.position.distanceTo(c.car.position) > 18;
    }
  }
}

function makeLabel() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(2.6, 0.65, 1);
  sprite.position.set(0, 2.6, 0);
  sprite.renderOrder = 10;
  return { sprite, cv, ctx, tex, last: '' };
}

export function setLabel(label, text, color = '#ffffff') {
  if (label.last === text) return;
  label.last = text;
  const { ctx, cv } = label;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = 'rgba(5,8,22,0.7)';
  roundRect(ctx, 4, 8, cv.width - 8, 48, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 1);
  label.tex.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { qFrom, TMP };
