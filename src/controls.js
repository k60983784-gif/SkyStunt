// Keyboard + touch controls. Produces a normalized input object each frame.
const KEY = {
  ArrowUp: 'th', KeyW: 'th', ArrowDown: 'br', KeyS: 'br', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'hb', ShiftLeft: 'bo', ShiftRight: 'bo', KeyE: 'bo',
};

export class Controls {
  constructor(root) {
    this.root = root;
    this.down = new Set();
    this.touch = { th: 0, br: 0, left: 0, right: 0, hb: 0, bo: 0 };
    this.steer = 0;
    this.onKey = null; // (code) => void for camera, pause, mute
    this.touchUI = null;
    this._kd = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (KEY[e.code]) { this.down.add(e.code); e.preventDefault(); }
      if (this.onKey && !e.repeat) this.onKey(e.code);
    };
    this._ku = (e) => { this.down.delete(e.code); };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', () => this.down.clear());
  }

  enableTouch() {
    if (this.touchUI) return;
    const wrap = document.createElement('div');
    wrap.className = 'touch';
    const mk = (cls, label, key) => {
      const b = document.createElement('button');
      b.className = 'tbtn ' + cls;
      b.textContent = label;
      const on = (v) => (e) => { e.preventDefault(); this.touch[key] = v; b.classList.toggle('on', !!v); };
      b.addEventListener('pointerdown', on(1));
      b.addEventListener('pointerup', on(0));
      b.addEventListener('pointerleave', on(0));
      b.addEventListener('pointercancel', on(0));
      return b;
    };
    const left = document.createElement('div'); left.className = 'tgroup left';
    left.append(mk('steer', '◀', 'left'), mk('steer', '▶', 'right'));
    const right = document.createElement('div'); right.className = 'tgroup right';
    right.append(mk('brake', 'BRAKE', 'br'), mk('drift', 'DRIFT', 'hb'), mk('boost', 'BOOST', 'bo'), mk('gas', 'GAS', 'th'));
    wrap.append(left, right);
    this.root.appendChild(wrap);
    this.touchUI = wrap;
  }

  disableTouch() { if (this.touchUI) { this.touchUI.remove(); this.touchUI = null; } }

  /** Returns {th,br,st,hb,bo} with smoothed steering. dt in seconds. */
  read(dt) {
    const d = this.down;
    const has = (k) => d.has(k);
    const isKey = (name) => [...d].some((c) => KEY[c] === name);
    let left = isKey('left') || this.touch.left, right = isKey('right') || this.touch.right;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    const rate = target === 0 ? 6 : 4;
    this.steer += (target - this.steer) * Math.min(1, rate * dt);
    if (Math.abs(this.steer) < 0.002 && target === 0) this.steer = 0;
    const th = (isKey('th') || this.touch.th) ? 1 : 0;
    const br = (isKey('br') || this.touch.br) ? 1 : 0;
    return {
      th, br, st: Math.max(-1, Math.min(1, this.steer)),
      hb: (has('Space') || this.touch.hb) ? 1 : 0,
      bo: (isKey('bo') || this.touch.bo) ? 1 : 0,
    };
  }

  destroy() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    this.disableTouch();
  }
}
