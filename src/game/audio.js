// Everything here is synthesized with WebAudio, so the game ships no sound files.
// Ambience follows the city (hum grows with population and zoom, birds by day, crickets at night, rain),
// short effects answer the player, and a slow generative score plays underneath.
const KEY = 'skyline.audio';
const SCALE = [0, 2, 4, 7, 9];                       // major pentatonic
const CHORDS = [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]];   // I, vi, IV, V
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class SoundEngine {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* ignore */ }
    this.sound = saved.sound ?? true; this.music = saved.music ?? true; this.volume = saved.volume ?? 0.7;
    this.ctx = null; this.scene = { pop: 0, zoom: 1, rain: 0, night: false, paused: false };
    this.bar = 0; this.nextBar = 0; this.lastChirp = 0;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ sound: this.sound, music: this.music, volume: this.volume })); } catch (e) { /* ignore */ } }
  settings() { return { sound: this.sound, music: this.music, volume: this.volume }; }
  set(k, v) { this[k] = v; this.save(); this.apply(); }

  // Browsers only allow audio after a tap, so the graph is built on the first touch.
  unlock() {
    if (this.asleep) return;
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    // 'playback' asks the phone for a bigger audio buffer: a fraction of a second more delay on effects, but the sound
    // no longer breaks up when the game is busy (dragging the map, building pictures).
    let c; try { c = new AC({ latencyHint: 'playback' }); } catch (e) { c = new AC(); }
    this.ctx = c;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    // a soft room reverb shared by music and chimes
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(1.4); const vg = c.createGain(); vg.gain.value = 0.32; this.verb.connect(vg); vg.connect(this.master);
    // ambience beds: brown noise for traffic hum, white noise for rain
    const brown = this.noise(4, true), white = this.noise(3, false);
    this.hum = this.loop(brown, 'lowpass', 340, 0.5); this.rain = this.loop(white, 'bandpass', 2400, 0.6);
    this.apply(); this.nextBar = c.currentTime + 0.4;
    this.timer = setInterval(() => this.schedule(), 250);
  }
  // The app went to the background (home button, another app, screen off): silence everything.
  // Nothing is torn down, so coming back is instant.
  sleep() { this.asleep = true; if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  wake() {
    this.asleep = false; if (!this.ctx) return;
    this.ctx.resume().then(() => { this.nextBar = this.ctx.currentTime + 0.4; }).catch(() => {});   // restart the music on a fresh bar, not a burst of missed ones
  }
  noise(sec, brown) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w * 0.5; }
    return b;
  }
  impulse(sec) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }
  loop(buf, type, freq, q) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.ambBus); src.start();
    return { g, f };
  }
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volume, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.sound ? 0.9 : 0, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.sound ? 1 : 0, t, 0.3);
    this.musicBus.gain.setTargetAtTime(this.music ? 0.5 : 0, t, 0.6);
  }
  setScene(s) {
    this.scene = s; if (!this.ctx) return;
    const t = this.ctx.currentTime, city = Math.min(1, Math.log10(1 + s.pop) / 4);
    const close = Math.min(1, Math.max(0.15, (s.zoom - 0.3) / 1.6));
    this.hum.g.gain.setTargetAtTime(0.05 + city * 0.22 * close * (s.night ? 0.6 : 1), t, 1.2);
    this.hum.f.frequency.setTargetAtTime(220 + close * 260, t, 1);
    this.rain.g.gain.setTargetAtTime(s.rain * 0.16, t, 1.5);
  }

  // ---- scheduler: music bars and ambient critters ----
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running' || this.asleep) return;
    const now = c.currentTime, s = this.scene;
    if (this.sound && now - this.lastChirp > 0.6) {
      this.lastChirp = now;
      if (!s.night && s.rain < 0.3 && Math.random() < 0.18 * Math.min(1, s.zoom)) this.chirp(now + Math.random() * 0.4);
      if (s.night && Math.random() < 0.35) this.cricket(now + Math.random() * 0.4);
    }
    const beat = s.night ? 0.75 : 0.6, barLen = beat * 4;
    while (this.nextBar < now + 1.2) {             // schedule well ahead, so a busy moment never leaves a gap
      this.playBar(this.nextBar, beat); this.nextBar += barLen; this.bar++; }
  }
  playBar(t, beat) {
    if (!this.music) return;
    const s = this.scene, root = s.night ? 45 : 50, ch = CHORDS[Math.floor(this.bar / 2) % 4];
    for (const n of ch) this.pad(hz(root + 12 + n), t, beat * 4.2, 0.045);
    this.pad(hz(root + ch[0]), t, beat * 4.2, 0.05);
    for (let b = 0; b < 8; b++) {                              // sparse melody on eighth notes
      if (Math.random() > (s.night ? 0.22 : 0.32)) continue;
      const deg = SCALE[Math.floor(Math.random() * SCALE.length)], oct = Math.random() < 0.3 ? 24 : 12;
      this.pluck(hz(root + 12 + oct + deg), t + b * beat / 2 + Math.random() * 0.02, 0.06);
    }
  }
  pad(f, t, dur, vol) {
    const c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f * 1.003;
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.musicBus); g.connect(this.verb);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  pluck(f, t, vol, bus) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(bus || this.musicBus); g.connect(this.verb); o.start(t); o.stop(t + 1.2);
  }
  chirp(t) {
    const c = this.ctx, n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(), g = c.createGain(), s = t + i * 0.11;
      o.type = 'sine'; o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * 1.5, s + 0.06);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      o.connect(g); g.connect(this.ambBus); o.start(s); o.stop(s + 0.1);
    }
  }
  cricket(t) {
    const c = this.ctx;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator(), g = c.createGain(), s = t + i * 0.07;
      o.type = 'square'; o.frequency.value = 4400;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.006, s + 0.01); g.gain.linearRampToValueAtTime(0, s + 0.04);
      o.connect(g); g.connect(this.ambBus); o.start(s); o.stop(s + 0.05);
    }
  }

  // ---- effects ----
  play(name) {
    const c = this.ctx; if (!c || !this.sound || c.state !== 'running') return;
    const t = c.currentTime;
    const tone = (f, at, dur, vol, type = 'sine', slide) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + at + dur);
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(vol, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g); g.connect(this.sfxBus); o.start(t + at); o.stop(t + at + dur + 0.05);
    };
    const thud = (at, vol, freq = 900) => {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise(0.4, false); f.type = 'lowpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.35);
      src.connect(f); f.connect(g); g.connect(this.sfxBus); src.start(t + at); src.stop(t + at + 0.4);
    };
    switch (name) {
      case 'build': tone(520, 0, 0.12, 0.12, 'triangle'); tone(780, 0.05, 0.14, 0.08, 'triangle'); thud(0, 0.18, 500); break;
      case 'zone': tone(660, 0, 0.08, 0.07, 'triangle'); break;
      case 'bulldoze': thud(0, 0.35, 700); thud(0.08, 0.2, 400); tone(140, 0, 0.25, 0.08, 'sawtooth', 70); break;
      case 'error': tone(220, 0, 0.14, 0.09, 'square'); tone(180, 0.1, 0.18, 0.08, 'square'); break;
      case 'undo': tone(700, 0, 0.1, 0.08, 'triangle', 420); break;
      case 'tap': tone(900, 0, 0.05, 0.05, 'sine'); break;
      case 'coin': tone(988, 0, 0.12, 0.08, 'triangle'); tone(1319, 0.07, 0.25, 0.08, 'triangle'); break;
      case 'goal': [0, 4, 7, 12].forEach((n, i) => this.pluck(hz(72 + n), t + i * 0.09, 0.12, this.sfxBus)); break;
      case 'unlock': [0, 7, 12, 16, 19].forEach((n, i) => this.pluck(hz(67 + n), t + i * 0.07, 0.1, this.sfxBus)); break;
      case 'alarm': for (let i = 0; i < 3; i++) { tone(880, i * 0.5, 0.25, 0.07, 'sawtooth', 660); tone(660, i * 0.5 + 0.25, 0.25, 0.07, 'sawtooth', 880); } break;
      case 'warn': tone(330, 0, 0.3, 0.08, 'triangle', 247); tone(247, 0.25, 0.4, 0.07, 'triangle'); break;
      case 'step': tone(784, 0, 0.12, 0.07, 'sine'); tone(1175, 0.08, 0.2, 0.06, 'sine'); break;
      default: break;
    }
  }
}
