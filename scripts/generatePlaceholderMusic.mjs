// One-time generator for the built-in placeholder music library
// (lib/musicLibrary.ts). Pure Web-Audio-style synthesis rendered to WAV —
// zero external assets, zero copyright risk. Reuses the same idea as
// lib/sounds.ts's tone() (oscillator + linear-ramp envelope), just
// rendered to a sample buffer instead of a live AudioContext.
//
// Run with: node scripts/generatePlaceholderMusic.mjs
// Output: public/music/<id>.wav (22.05kHz mono 16-bit PCM, ~64s each)
//
// These are intentionally simple placeholders. To swap in real
// royalty-free tracks later (Pixabay/Mixkit/etc.), just drop mp3 files
// into public/music/ and update the `url`/`durationMs` fields in
// lib/musicLibrary.ts — no other code changes needed.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "music");
const SAMPLE_RATE = 22050;
const DURATION_SEC = 64;
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC;

function silence() {
  return new Float32Array(TOTAL_SAMPLES);
}

/** Adds a sustained tone with a soft attack/release envelope into `buf` over [tStart, tEnd) seconds. */
function addTone(buf, freq, tStart, tEnd, gain, waveform = "sine") {
  const startSample = Math.floor(tStart * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, Math.floor(tEnd * SAMPLE_RATE));
  const len = endSample - startSample;
  if (len <= 0) return;
  const attack = Math.min(len, Math.floor(0.15 * SAMPLE_RATE));
  const release = Math.min(len - attack, Math.floor(0.25 * SAMPLE_RATE));
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > len - release) env = Math.max(0, (len - i) / release);
    let sample;
    const phase = 2 * Math.PI * freq * t;
    if (waveform === "triangle") {
      sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
    } else if (waveform === "sine") {
      sample = Math.sin(phase);
    } else {
      sample = Math.sign(Math.sin(phase)) * 0.6; // soft square
    }
    const idx = startSample + i;
    buf[idx] += sample * env * gain;
  }
}

/** A single short percussive-ish pulse (soft kick/stab), fast decay. */
function addPulse(buf, freq, tStart, durSec, gain) {
  const startSample = Math.floor(tStart * SAMPLE_RATE);
  const len = Math.floor(durSec * SAMPLE_RATE);
  for (let i = 0; i < len; i++) {
    const idx = startSample + i;
    if (idx < 0 || idx >= TOTAL_SAMPLES) continue;
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t / (durSec * 0.35));
    // slight pitch drop for a "thump" character
    const instFreq = freq * (1 + 0.5 * Math.exp(-t / (durSec * 0.2)));
    buf[idx] += Math.sin(2 * Math.PI * instFreq * t) * env * gain;
  }
}

/** Plays a chord's notes as a quick ascending arpeggio starting at tStart. */
function addArpeggio(buf, freqs, tStart, noteDur, gain, waveform) {
  freqs.forEach((f, i) => addTone(buf, f, tStart + i * noteDur, tStart + i * noteDur + noteDur * 1.4, gain, waveform));
}

/** Holds a full chord (all notes together) as a pad from tStart to tEnd. */
function addPad(buf, freqs, tStart, tEnd, gain, waveform) {
  freqs.forEach((f) => addTone(buf, f, tStart, tEnd, gain / freqs.length, waveform));
}

function normalize(buf, peak = 0.85) {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  if (max === 0) return;
  const scale = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= scale;
}

function toWavBuffer(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buf.writeUInt16LE(bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

// --- Chord vocabulary (Hz) -------------------------------------------------
const C4 = 261.63, E4 = 329.63, G4 = 392.0, A4 = 440.0, D4 = 293.66, F4 = 349.23, B3 = 246.94;
const A3 = 220.0, F3 = 174.61, G3 = 196.0, D3 = 146.83, E3 = 164.81;
const C2 = 65.41, G2 = 98.0, D2 = 73.42, A1 = 55.0, A2 = 110.0;

const CHORDS = {
  Cmaj: [C4, E4, G4],
  Am: [A3, C4, E4],
  Fmaj: [F3, A3, C4],
  Gmaj: [G3, B3, D4],
  Dm: [D4, F4, A4],
  Em: [E3, G3, B3],
  // Low power-chord-style drones (root + fifth) for the "Epic Battle" track.
  Cdrone: [C2, G2],
  Gdrone: [G2, D3],
  Ddrone: [D2, A2],
  Adrone: [A1, E3],
};

// --- Track recipes -----------------------------------------------------
function renderPadLoop({ progression, chordDur, waveform, gain }) {
  const buf = silence();
  let t = 0;
  while (t < DURATION_SEC) {
    for (const name of progression) {
      if (t >= DURATION_SEC) break;
      addPad(buf, CHORDS[name], t, Math.min(DURATION_SEC, t + chordDur), gain, waveform);
      t += chordDur;
    }
  }
  return buf;
}

function renderArpeggioLoop({ progression, chordDur, noteDur, waveform, padGain, arpGain }) {
  const buf = silence();
  let t = 0;
  while (t < DURATION_SEC) {
    for (const name of progression) {
      if (t >= DURATION_SEC) break;
      const end = Math.min(DURATION_SEC, t + chordDur);
      addPad(buf, CHORDS[name], t, end, padGain, "sine");
      addArpeggio(buf, CHORDS[name], t, noteDur, arpGain, waveform);
      t += chordDur;
    }
  }
  return buf;
}

function renderRhythmic({ progression, chordDur, beatDur, pulseFreq, waveform, padGain, pulseGain }) {
  const buf = silence();
  let t = 0;
  let chordIdx = 0;
  while (t < DURATION_SEC) {
    const name = progression[chordIdx % progression.length];
    const end = Math.min(DURATION_SEC, t + chordDur);
    addPad(buf, CHORDS[name], t, end, padGain, waveform);
    for (let beatT = t; beatT < end; beatT += beatDur) addPulse(buf, pulseFreq, beatT, beatDur * 0.9, pulseGain);
    t = end;
    chordIdx++;
  }
  return buf;
}

const TRACKS = [
  {
    id: "casino-night",
    title: "Casino Night",
    render: () =>
      renderArpeggioLoop({
        progression: ["Cmaj", "Am", "Fmaj", "Gmaj"],
        chordDur: 3.2,
        noteDur: 0.22,
        waveform: "triangle",
        padGain: 0.12,
        arpGain: 0.16,
      }),
  },
  {
    id: "royal-table",
    title: "Royal Table",
    render: () =>
      renderArpeggioLoop({
        progression: ["Fmaj", "Cmaj", "Gmaj", "Am"],
        chordDur: 4.8,
        noteDur: 0.55,
        waveform: "triangle",
        padGain: 0.16,
        arpGain: 0.1,
      }),
  },
  {
    id: "relax",
    title: "Relax",
    render: () => renderPadLoop({ progression: ["Am", "Fmaj", "Cmaj", "Gmaj"], chordDur: 8, waveform: "sine", gain: 0.18 }),
  },
  {
    id: "action",
    title: "Action",
    render: () =>
      renderRhythmic({
        progression: ["Dm", "Am", "Fmaj", "Gmaj"],
        chordDur: 3.4,
        beatDur: 0.43,
        pulseFreq: 90,
        waveform: "sine",
        padGain: 0.11,
        pulseGain: 0.22,
      }),
  },
  {
    id: "epic-battle",
    title: "Epic Battle",
    render: () =>
      renderRhythmic({
        progression: ["Cdrone", "Gdrone", "Ddrone", "Adrone"],
        chordDur: 5.3,
        beatDur: 0.8,
        pulseFreq: 55,
        waveform: "triangle",
        padGain: 0.16,
        pulseGain: 0.28,
      }),
  },
  {
    id: "chill-lounge",
    title: "Chill Lounge",
    render: () =>
      renderArpeggioLoop({
        progression: ["Em", "Cmaj", "Gmaj", "Dm"],
        chordDur: 5.6,
        noteDur: 0.6,
        waveform: "sine",
        padGain: 0.15,
        arpGain: 0.09,
      }),
  },
];

for (const track of TRACKS) {
  const samples = track.render();
  normalize(samples);
  const wav = toWavBuffer(samples);
  const outPath = path.join(OUT_DIR, `${track.id}.wav`);
  writeFileSync(outPath, wav);
  console.log(`${track.id}.wav — ${(wav.length / 1024 / 1024).toFixed(2)} MB — ${DURATION_SEC * 1000}ms`);
}
