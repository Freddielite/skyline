#!/usr/bin/env python3
"""Renders Skyline's soundtrack to public/audio/*.mp3 (needs numpy, scipy, ffmpeg).
Run:  python3 tools/make-music.py      Edit TRACKS below to change moods, keys, tempos and chords."""
import subprocess, sys, os
import numpy as np
from scipy.signal import lfilter, fftconvolve, butter, sosfilt

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# name, bpm, key root (midi), scale intervals, chord degrees (semitones from root, stacked triads/7ths), bars per chord, feel
TRACKS = [
  dict(name='morning',  bpm=76, root=60, scale=[0,2,4,7,9],    chords=[[0,4,7,11],[7,11,14,17],[9,12,16,19],[5,9,12,16]], beat=1, arp=0.55, perc=0.5, bright=1.0, seed=11, bars=36),
  dict(name='daytime',  bpm=92, root=67, scale=[0,2,4,7,9],    chords=[[0,4,7],[9,12,16],[5,9,12],[7,11,14]],            beat=1, arp=0.75, perc=1.0, bright=1.2, seed=22, bars=44),
  dict(name='golden',   bpm=70, root=65, scale=[0,2,4,7,9],    chords=[[0,4,7,11],[4,7,11,14],[5,9,12,16],[7,11,14,17]], beat=1, arp=0.5,  perc=0.35, bright=0.8, seed=33, bars=32),
  dict(name='dusk',     bpm=66, root=57, scale=[0,3,5,7,10],   chords=[[0,3,7,10],[8,12,15,19],[3,7,10,14],[10,14,17,21]], beat=1, arp=0.45, perc=0.3, bright=0.65, seed=44, bars=32),
  dict(name='night',    bpm=54, root=50, scale=[0,3,5,7,10],   chords=[[0,3,7,10],[5,8,12,15],[3,7,10,14],[7,10,14,17]], beat=0, arp=0.22, perc=0.0, bright=0.45, seed=55, bars=26),
]

def lp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype='low', output='sos'); return sosfilt(sos, x)
def hp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype='high', output='sos'); return sosfilt(sos, x)

def env(n, a, r, hold=None):
    e = np.ones(n); a = min(int(a * SR), n // 2); r = min(int(r * SR), n // 2)
    if a: e[:a] = np.linspace(0, 1, a) ** 1.5
    if r: e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e

def pad_note(freq, dur, rng, bright):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for det in (-0.07, 0.0, 0.08):                      # three slightly detuned voices
        f = freq * 2 ** (det / 12); ph = rng.random() * 6.28
        for h in range(1, 7):
            y += np.sin(2 * np.pi * f * h * t + ph * h) / (h ** (1.6 - 0.25 * bright))
    y *= 0.08 * (0.8 + 0.4 * np.sin(2 * np.pi * 0.11 * t + rng.random() * 6))   # slow breathing
    return y * env(n, 1.6, 2.2)

def pluck(freq, dur, bright):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 6) + 0.2 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 9)
    y += 0.12 * np.sin(2 * np.pi * freq * 4.01 * t) * np.exp(-t * 14) * bright   # soft bell shimmer
    return y * np.exp(-t * (3.2 + 1.2 / max(bright, .3))) * env(n, 0.004, 0.05)

def bass_note(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return y * env(n, 0.03, 0.4) * 0.5

def kick():
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 28); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.55
def hat(rng):
    n = int(0.07 * SR); return hp(rng.standard_normal(n), 6500) * np.exp(-np.arange(n) / SR * 70) * 0.16
def brush(rng):
    n = int(0.22 * SR); t = np.arange(n) / SR; return hp(lp(rng.standard_normal(n), 5200), 1500) * np.exp(-t * 16) * 0.12

def add(buf, x, pos):
    pos = max(0, pos)
    if pos >= len(buf): return
    end = min(len(buf), pos + len(x)); buf[pos:end] += x[:end - pos]

def reverb(x, sec, wet, seed):
    rng = np.random.default_rng(seed); n = int(sec * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t * (6.0 / sec)); ir = np.stack([lp(c, 4200) for c in ir])
    ir[:, :int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True)) + 1e-9
    w = np.stack([fftconvolve(x, ir[0])[:len(x)], fftconvolve(x, ir[1])[:len(x)]])
    return w * wet

def render(T):
    rng = np.random.default_rng(T['seed']); beat = 60.0 / T['bpm']; bar = beat * 4
    bars = T['bars']; total = int((bars * bar + 4) * SR)
    pads = np.zeros(total); bass = np.zeros(total); lead = np.zeros(total); perc = np.zeros(total)
    cb = 2                                              # bars per chord
    notes_pool = [T['root'] + 12 + s for s in T['scale']] + [T['root'] + 24 + s for s in T['scale']]
    last = 2
    for b in range(0, bars, cb):
        ch = T['chords'][(b // cb) % len(T['chords'])]; t0 = int(b * bar * SR); dur = cb * bar + 1.8
        for i, semi in enumerate(ch): add(pads, pad_note(mtof(T['root'] + semi), dur, rng, T['bright']), t0)
        add(bass, bass_note(mtof(T['root'] - 12 + ch[0]), cb * bar * 0.96), t0)
        if T['beat']: add(bass, bass_note(mtof(T['root'] - 12 + ch[0] + 7), beat * 1.6), t0 + int(bar * 1.5 * SR) if cb > 1 else t0)
        # arpeggio / melody: steps on eighth notes, the chance of a note follows the track's arp density
        step = beat / 2
        for s in range(int(cb * bar / step)):
            if rng.random() > T['arp'] * (0.55 if s % 2 else 1.0): continue
            if rng.random() < 0.55: m = T['root'] + 12 + ch[rng.integers(0, len(ch))] + (12 if rng.random() < 0.35 else 0)   # chord tone
            else:
                last = int(np.clip(last + rng.integers(-2, 3), 0, len(notes_pool) - 1)); m = notes_pool[last]            # walk the scale
            add(lead, pluck(mtof(m), 2.4, T['bright']) * (0.16 + 0.08 * rng.random()), t0 + int((s * step + (rng.random() - .5) * 0.012) * SR))
        if T['perc'] > 0:
            for q in range(cb * 4):
                tp = t0 + int(q * beat * SR)
                if q % 4 == 0 and T['perc'] >= 0.5: add(perc, kick() * T['perc'], tp)
                if q % 2 == 1 and T['perc'] >= 0.5: add(perc, brush(rng) * 1.4, tp)
                add(perc, hat(rng) * T['perc'], tp + int(beat * 0.5 * SR))
    dry = lp(pads, 2600 * T['bright'] + 700) + bass + lead + perc * 0.9
    # gentle stereo: pads and lead pushed apart slightly, all through a room reverb
    wet = reverb(lead * 1.3 + pads * 0.8, 3.2, 0.6, T['seed'])
    L = dry * 0.9 + wet[0] + np.roll(lead, 140) * 0.1; R = dry * 0.9 + wet[1] + np.roll(lead, -140) * 0.1
    st = np.stack([L, R]); st = st[:, :int((bars * bar + 3.0) * SR)]
    fade = int(3.0 * SR); st[:, :fade] *= np.linspace(0, 1, fade); st[:, -fade:] *= np.linspace(1, 0, fade)   # soft ends: tracks crossfade in the game
    st /= np.max(np.abs(st)) / 0.82
    return st

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    for T in TRACKS:
        if only and T['name'] not in only: continue
        st = render(T); pcm = (st.T * 32767).astype('<i2').tobytes(); dst = os.path.join(OUT, T['name'] + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '112k', dst], input=pcm, check=True)
        print(T['name'], round(os.path.getsize(dst) / 1e6, 2), 'MB', round(st.shape[1] / SR), 's')
