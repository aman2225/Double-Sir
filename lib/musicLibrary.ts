// Built-in room-music library. Pure data, no I/O — imported both by the
// server (server/musicTimer.ts needs each track's duration to schedule
// auto-advance) and the client (music player UI / track picker).
//
// The current tracks are original placeholder ambient loops synthesized by
// scripts/generatePlaceholderMusic.mjs (zero copyright risk — no external
// audio was fetched). To swap in real royalty-free tracks later (Pixabay,
// Mixkit, Uppbeat, etc.): drop the audio file into public/music/ and edit
// (or add) an entry below with its real `url` and `durationMs` — no other
// code changes are needed anywhere in the app.

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  durationMs: number;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: "casino-night", title: "Casino Night", artist: "Double Sir Originals", url: "/music/casino-night.wav", durationMs: 64000 },
  { id: "royal-table", title: "Royal Table", artist: "Double Sir Originals", url: "/music/royal-table.wav", durationMs: 64000 },
  { id: "relax", title: "Relax", artist: "Double Sir Originals", url: "/music/relax.wav", durationMs: 64000 },
  { id: "action", title: "Action", artist: "Double Sir Originals", url: "/music/action.wav", durationMs: 64000 },
  { id: "epic-battle", title: "Epic Battle", artist: "Double Sir Originals", url: "/music/epic-battle.wav", durationMs: 64000 },
  { id: "chill-lounge", title: "Chill Lounge", artist: "Double Sir Originals", url: "/music/chill-lounge.wav", durationMs: 64000 },
];

export function findTrack(trackId: string | null | undefined): MusicTrack | undefined {
  return trackId ? MUSIC_LIBRARY.find((t) => t.id === trackId) : undefined;
}
