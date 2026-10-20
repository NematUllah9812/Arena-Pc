'use client';
import { useEffect, useState } from 'react';
import { audioEnabled, setAudioEnabled } from './feedback';

const GOV_KEY = 'vortex.governor.v1';

/** Applies the persisted FPS governor before paint (inlined in <head>). */
export const governorBootScript = `try{var g=localStorage.getItem('${GOV_KEY}');var low=navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4;var save=navigator.connection&&navigator.connection.saveData;if(g==='on'||(g===null&&(low||save))){document.documentElement.classList.add('perf-governor-active')}}catch(e){}`;

export function SystemToggles() {
  const [gov, setGov] = useState(false);
  const [audio, setAudio] = useState(false);
  useEffect(() => {
    setGov(document.documentElement.classList.contains('perf-governor-active'));
    setAudio(audioEnabled());
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`btn-ghost size-sm ${gov ? 'is-active' : ''}`}
        aria-pressed={gov}
        onClick={() => {
          const next = !gov;
          setGov(next);
          document.documentElement.classList.toggle('perf-governor-active', next);
          localStorage.setItem(GOV_KEY, next ? 'on' : 'off');
        }}
        title="Strips blur, scanlines and continuous shaders for 120 FPS on low-power devices"
      >
        FPS Governor: {gov ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        className={`btn-ghost size-sm ${audio ? 'is-active' : ''}`}
        aria-pressed={audio}
        onClick={() => {
          const next = !audio;
          setAudio(next);
          setAudioEnabled(next);
        }}
        title="Synthesised mechanical switch feedback"
      >
        Switch Audio: {audio ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
