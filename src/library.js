// Model library viewer: lists public/models/library/manifest.json and shows one model at a time.
// Licence and source come from the manifest (each pack folder has a License.txt).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x231f20);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2000);
camera.position.set(4, 3, 6);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(5, 10, 7);
scene.add(sun);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const loader = new GLTFLoader();
let current = null;
let token = 0;
let manifest = [];

function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function render() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function show(m) {
  const my = ++token;
  $('#status').textContent = 'loading…';
  $('#info').innerHTML = `<b>${m.name}</b> · ${m.packTitle}<br>${m.triangles} triangles · ${(m.bytes / 1024).toFixed(0)} KB<br>Licence: ${m.licence} (<a href="${m.licenceFile}" target="_blank" rel="noopener">License.txt</a>)<br>Source: <a href="${m.source}" target="_blank" rel="noopener">${m.source}</a>`;
  loader.load(m.file, (gltf) => {
    if (my !== token) return;
    if (current) { scene.remove(current); }
    current = gltf.scene;
    const box = new THREE.Box3().setFromObject(current);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    current.position.sub(centre);
    const far = Math.max(size.x, size.y, size.z, 0.01);
    camera.position.set(far * 1.6, far * 0.9, far * 1.6);
    controls.target.set(0, 0, 0);
    controls.update();
    scene.add(current);
    $('#status').textContent = 'loaded';
    window.__libraryLoaded = (window.__libraryLoaded || 0) + 1;
  }, undefined, (err) => {
    if (my !== token) return;
    $('#status').textContent = 'failed to load';
    console.error('model failed', m.file, err && err.message);
  });
}

function renderList() {
  const q = $('#q').value.trim().toLowerCase();
  const pack = $('#pack').value;
  const rows = manifest.filter((m) => (!pack || m.pack === pack) && (!q || m.name.toLowerCase().includes(q)));
  $('#count').textContent = `${rows.length} of ${manifest.length} models`;
  const list = $('#list');
  list.innerHTML = '';
  for (const m of rows.slice(0, 600)) {
    const el = document.createElement('div');
    el.className = 'item';
    el.setAttribute('role', 'option');
    el.tabIndex = 0;
    el.innerHTML = `<span>${m.name}</span><small>${m.triangles} tri · ${m.packTitle}</small>`;
    el.addEventListener('click', () => { document.querySelectorAll('.item.on').forEach((n) => n.classList.remove('on')); el.classList.add('on'); show(m); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.click(); });
    list.appendChild(el);
  }
}

async function init() {
  const res = await fetch('/models/library/manifest.json');
  const data = await res.json();
  manifest = data.models;
  const packs = [...new Set(manifest.map((m) => m.pack))];
  for (const p of packs) {
    const o = document.createElement('option');
    o.value = p;
    o.textContent = manifest.find((m) => m.pack === p).packTitle;
    $('#pack').appendChild(o);
  }
  $('#q').addEventListener('input', renderList);
  $('#pack').addEventListener('change', renderList);
  renderList();
  window.__libraryCount = manifest.length;
}
init().catch((e) => { console.error('manifest failed', e.message); $('#count').textContent = 'manifest failed to load'; });
