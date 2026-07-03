"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMusicStore, liveMusicPositionMs } from "@/store/useMusicStore";
import { MUSIC_LIBRARY, findTrack } from "@/lib/musicLibrary";
import { GOLD_TEXT } from "@/lib/tableTheme";
import { cn } from "@/lib/utils";

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface MusicPlayerProps {
  roomCode: string;
  isHost: boolean;
}

/**
 * A FAB + Sheet, same pattern as CommsDock — deliberately NOT a panel that
 * grows in place over the table. An earlier version anchored a
 * bottom-left panel that expanded upward and covered the bid panel/hand of
 * cards/"Start Game" button on narrow viewports (confirmed via a
 * responsive audit — the panel and the hand occupy the same fixed-vs-flow
 * screen region once expanded). Routing the full controls through a Sheet
 * gives them their own backdrop and z-layer, so they can never silently
 * sit on top of primary content the way an in-place-growing panel can.
 */
export function MusicPlayer({ roomCode, isHost }: MusicPlayerProps) {
  const trackId = useMusicStore((s) => s.trackId);
  const status = useMusicStore((s) => s.status);
  const positionMs = useMusicStore((s) => s.positionMs);
  const playbackStartEpoch = useMusicStore((s) => s.playbackStartEpoch);
  const shuffle = useMusicStore((s) => s.shuffle);
  const repeat = useMusicStore((s) => s.repeat);
  const volume = useMusicStore((s) => s.volume);
  const muted = useMusicStore((s) => s.muted);

  const play = useMusicStore((s) => s.play);
  const pause = useMusicStore((s) => s.pause);
  const stop = useMusicStore((s) => s.stop);
  const next = useMusicStore((s) => s.next);
  const previous = useMusicStore((s) => s.previous);
  const selectTrack = useMusicStore((s) => s.selectTrack);
  const seek = useMusicStore((s) => s.seek);
  const setShuffle = useMusicStore((s) => s.setShuffle);
  const setRepeat = useMusicStore((s) => s.setRepeat);
  const setVolume = useMusicStore((s) => s.setVolume);
  const toggleMute = useMusicStore((s) => s.toggleMute);

  const [open, setOpen] = useState(false);
  const [liveMs, setLiveMs] = useState(0);

  useEffect(() => {
    const update = () => setLiveMs(liveMusicPositionMs({ status, positionMs, playbackStartEpoch }));
    update();
    if (status !== "playing") return;
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [status, positionMs, playbackStartEpoch]);

  const track = findTrack(trackId);
  const durationMs = track?.durationMs ?? 0;

  function handlePlayPause() {
    if (!isHost) return;
    if (status === "playing") pause(roomCode);
    else play(roomCode);
  }

  function handleSeek(value: number) {
    if (!isHost) return;
    seek(roomCode, value);
  }

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Open music player"
            className="fixed bottom-20 right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/50 shadow-2xl backdrop-blur-xl transition-transform hover:scale-105 active:scale-95 sm:right-4"
          />
        }
      >
        <Music2 className={cn("h-5 w-5", GOLD_TEXT)} />
        {status === "playing" && (
          <motion.span
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className={cn(
          "flex max-h-[70vh] flex-col gap-0 rounded-t-2xl border-white/10 bg-card/95 p-3 backdrop-blur-xl",
          // The base sheet component's own data-[side=bottom]: classes (full-
          // width, flush to the bottom) beat plain sm: utilities regardless of
          // className order — same specificity gotcha fixed for CommsDock's
          // mobile sheet earlier. Overriding with the matching
          // data-[side=bottom]: prefix is what actually wins on sm+.
          "sm:data-[side=bottom]:inset-x-auto sm:data-[side=bottom]:right-4 sm:data-[side=bottom]:bottom-4 sm:data-[side=bottom]:left-auto sm:data-[side=bottom]:w-80 sm:data-[side=bottom]:rounded-2xl sm:data-[side=bottom]:border"
        )}
      >
        <SheetHeader className="p-0 pb-2">
          <SheetTitle className={GOLD_TEXT}>Room Music</SheetTitle>
        </SheetHeader>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{track ? track.title : "No music playing"}</p>
          <p className="text-[10px] text-muted-foreground">
            {status === "playing" ? "Now Playing" : status === "paused" ? "Paused" : "Stopped"}
          </p>
        </div>

        <div className="space-y-3 pt-3">
          <div className="space-y-1">
            <Slider
              min={0}
              max={durationMs || 1}
              step={1000}
              value={[Math.min(liveMs, durationMs || 0)]}
              disabled={!isHost || !track}
              onValueChange={(v) => handleSeek(Array.isArray(v) ? v[0] : v)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(liveMs)}</span>
              <span>{formatTime(durationMs)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous track" disabled={!isHost} onClick={() => previous(roomCode)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={status === "playing" ? "Pause" : "Play"}
              disabled={!isHost}
              onClick={handlePlayPause}
              className={cn("border", GOLD_TEXT, "border-[var(--gold)]/40")}
            >
              {status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Stop" disabled={!isHost} onClick={() => stop(roomCode)}>
              <Square className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next track" disabled={!isHost} onClick={() => next(roomCode)}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant={shuffle ? "default" : "ghost"}
                size="icon-xs"
                aria-label="Toggle shuffle"
                disabled={!isHost}
                onClick={() => setShuffle(roomCode, !shuffle)}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={repeat !== "off" ? "default" : "ghost"}
                size="icon-xs"
                aria-label="Cycle repeat mode"
                disabled={!isHost}
                onClick={() => setRepeat(roomCode, repeat === "off" ? "all" : repeat === "all" ? "one" : "off")}
              >
                <RepeatIcon className="h-3.5 w-3.5" />
              </Button>
              {isHost && (
                <Popover>
                  <PopoverTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Choose track" />}>
                    <ListMusic className="h-3.5 w-3.5" />
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" side="top">
                    {MUSIC_LIBRARY.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => selectTrack(roomCode, t.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/10",
                          t.id === trackId && GOLD_TEXT
                        )}
                      >
                        🎵 {t.title}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-xs" aria-label={muted ? "Unmute music" : "Mute music"} onClick={toggleMute}>
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Slider
                className="w-16"
                min={0}
                max={1}
                step={0.05}
                value={[muted ? 0 : volume]}
                onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)}
              />
            </div>
          </div>

          {!isHost && <p className="text-center text-[10px] text-muted-foreground">Only the host can control room music.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
