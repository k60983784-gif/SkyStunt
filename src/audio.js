// Procedural Web Audio: engine tone that follows speed/throttle, tyre squeal, boost whoosh, impacts, chimes.
// No audio files are used; everything is synthesized at runtime.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.6;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(c.destination);
    // engine
    this.eOsc = c.createOscillator(); this.eOsc.type = 'sawtooth';
    this.eOsc2 = c.createOscillator(); this.eOsc2.type = 'square';
    this.eFilter = c.createBiquadFilter(); this.eFilter.type = 'lowpass'; this.eFilter.frequency.value = 900;
    this.eGain = c.createGain(); this.eGain.gain.value = 0;
    this.eOsc.connect(this.eFilter); this.eOsc2.connect(this.eFilter); this.eFilter.connect(this.eGain); this.eGain.connect(this.master);
    this.eOsc.start(); this.eOsc2.start();
    // noise source for squeal / whoosh / impact
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = c.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
    this.nFilter = c.createBiquadFilter(); this.nFilter.type = 'bandpass'; this.nFilter.frequency.value = 1400; this.nFilter.Q.value = 1.2;
    this.nGain = c.createGain(); this.nGain.gain.value = 0;
    this.noise.connect(this.nFilter); this.nFilter.connect(this.nGain); this.nGain.connect(this.master);
    this.noise.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master && this.enabled) this.master.gain.value = v;
  }

  /** Called every frame with the local car state. */
  update(speedMs, throttle, slip, boosting) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const rpm = 55 + Math.min(1, speedMs / 55) * 150 + throttle * 25;
    this.eOsc.frequency.setTargetAtTime(rpm, t, 0.05);
    this.eOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.05);
    this.eFilter.frequency.setTargetAtTime(500 + throttle * 1200 + speedMs * 8, t, 0.08);
    this.eGain.gain.setTargetAtTime(0.05 + throttle * 0.05 + Math.min(0.08, speedMs / 1200), t, 0.1);
    const squeal = Math.min(0.22, Math.max(0, slip - 0.12) * 0.7) * (speedMs > 10 ? 1 : 0);
    this.nFilter.frequency.setTargetAtTime(boosting ? 900 : 1600 + slip * 800, t, 0.1);
    this.nGain.gain.setTargetAtTime(squeal + (boosting ? 0.12 : 0), t, 0.08);
  }

  impact(strength = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const g = c.createGain(); g.gain.setValueAtTime(0.5 * strength, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3);
  }

  chime(freq = 880, dur = 0.35) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    [freq, freq * 1.5].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.05); g.gain.exponentialRampToValueAtTime(0.2, t + i * 0.05 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.05); o.stop(t + dur + 0.1);
    });
  }
}
