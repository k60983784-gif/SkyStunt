// Keyboard + touch controls. Produces a normalized input object each frame.
// Touch layout (see style.css, .touch*): steering wheel bottom-left with camera buttons under it;
// BRAKE and GAS as large buttons bottom-right; DRIFT and BOOST as mid-size buttons above them.
// Buttons are symbols only; each has an aria-label for screen readers.
// Multi-function rule: pressing BOOST also applies gas, so boost works without holding the gas button.
const KEY = {
  ArrowUp: 'th', KeyW: 'th', ArrowDown: 'br', KeyS: 'br', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'hb', ShiftLeft: 'bo', ShiftRight: 'bo', KeyE: 'bo',
};

const WHEEL_LOCK_RAD = 1.9;   // wheel rotation (about 110 degrees) that gives full steering

const ICON = {
  gas: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 L40 24 H31 V42 H17 V24 H8 Z" fill="currentColor"/></svg>',
  brake: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="10" width="28" height="28" rx="6" fill="currentColor"/></svg>',
  drift: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 36 C10 18 20 12 30 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M26 6 L38 14 L28 22 Z" fill="currentColor"/></svg>',
  boost: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 4 L10 28 H22 L18 44 L38 18 H25 Z" fill="currentColor"/></svg>',
  wheel: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="24" cy="24" r="6" fill="currentColor"/><path d="M5 24 H16 M32 24 H43 M24 29 V43" stroke="currentColor" stroke-width="5"/></svg>',
  camera: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 15 H15 L19 9 H29 L33 15 H42 V38 H6 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="24" cy="26" r="7" fill="none" stroke="currentColor" stroke-width="4"/></svg>',
  prev: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 10 L16 24 L30 38" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 10 L32 24 L18 38" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class Controls {
  constructor(root) {
    this.root = root;
    this.down = new Set();
    this.touch = { th: 0, br: 0, hb: 0, bo: 0, wheel: 0 };
    this.steer = 0;
    this.onKey = null;        // (code) => void for camera, pause, mute
    this.onCamera = null;     // (step) => void, from the touch camera buttons
    this.touchUI = null;
    this._kd = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (KEY[e.code]) { this.down.add(e.code); e.preventDefault(); }
      if (this.onKey && !e.repeat) this.onKey(e.code);
    };
    this._ku = (e) => { this.down.delete(e.code); };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', () => { this.down.clear(); this.resetTouch(); });
  }

  resetTouch() {
    this.touch = { th: 0, br: 0, hb: 0, bo: 0, wheel: 0 };
    if (this.touchUI) this.touchUI.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
  }

  enableTouch() {
    if (this.touchUI) return;
    const wrap = document.createElement('div');
    wrap.className = 'touch';
    wrap.setAttribute('aria-hidden', 'false');
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());

    // Steering wheel: drag to turn. Returns to centre on release. Each pointer is tracked separately.
    const left = document.createElement('div');
    left.className = 'tleft';
    const wheel = document.createElement('div');
    wheel.className = 'wheel';
    wheel.setAttribute('role', 'slider');
    wheel.setAttribute('aria-label', 'Steering wheel');
    wheel.innerHTML = ICON.wheel;
    let active = null, startAng = 0, startVal = 0;
    const angleOf = (e) => {
      const r = wheel.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    const setWheel = (v) => {
      this.touch.wheel = v;
      wheel.style.transform = `rotate(${(v * WHEEL_LOCK_RAD * 180) / Math.PI}deg)`;
    };
    wheel.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      wheel.setPointerCapture(e.pointerId);
      active = e.pointerId; startAng = angleOf(e); startVal = this.touch.wheel;
      wheel.classList.add('turning');
    });
    wheel.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      let d = angleOf(e) - startAng;
      if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
      setWheel(Math.max(-1, Math.min(1, startVal + d / WHEEL_LOCK_RAD)));
    });
    const endWheel = (e) => {
      if (e.pointerId !== active) return;
      active = null; wheel.classList.remove('turning'); setWheel(0);
    };
    wheel.addEventListener('pointerup', endWheel);
    wheel.addEventListener('pointercancel', endWheel);
    wheel.addEventListener('lostpointercapture', endWheel);
    left.appendChild(wheel);

    const camRow = document.createElement('div');
    camRow.className = 'tcam';
    const camBtn = (cls, icon, label, onTap) => {
      const b = document.createElement('button');
      b.className = 'tcamBtn ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = icon;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });
      return b;
    };
    const camNum = document.createElement('span');
    camNum.className = 'tcamNum';
    camNum.textContent = '1';
    camRow.append(
      camBtn('prev', ICON.prev, 'Previous camera', () => this.onCamera && this.onCamera(-1)),
      camBtn('cur', ICON.camera, 'Camera', () => this.onCamera && this.onCamera(1)),
      camBtn('next', ICON.next, 'Next camera', () => this.onCamera && this.onCamera(1)),
    );
    camRow.querySelector('.cur').appendChild(camNum);
    this.camNum = camNum;
    left.appendChild(camRow);

    // Pedals. setPointerCapture keeps a press alive when the finger slides off the button.
    const right = document.createElement('div');
    right.className = 'tright';
    const pedal = (cls, label, icon, fields) => {
      const b = document.createElement('button');
      b.className = 'tbtn ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = icon;
      const set = (v) => {
        for (const k of fields) this.touch[k] = v;
        b.classList.toggle('on', !!v);
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(1); });
      b.addEventListener('pointerup', (e) => { e.preventDefault(); set(0); });
      b.addEventListener('pointercancel', () => set(0));
      b.addEventListener('lostpointercapture', () => set(0));
      return b;
    };
    const mid = document.createElement('div');
    mid.className = 'tmid';
    mid.append(
      pedal('drift', 'Drift', ICON.drift, ['hb']),
      // BOOST also sets gas, so one press gives boost without holding the gas pedal.
      pedal('boost', 'Boost (also gas)', ICON.boost, ['bo', 'th']),
    );
    const big = document.createElement('div');
    big.className = 'tbig';
    big.append(
      pedal('brake', 'Brake', ICON.brake, ['br']),
      pedal('gas', 'Gas', ICON.gas, ['th']),
    );
    right.append(mid, big);

    wrap.append(left, right);
    this.root.appendChild(wrap);
    this.touchUI = wrap;
  }

  disableTouch() {
    if (this.touchUI) { this.touchUI.remove(); this.touchUI = null; this.camNum = null; }
    this.resetTouch();
  }

  setCameraLabel(index, total) {
    if (this.camNum) this.camNum.textContent = String(index + 1);
    void total;
  }

  /** Returns {th,br,st,hb,bo} with smoothed steering. dt in seconds. */
  read(dt) {
    const d = this.down;
    const has = (k) => d.has(k);
    const isKey = (name) => [...d].some((c) => KEY[c] === name);
    const wheelSt = this.touch.wheel || 0;
    let left = isKey('left') || wheelSt < -0.02, right = isKey('right') || wheelSt > 0.02;
    const target = wheelSt !== 0 && !isKey('left') && !isKey('right') ? wheelSt : (right ? 1 : 0) - (left ? 1 : 0);
    const rate = target === 0 ? 6 : 4;
    this.steer += (target - this.steer) * Math.min(1, rate * dt);
    if (Math.abs(this.steer) < 0.002 && target === 0) this.steer = 0;
    const bo = (isKey('bo') || this.touch.bo) ? 1 : 0;
    const th = (isKey('th') || this.touch.th || this.touch.bo) ? 1 : 0;   // touch BOOST implies gas; keyboard Shift does not
    const br = (isKey('br') || this.touch.br) ? 1 : 0;
    return {
      th, br, st: Math.max(-1, Math.min(1, this.steer)),
      hb: (has('Space') || this.touch.hb) ? 1 : 0,
      bo,
    };
  }

  destroy() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    this.disableTouch();
  }
}
