// Device and input detection: decides touch vs keyboard, phone vs tablet vs desktop, and portrait vs landscape.
// The result is written to <body> classes so CSS can adapt, and a 'skystunt:device' event is dispatched on change.
// Sources and reasoning: docs/MOBILE_UX.md.
const OVERRIDE_KEY = 'skystunt.input'; // 'auto' (default) | 'touch' | 'keyboard'

export function getInputOverride() {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    return v === 'touch' || v === 'keyboard' ? v : 'auto';
  } catch { return 'auto'; }
}

export function setInputOverride(v) {
  try { localStorage.setItem(OVERRIDE_KEY, v); } catch { /* private mode: keep it in memory only */ }
  applyDeviceClasses();
}

export function detectDevice() {
  const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  const coarse = mq('(pointer: coarse)');
  const anyFine = mq('(any-pointer: fine)');
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  // A touch screen with a mouse (laptop) is still a desktop: "any-pointer: fine" counts the mouse.
  const autoTouch = coarse || (hasTouch && !anyFine);
  const override = getInputOverride();
  const touch = override === 'touch' ? true : override === 'keyboard' ? false : autoTouch;
  const w = window.innerWidth, h = window.innerHeight;
  const short = Math.min(w, h);
  const kind = !touch && short >= 600 ? 'desktop' : short < 600 ? 'phone' : 'tablet';
  const portrait = h > w;
  return { touch, kind, portrait, override, autoTouch };
}

const CLASSES = ['is-touch', 'is-keyboard', 'is-phone', 'is-tablet', 'is-desktop', 'is-portrait', 'is-landscape'];

export function applyDeviceClasses() {
  const d = detectDevice();
  const b = document.body;
  b.classList.remove(...CLASSES);
  b.classList.add(d.touch ? 'is-touch' : 'is-keyboard', `is-${d.kind}`, d.portrait ? 'is-portrait' : 'is-landscape');
  const prev = b.dataset.device || '';
  const next = `${d.touch ? 'touch' : 'keyboard'}-${d.kind}-${d.portrait ? 'portrait' : 'landscape'}`;
  b.dataset.device = next;
  if (prev !== next) window.dispatchEvent(new CustomEvent('skystunt:device', { detail: d }));
  return d;
}

/** Call once at startup. Re-checks on resize, orientation change and pointer changes (for example a dock or a tablet keyboard). */
export function watchDevice() {
  applyDeviceClasses();
  let t = 0;
  const schedule = () => { clearTimeout(t); t = setTimeout(applyDeviceClasses, 120); };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (typeof matchMedia === 'function') {
    for (const q of ['(pointer: coarse)', '(any-pointer: fine)']) {
      const m = matchMedia(q);
      if (m.addEventListener) m.addEventListener('change', schedule);
    }
  }
}
