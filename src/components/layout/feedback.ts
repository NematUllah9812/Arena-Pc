'use client';
/**
 * Optional WebAudio "Cherry MX Blue / Topre thock" feedback (Spec §2.1).
 * Synthesised 8ms buffers — no audio assets. Off by default; persisted per device.
 */
const KEY = 'vortex.audio.v1';
let ctx: AudioContext | null = null;

export function audioEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === 'on';
}

export function setAudioEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? 'on' : 'off');
  if (on) playClick('confirm');
}

export function playClick(kind: 'click' | 'thock' | 'confirm' | 'error' = 'click') {
  if (!audioEnabled()) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ac = ctx;
    const dur = kind === 'thock' ? 0.018 : 0.008;
    const frames = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const env = Math.pow(1 - i / frames, kind === 'thock' ? 3 : 6);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = kind === 'thock' ? 'lowpass' : 'bandpass';
    filter.frequency.value = kind === 'thock' ? 900 : kind === 'error' ? 380 : 3200;
    const gain = ac.createGain();
    gain.gain.value = kind === 'error' ? 0.35 : 0.22;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
    if (kind === 'confirm' || kind === 'error') {
      const osc = ac.createOscillator();
      const g2 = ac.createGain();
      osc.frequency.value = kind === 'confirm' ? 1760 : 220;
      g2.gain.setValueAtTime(0.05, ac.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
      osc.connect(g2).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.07);
    }
  } catch {
    /* audio is decorative */
  }
}
