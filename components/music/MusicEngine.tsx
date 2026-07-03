"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { useMusicStore, liveMusicPositionMs } from "@/store/useMusicStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { findTrack } from "@/lib/musicLibrary";
import { GLASS_PANEL } from "@/lib/tableTheme";

const DUCK_FACTOR = 0.25;
const RAMP_SEC = 0.3; // 300ms, per spec
const DRIFT_CHECK_MS = 2000;
const DRIFT_TOLERANCE_MS = 300;
const PRELOAD_LEAD_MS = 5000;

// Module-level singleton: the audio element + Web Audio graph must survive
// this component unmounting/remounting across page navigation (room lobby
// -> game table should not interrupt music), and a MediaElementAudioSourceNode
// can only ever be created ONCE per <audio> element — recreating the
// element on every mount would both interrupt playback and eventually
// throw. Kept at module scope, exactly like useVoiceStore's peer
// RTCPeerConnections/audio elements.
let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let lastLoadedTrackId: string | null = null;
let lastAppliedStartEpoch: number | undefined;
let preloadedForTrackId: string | null = null;

function ensureGraph(): { el: HTMLAudioElement; ctx: AudioContext; gain: GainNode } {
  if (!audioEl) {
    audioEl = document.createElement("audio");
    audioEl.preload = "none";
    audioEl.crossOrigin = "anonymous";
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);
  }
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    sourceNode.connect(gainNode).connect(audioCtx.destination);
  }
  return { el: audioEl, ctx: audioCtx, gain: gainNode! };
}

function rampGainTo(target: number) {
  if (!audioCtx || !gainNode) return;
  const now = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), now + RAMP_SEC);
}

/** Logic-only — owns background music playback, drift correction, next-track preloading, and voice-priority ducking. Renders nothing but a small "tap to enable audio" affordance if the browser blocks autoplay. */
export function MusicEngine() {
  const trackId = useMusicStore((s) => s.trackId);
  const status = useMusicStore((s) => s.status);
  const positionMs = useMusicStore((s) => s.positionMs);
  const playbackStartEpoch = useMusicStore((s) => s.playbackStartEpoch);
  const order = useMusicStore((s) => s.order);
  const index = useMusicStore((s) => s.index);
  const volume = useMusicStore((s) => s.volume);
  const muted = useMusicStore((s) => s.muted);
  const anyoneSpeaking = useVoiceStore((s) => s.speakingSeats.size > 0);

  const [needsGesture, setNeedsGesture] = useState(false);
  const duckingRef = useRef(false);

  // Create the graph once a track is actually needed (lazy — satisfies
  // "lazy load audio files" without ever creating an AudioContext before
  // there's anything to play).
  useEffect(() => {
    if (!trackId) return;
    ensureGraph();
  }, [trackId]);

  // Load the correct track file when it changes.
  useEffect(() => {
    if (!trackId) return;
    const track = findTrack(trackId);
    if (!track) return;
    const { el } = ensureGraph();
    if (lastLoadedTrackId !== trackId) {
      lastLoadedTrackId = trackId;
      el.src = track.url;
      el.load();
    }
  }, [trackId]);

  // Sync play/pause/stop + seek to the server-authoritative position.
  useEffect(() => {
    if (!trackId) return;
    const { el } = ensureGraph();

    if (status === "stopped") {
      el.pause();
      el.currentTime = 0;
      return;
    }
    if (status === "paused") {
      el.pause();
      el.currentTime = positionMs / 1000;
      return;
    }

    // status === "playing": only hard-seek on a genuinely NEW playback
    // segment (fresh play/seek/track-change) — never on every render, so
    // natural drift-check corrections (below) don't fight normal playback.
    const isFreshSegment = playbackStartEpoch !== lastAppliedStartEpoch;
    if (isFreshSegment) {
      lastAppliedStartEpoch = playbackStartEpoch;
      el.currentTime = liveMusicPositionMs({ status, positionMs, playbackStartEpoch }) / 1000;
    }
    el.play().catch(() => setNeedsGesture(true));
  }, [trackId, status, positionMs, playbackStartEpoch]);

  // Periodic drift correction + next-track preload, only while playing.
  useEffect(() => {
    if (status !== "playing" || !trackId) return;
    const interval = setInterval(() => {
      const { el } = ensureGraph();
      const track = findTrack(trackId);
      if (!track) return;

      const expectedMs = liveMusicPositionMs({ status, positionMs, playbackStartEpoch });
      const actualMs = el.currentTime * 1000;
      if (Math.abs(actualMs - expectedMs) > DRIFT_TOLERANCE_MS) {
        el.currentTime = expectedMs / 1000;
      }

      const remaining = track.durationMs - expectedMs;
      if (remaining > 0 && remaining < PRELOAD_LEAD_MS && order.length > 0) {
        const nextId = order[(index + 1) % order.length];
        const nextTrack = findTrack(nextId);
        if (nextTrack && preloadedForTrackId !== nextId) {
          preloadedForTrackId = nextId;
          const warm = new Audio();
          warm.preload = "auto";
          warm.src = nextTrack.url;
        }
      }
    }, DRIFT_CHECK_MS);
    return () => clearInterval(interval);
  }, [status, trackId, positionMs, playbackStartEpoch, order, index]);

  // Smart audio ducking — priority is voice, never pause/interrupt music,
  // just fade the gain. Multiple simultaneous speakers are already handled
  // since this is driven by `.size > 0`, not a per-speaker counter.
  useEffect(() => {
    duckingRef.current = anyoneSpeaking;
    if (!gainNode) return;
    const base = muted ? 0 : volume;
    rampGainTo(anyoneSpeaking ? base * DUCK_FACTOR : base);
  }, [anyoneSpeaking, volume, muted]);

  // Personal volume/mute changes re-apply immediately (still respecting
  // whatever ducking state is currently active).
  useEffect(() => {
    if (!gainNode) return;
    const base = muted ? 0 : volume;
    rampGainTo(duckingRef.current ? base * DUCK_FACTOR : base);
  }, [volume, muted]);

  function handleEnableAudio() {
    const { el, ctx } = ensureGraph();
    ctx.resume().catch(() => {});
    el.play()
      .then(() => setNeedsGesture(false))
      .catch(() => {});
  }

  return (
    <AnimatePresence>
      {needsGesture && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={handleEnableAudio}
          className={`fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium sm:bottom-4 ${GLASS_PANEL}`}
        >
          <Volume2 className="h-4 w-4 text-[var(--gold,#facc15)]" /> Tap to enable audio
        </motion.button>
      )}
    </AnimatePresence>
  );
}
