// Generative soundscape (Web Audio, no files): a desert drone that blooms into shimmering bells when tripping.
export class Soundscape {
  constructor() { this.ctx = null; this.muted = false; this.trip = 0; this.nextBell = 0; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);

    // reverb from a generated impulse response
    const len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.7;
    this.verb.connect(verbGain).connect(this.master);

    // low drone
    this.droneFilter = ctx.createBiquadFilter(); this.droneFilter.type = 'lowpass'; this.droneFilter.frequency.value = 320; this.droneFilter.Q.value = 2;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.11;
    this.droneFilter.connect(droneGain); droneGain.connect(this.master); droneGain.connect(this.verb);
    for (const [f, type] of [[55, 'sawtooth'], [82.41, 'triangle'], [110.3, 'sawtooth'], [164.8, 'sine']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lfoG = ctx.createGain(); lfoG.gain.value = 6; lfo.connect(lfoG).connect(o.detune);
      const g = ctx.createGain(); g.gain.value = type === 'sine' ? 0.5 : 0.35;
      o.connect(g).connect(this.droneFilter); o.start(); lfo.start();
    }

    // desert wind
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.07; const wlg = ctx.createGain(); wlg.gain.value = 300; wl.connect(wlg).connect(bp.frequency);
    const windGain = ctx.createGain(); windGain.gain.value = 0.05;
    noise.connect(bp).connect(windGain).connect(this.master); noise.start(); wl.start();

    // trip pad: a shimmering major-seventh chord
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0;
    this.padGain.connect(this.master); this.padGain.connect(this.verb);
    for (const f of [220, 277.2, 329.6, 415.3, 554.4]) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
        const trem = ctx.createOscillator(); trem.frequency.value = 0.3 + Math.random() * 2;
        const tg = ctx.createGain(); tg.gain.value = 0.03; trem.connect(tg);
        const g = ctx.createGain(); g.gain.value = 0.04; tg.connect(g.gain);
        o.connect(g).connect(this.padGain); o.start(); trem.start();
      }
    }
  }

  bell() {
    const ctx = this.ctx, notes = [440, 554.4, 659.3, 830.6, 880, 1108.7, 1318.5, 1661.2];
    const f = notes[Math.floor(Math.random() * notes.length)];
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * this.trip, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = pan || g;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); }
    o.connect(g); o2.connect(g);
    out.connect(this.master); out.connect(this.verb);
    o.start(t); o2.start(t); o.stop(t + 2.6); o2.stop(t + 2.6);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  update(trip) {
    if (!this.ctx) return;
    this.trip = trip;
    const now = this.ctx.currentTime;
    this.droneFilter.frequency.setTargetAtTime(320 + trip * 1400, now, 0.3);
    this.padGain.gain.setTargetAtTime(trip * 0.9, now, 0.5);
    if (trip > 0.25 && now > this.nextBell) {
      this.bell();
      this.nextBell = now + 0.18 + Math.random() * (0.9 - trip * 0.5);
    }
  }
}
