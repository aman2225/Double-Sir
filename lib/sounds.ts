// Lightweight synthesized sound effects via the Web Audio API — no binary
// audio assets required. Each cue is a short tone/arpeggio; volume and
// on/off state are controlled by store/useUIStore's `soundEnabled` flag,
// which callers must check before invoking these (see hooks/useSoundEffects.ts).

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = "sine", peakGain = 0.08) {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const start = audioCtx.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sounds = {
  cardPlay: () => tone(520, 0, 0.08, "triangle", 0.05),
  cardFlip: () => tone(680, 0, 0.06, "square", 0.03),
  deal: () => tone(340, 0, 0.05, "triangle", 0.03),
  trickWin: () => {
    tone(660, 0, 0.12, "sine", 0.06);
    tone(880, 0.08, 0.14, "sine", 0.06);
  },
  handsCollected: () => {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, i * 0.07, 0.14, "sine", 0.06));
  },
  penalty: () => {
    tone(300, 0, 0.18, "sawtooth", 0.05);
    tone(180, 0.1, 0.22, "sawtooth", 0.05);
  },
  matchWin: () => {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, i * 0.09, 0.2, "sine", 0.07));
  },
  error: () => tone(160, 0, 0.15, "square", 0.04),

  // --- Real-time communication cues ---------------------------------------
  messageReceived: () => tone(740, 0, 0.05, "sine", 0.04),
  emojiPop: () => {
    tone(600, 0, 0.05, "triangle", 0.05);
    tone(900, 0.04, 0.06, "triangle", 0.04);
  },
  voiceJoin: () => {
    tone(440, 0, 0.08, "sine", 0.05);
    tone(660, 0.06, 0.1, "sine", 0.05);
  },
  voiceLeave: () => {
    tone(660, 0, 0.08, "sine", 0.05);
    tone(440, 0.06, 0.1, "sine", 0.05);
  },
  muteToggle: () => tone(500, 0, 0.05, "square", 0.03),

  // --- Premium table cues -------------------------------------------------
  trumpSelect: () => {
    tone(392, 0, 0.1, "triangle", 0.06);
    tone(587, 0.07, 0.16, "triangle", 0.06);
  },
  yourTurn: () => {
    tone(587, 0, 0.09, "sine", 0.06);
    tone(784, 0.06, 0.12, "sine", 0.06);
  },
  timerWarning: () => tone(440, 0, 0.08, "triangle", 0.045),
  timerCritical: () => tone(330, 0, 0.1, "square", 0.05),
};
