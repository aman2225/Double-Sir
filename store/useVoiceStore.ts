import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AppSocket } from "@/sockets/client";
import { Seat } from "@/engine/types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAKING_THRESHOLD = 12; // 0-128 scale off getByteTimeDomainData deviation
const SPEAKING_POLL_MS = 150;
const SPEAKING_HANGOVER_MS = 500; // avoid flicker: keep "speaking" a beat after audio dips below threshold

export type PeerConnectionState = "connecting" | "connected" | "failed" | "disconnected";

interface RemotePeer {
  seat: Seat;
  playerProfileId: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
  pendingCandidates: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
}

interface VoiceState {
  socket: AppSocket | null;
  roomCode: string | null;
  mySeat: Seat | null;
  myPlayerProfileId: string | null;

  voiceEnabled: boolean; // getUserMedia succeeded and the mesh is active
  localStream: MediaStream | null;
  micEnabled: boolean; // self-toggled mute/unmute
  pushToTalkEnabled: boolean;
  pushToTalkActive: boolean;

  peers: Map<Seat, RemotePeer>;
  connectionState: Map<Seat, PeerConnectionState>;
  speakingSeats: Set<Seat>;
  remoteMuted: Map<Seat, boolean>; // their self-reported mute state
  localMutedSeats: Set<Seat>; // "mute other player" — 100% client-local
  seatVolumes: Map<Seat, number>;
  /** Personal master multiplier applied on top of every per-seat volume — part of the Music/Voice/Effects "Individual Audio Controls" panel. */
  masterVoiceVolume: number;
  outputDeviceId: string | null;

  bindToSocket: (socket: AppSocket) => void;
  enableVoice: (roomCode: string, mySeat: Seat, myPlayerProfileId: string) => Promise<void>;
  disableVoice: () => void;
  toggleMic: () => void;
  setPushToTalk: (enabled: boolean) => void;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
  setSeatVolume: (seat: Seat, volume: number) => void;
  setMasterVoiceVolume: (volume: number) => void;
  toggleLocalMute: (seat: Seat) => void;
  setOutputDevice: (deviceId: string) => Promise<void>;
}

let speakingPollHandle: ReturnType<typeof setInterval> | null = null;
let analyser: AnalyserNode | null = null;
let audioCtx: AudioContext | null = null;
let speakingSince = 0;
let lastSpeakingReport = false;

function syncTrackEnabled(state: Pick<VoiceState, "localStream" | "micEnabled" | "pushToTalkEnabled" | "pushToTalkActive">) {
  const track = state.localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = state.pushToTalkEnabled ? state.pushToTalkActive : state.micEnabled;
}

function attachRemoteAudio(peer: RemotePeer, volume: number, outputDeviceId: string | null, muted: boolean) {
  if (!peer.stream) return;
  if (!peer.audioEl) {
    const el = document.createElement("audio");
    el.autoplay = true;
    // `playsInline` avoids iOS Safari forcing fullscreen playback for a media element.
    el.setAttribute("playsinline", "true");
    document.body.appendChild(el);
    peer.audioEl = el;
  }
  peer.audioEl.srcObject = peer.stream;
  peer.audioEl.volume = volume;
  peer.audioEl.muted = muted;
  if (outputDeviceId && "setSinkId" in peer.audioEl) {
    (peer.audioEl as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
      .setSinkId(outputDeviceId)
      .catch(() => {});
  }
  peer.audioEl.play().catch(() => {
    // Autoplay can still be blocked on some mobile browsers even after an
    // earlier gesture unlocked getUserMedia — a visible "tap to enable audio"
    // affordance is handled by the VoiceControls UI watching connectionState.
  });
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set, get) => ({
  socket: null,
  roomCode: null,
  mySeat: null,
  myPlayerProfileId: null,

  voiceEnabled: false,
  localStream: null,
  micEnabled: true,
  pushToTalkEnabled: false,
  pushToTalkActive: false,

  peers: new Map(),
  connectionState: new Map(),
  speakingSeats: new Set(),
  remoteMuted: new Map(),
  localMutedSeats: new Set(),
  seatVolumes: new Map(),
  masterVoiceVolume: 1,
  outputDeviceId: null,

  bindToSocket: (socket) => {
    socket.off("voice:roster");
    socket.off("voice:peer-joined");
    socket.off("voice:peer-left");
    socket.off("voice:offer");
    socket.off("voice:answer");
    socket.off("voice:ice-candidate");
    socket.off("voice:mute-status");
    socket.off("voice:speaking");

    // Guards every signaling handler below that would otherwise create a
    // peer connection: if this player hasn't clicked "Enable Voice" yet,
    // they have no localStream. Creating a connection anyway would attach
    // zero local tracks to it (getOrCreatePeer only adds tracks it can see
    // *at creation time*), and since getOrCreatePeer short-circuits on an
    // "existing" connection, that track-less connection would silently
    // persist even after the player later does enable voice — the classic
    // "my mic doesn't reach them" bug. Ignoring signaling entirely until
    // voice is enabled is safe: the moment it is, `enableVoice` emits
    // `voice:ready` and gets a full, current roster back, so every peer
    // connection this player needs gets created fresh, with tracks attached
    // from the start.
    const voiceEnabled = () => useVoiceStore.getState().voiceEnabled;

    socket.on("voice:roster", ({ seats }) => {
      if (!voiceEnabled()) return;
      const { myPlayerProfileId } = get();
      for (const entry of seats) {
        set((s) => ({ remoteMuted: new Map(s.remoteMuted).set(entry.seat, entry.muted) }));
        if (myPlayerProfileId && myPlayerProfileId < entry.playerProfileId) {
          initiateOfferTo(entry.seat, entry.playerProfileId);
        } else {
          getOrCreatePeer(entry.seat, entry.playerProfileId);
        }
      }
    });

    socket.on("voice:peer-joined", ({ seat, playerProfileId, muted }) => {
      set((s) => ({ remoteMuted: new Map(s.remoteMuted).set(seat, muted) }));
      if (!voiceEnabled()) return;
      const { myPlayerProfileId } = get();
      if (myPlayerProfileId && myPlayerProfileId < playerProfileId) {
        initiateOfferTo(seat, playerProfileId);
      } else {
        getOrCreatePeer(seat, playerProfileId);
      }
    });

    socket.on("voice:peer-left", ({ seat }) => removePeer(seat));

    socket.on("voice:offer", async ({ fromSeat, sdp }) => {
      if (!voiceEnabled()) return;
      const peer = getOrCreatePeer(fromSeat, get().peers.get(fromSeat)?.playerProfileId ?? "");
      await peer.pc.setRemoteDescription(JSON.parse(sdp) as RTCSessionDescriptionInit);
      peer.remoteDescriptionSet = true;
      await flushPendingCandidates(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      get().socket?.emit("voice:answer", { roomCode: get().roomCode!, toSeat: fromSeat, sdp: JSON.stringify(answer) });
    });

    socket.on("voice:answer", async ({ fromSeat, sdp }) => {
      if (!voiceEnabled()) return;
      const peer = get().peers.get(fromSeat);
      if (!peer) return;
      await peer.pc.setRemoteDescription(JSON.parse(sdp) as RTCSessionDescriptionInit);
      peer.remoteDescriptionSet = true;
      await flushPendingCandidates(peer);
    });

    socket.on("voice:ice-candidate", async ({ fromSeat, candidate }) => {
      if (!voiceEnabled()) return;
      const peer = get().peers.get(fromSeat);
      if (!peer) return;
      const parsed = JSON.parse(candidate) as RTCIceCandidateInit;
      if (peer.remoteDescriptionSet) {
        await peer.pc.addIceCandidate(parsed).catch(() => {});
      } else {
        peer.pendingCandidates.push(parsed);
      }
    });

    socket.on("voice:mute-status", ({ seat, muted }) => {
      set((s) => ({ remoteMuted: new Map(s.remoteMuted).set(seat, muted) }));
    });

    socket.on("voice:speaking", ({ seat, speaking }) => {
      set((s) => {
        const next = new Set(s.speakingSeats);
        if (speaking) next.add(seat);
        else next.delete(seat);
        return { speakingSeats: next };
      });
    });

    set({ socket });
  },

  enableVoice: async (roomCode, mySeat, myPlayerProfileId) => {
    if (get().voiceEnabled) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    set({ roomCode, mySeat, myPlayerProfileId, localStream: stream, voiceEnabled: true });
    syncTrackEnabled(get());
    startSpeakingDetector(stream, mySeat);

    get().socket?.emit("voice:ready", { roomCode });
  },

  disableVoice: () => {
    const { peers, localStream, roomCode, socket } = get();
    for (const seat of [...peers.keys()]) removePeer(seat);
    localStream?.getTracks().forEach((t) => t.stop());
    stopSpeakingDetector();
    if (roomCode) socket?.emit("voice:leave", { roomCode });

    set({
      voiceEnabled: false,
      localStream: null,
      peers: new Map(),
      connectionState: new Map(),
      speakingSeats: new Set(),
      remoteMuted: new Map(),
      mySeat: null,
      roomCode: null,
    });
  },

  toggleMic: () => {
    const micEnabled = !get().micEnabled;
    set({ micEnabled });
    syncTrackEnabled(get());
    const { roomCode, socket, pushToTalkEnabled } = get();
    if (roomCode && !pushToTalkEnabled) socket?.emit("voice:mute-status", { roomCode, muted: !micEnabled });
  },

  setPushToTalk: (enabled) => {
    set({ pushToTalkEnabled: enabled, pushToTalkActive: false });
    syncTrackEnabled(get());
    const { roomCode, socket } = get();
    if (roomCode) socket?.emit("voice:mute-status", { roomCode, muted: enabled });
  },

  startPushToTalk: () => {
    if (!get().pushToTalkEnabled) return;
    set({ pushToTalkActive: true });
    syncTrackEnabled(get());
  },

  stopPushToTalk: () => {
    if (!get().pushToTalkEnabled) return;
    set({ pushToTalkActive: false });
    syncTrackEnabled(get());
  },

  setSeatVolume: (seat, volume) => {
    set((s) => ({ seatVolumes: new Map(s.seatVolumes).set(seat, volume) }));
    const peer = get().peers.get(seat);
    if (peer?.audioEl) peer.audioEl.volume = volume * get().masterVoiceVolume;
  },

  setMasterVoiceVolume: (volume) => {
    const masterVoiceVolume = Math.max(0, Math.min(1, volume));
    set({ masterVoiceVolume });
    const { peers, seatVolumes } = get();
    for (const [seat, peer] of peers) {
      if (peer.audioEl) peer.audioEl.volume = (seatVolumes.get(seat) ?? 1) * masterVoiceVolume;
    }
  },

  toggleLocalMute: (seat) => {
    set((s) => {
      const next = new Set(s.localMutedSeats);
      if (next.has(seat)) next.delete(seat);
      else next.add(seat);
      return { localMutedSeats: next };
    });
    const peer = get().peers.get(seat);
    if (peer?.audioEl) peer.audioEl.muted = get().localMutedSeats.has(seat);
  },

  setOutputDevice: async (deviceId) => {
    set({ outputDeviceId: deviceId });
    for (const peer of get().peers.values()) {
      if (peer.audioEl && "setSinkId" in peer.audioEl) {
        await (peer.audioEl as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
          .setSinkId(deviceId)
          .catch(() => {});
      }
    }
  },
    }),
    { name: "trick-taking-voice-prefs", partialize: (state) => ({ masterVoiceVolume: state.masterVoiceVolume }) }
  )
);

// --- Peer connection lifecycle (module-level helpers, operate via the store's own get/set) ---

function getOrCreatePeer(seat: Seat, playerProfileId: string): RemotePeer {
  const state = useVoiceStore.getState();
  const existing = state.peers.get(seat);
  if (existing) {
    // Defensive fallback: if this connection was somehow created before our
    // local stream was ready (the signaling guards above should prevent
    // this, but this keeps a stale connection self-healing rather than
    // permanently one-way if it ever happens), attach our tracks now.
    if (existing.pc.getSenders().length === 0 && state.localStream) {
      state.localStream.getTracks().forEach((track) => existing.pc.addTrack(track, state.localStream!));
    }
    return existing;
  }

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const peer: RemotePeer = { seat, playerProfileId, pc, stream: null, audioEl: null, pendingCandidates: [], remoteDescriptionSet: false };

  state.localStream?.getTracks().forEach((track) => pc.addTrack(track, state.localStream!));

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    const { roomCode, socket } = useVoiceStore.getState();
    if (roomCode) socket?.emit("voice:ice-candidate", { roomCode, toSeat: seat, candidate: JSON.stringify(event.candidate) });
  };

  pc.ontrack = (event) => {
    peer.stream = event.streams[0] ?? new MediaStream([event.track]);
    const { seatVolumes, outputDeviceId, localMutedSeats, masterVoiceVolume } = useVoiceStore.getState();
    attachRemoteAudio(peer, (seatVolumes.get(seat) ?? 1) * masterVoiceVolume, outputDeviceId, localMutedSeats.has(seat));
  };

  pc.oniceconnectionstatechange = () => {
    const mapped: PeerConnectionState =
      pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed"
        ? "connected"
        : pc.iceConnectionState === "failed"
        ? "failed"
        : pc.iceConnectionState === "disconnected"
        ? "disconnected"
        : "connecting";
    useVoiceStore.setState((s) => ({ connectionState: new Map(s.connectionState).set(seat, mapped) }));
  };

  useVoiceStore.setState((s) => ({
    peers: new Map(s.peers).set(seat, peer),
    connectionState: new Map(s.connectionState).set(seat, "connecting"),
  }));

  return peer;
}

async function initiateOfferTo(seat: Seat, playerProfileId: string) {
  const peer = getOrCreatePeer(seat, playerProfileId);
  const offer = await peer.pc.createOffer();
  await peer.pc.setLocalDescription(offer);
  const { roomCode, socket } = useVoiceStore.getState();
  if (roomCode) socket?.emit("voice:offer", { roomCode, toSeat: seat, sdp: JSON.stringify(offer) });
}

async function flushPendingCandidates(peer: RemotePeer) {
  for (const candidate of peer.pendingCandidates) {
    await peer.pc.addIceCandidate(candidate).catch(() => {});
  }
  peer.pendingCandidates = [];
}

function removePeer(seat: Seat) {
  const peer = useVoiceStore.getState().peers.get(seat);
  if (!peer) return;
  peer.pc.close();
  if (peer.audioEl) {
    peer.audioEl.srcObject = null;
    peer.audioEl.remove();
  }
  useVoiceStore.setState((s) => {
    const peers = new Map(s.peers);
    peers.delete(seat);
    const connectionState = new Map(s.connectionState);
    connectionState.delete(seat);
    const speakingSeats = new Set(s.speakingSeats);
    speakingSeats.delete(seat);
    return { peers, connectionState, speakingSeats };
  });
}

// --- Local speaking detection (own mic only — remote peers broadcast their own state) ---

function startSpeakingDetector(stream: MediaStream, mySeat: Seat) {
  stopSpeakingDetector();

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  audioCtx = new AudioCtx();
  // iOS Safari creates AudioContext suspended; resume() must happen inside
  // the user-gesture call stack that led here (the "Enable Voice" click).
  audioCtx.resume().catch(() => {});

  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  lastSpeakingReport = false;
  speakingSince = 0;

  speakingPollHandle = setInterval(() => {
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);
    let sumDeviation = 0;
    for (let i = 0; i < data.length; i++) sumDeviation += Math.abs(data[i] - 128);
    const avgDeviation = sumDeviation / data.length;

    const now = Date.now();
    const aboveThreshold = avgDeviation > SPEAKING_THRESHOLD;
    if (aboveThreshold) speakingSince = now;
    const currentlySpeaking = aboveThreshold || now - speakingSince < SPEAKING_HANGOVER_MS;

    if (currentlySpeaking !== lastSpeakingReport) {
      lastSpeakingReport = currentlySpeaking;
      const { roomCode, socket } = useVoiceStore.getState();
      useVoiceStore.setState((s) => {
        const next = new Set(s.speakingSeats);
        if (currentlySpeaking) next.add(mySeat);
        else next.delete(mySeat);
        return { speakingSeats: next };
      });
      if (roomCode) socket?.emit("voice:speaking", { roomCode, speaking: currentlySpeaking });
    }
  }, SPEAKING_POLL_MS);
}

function stopSpeakingDetector() {
  if (speakingPollHandle) clearInterval(speakingPollHandle);
  speakingPollHandle = null;
  analyser = null;
  if (audioCtx) audioCtx.close().catch(() => {});
  audioCtx = null;
}
